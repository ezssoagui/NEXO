import { composeCustomExam, scoreExam, OFFICIAL_FORMAT } from '@/modules/simulations/compose';
import { asService } from '@/server/db';
import { one, type Tx } from '@/server/db/types';
import { AppError, conflict, notFound } from '@/server/http/errors';
import { checkAchievements, consumeQuota } from './core';
import { processQuestionAnswer } from './learning';

export async function listExams(tx: Tx, userId: string) {
  const exams = await tx.query(
    `select e.id, e.kind, e.title, e.day, e.duration_minutes, e.includes_essay, (select count(*)::int from exam_items i where i.exam_id = e.id) as items
       from exams e where e.status = 'published' and (e.owner_id is null or e.owner_id = $1) and e.kind <> 'diagnostic'
      order by e.kind, e.created_at desc limit 100`, [userId]);
  const attempts = await tx.query(
    `select a.id, a.exam_id, e.title, e.kind, a.status, a.started_at, a.finished_at, a.result
       from exam_attempts a join exams e on e.id = a.exam_id where a.user_id = $1 order by a.created_at desc limit 50`, [userId]);
  return { exams, attempts };
}

async function insertExam(tx: Tx, userId: string, input: { kind: 'custom' | 'diagnostic'; title: string; duration: number | null; ids: string[]; rule: unknown; language: string | null }) {
  const [e] = await tx.query<{ id: string }>(
    `insert into exams (kind, title, duration_minutes, owner_id, composition_rule, language, status) values ($1,$2,$3,$4,$5,$6,'published') returning id`,
    [input.kind, input.title, input.duration, userId, JSON.stringify(input.rule), input.language]);
  for (const [i, qid] of input.ids.entries()) await tx.query('insert into exam_items (exam_id, position, question_id) values ($1,$2,$3)', [e!.id, i + 1, qid]);
  return e!.id;
}

async function candidates(tx: Tx, userId: string) {
  return tx.query<{ id: string; areaCode: string; difficulty: 'easy' | 'medium' | 'hard' | null; seen: boolean; language: string | null }>(
    `select q.id, q.area_code as "areaCode", q.difficulty, q.language,
            exists (select 1 from attempts a where a.user_id = $1 and a.question_id = q.id) as seen
       from questions q where q.publication_status = 'published' and not q.is_annulled order by md5(q.id::text || $2)`, [userId, crypto.randomUUID()]);
}

/** Simulado personalizado (5.9): só questões oficiais, distribuição representativa, inéditas primeiro. */
export async function createCustomExam(userId: string, input: { perArea: Partial<Record<'LC' | 'CH' | 'CN' | 'MT', number>>; timed: boolean }) {
  return asService(async (tx) => {
    const prof = await one<{ foreign_language: 'en' | 'es' | null }>(tx, 'select foreign_language from profiles where id = $1', [userId]);
    const { itemIds, shortfall } = composeCustomExam({ candidates: await candidates(tx, userId), perArea: input.perArea, language: prof?.foreign_language ?? null });
    if (!itemIds.length) throw new AppError(422, 'no_questions', 'Não há questões oficiais publicadas suficientes para montar o simulado.');
    // Duração proporcional ao formato oficial (≈ 3,5 min/questão no 2º dia; 1º dia inclui redação) — proposta ADR-013.
    const duration = input.timed ? Math.max(10, Math.round(itemIds.length * (OFFICIAL_FORMAT.day2.minutes / OFFICIAL_FORMAT.day2.questions))) : null;
    const id = await insertExam(tx, userId, { kind: 'custom', title: `Simulado personalizado (${itemIds.length} questões)`, duration, ids: itemIds, rule: { perArea: input.perArea, shortfall }, language: prof?.foreign_language ?? null });
    return { examId: id, items: itemIds.length, shortfall };
  });
}

/** Diagnóstico completo opcional (2.2): até 180 questões (referência 45/área), sem cronômetro, retomável. */
export async function createDiagnostic(userId: string) {
  return asService(async (tx) => {
    const existing = await one<{ id: string }>(tx,
      `select a.id from exam_attempts a join exams e on e.id = a.exam_id where a.user_id = $1 and e.kind = 'diagnostic' and a.status in ('in_progress','paused')`, [userId]);
    if (existing) return { attemptId: existing.id, resumed: true };
    const prof = await one<{ foreign_language: 'en' | 'es' | null }>(tx, 'select foreign_language from profiles where id = $1', [userId]);
    const { itemIds, shortfall } = composeCustomExam({ candidates: await candidates(tx, userId), perArea: { LC: 45, CH: 45, CN: 45, MT: 45 }, language: prof?.foreign_language ?? null });
    if (!itemIds.length) throw new AppError(422, 'no_questions', 'Não há questões oficiais publicadas para o diagnóstico.');
    const examId = await insertExam(tx, userId, { kind: 'diagnostic', title: 'Diagnóstico completo (opcional)', duration: null, ids: itemIds, rule: { perArea: 45, shortfall }, language: prof?.foreign_language ?? null });
    const attemptId = await openAttempt(tx, userId, examId, 'none');
    return { attemptId, resumed: false, shortfall };
  });
}

async function openAttempt(tx: Tx, userId: string, examId: string, timerMode: 'official' | 'none') {
  const [a] = await tx.query<{ id: string }>(`insert into exam_attempts (user_id, exam_id, timer_mode) values ($1,$2,$3) returning id`, [userId, examId, timerMode]);
  await tx.query(`insert into exam_answers (attempt_id, position, question_id) select $1, position, question_id from exam_items where exam_id = $2`, [a!.id, examId]);
  return a!.id;
}

export async function startExam(userId: string, examId: string, timerMode: 'official' | 'none') {
  const exam = await asService((tx) => one<{ kind: string; owner_id: string | null }>(tx, `select kind, owner_id from exams where id = $1 and status = 'published'`, [examId]));
  if (!exam || (exam.owner_id && exam.owner_id !== userId)) throw notFound('Simulado');
  const requestId = `exam:${examId}:${crypto.randomUUID()}`;
  if (exam.kind !== 'diagnostic') await consumeQuota(userId, 'exams', requestId);
  return asService(async (tx) => ({ attemptId: await openAttempt(tx, userId, examId, exam.kind === 'diagnostic' ? 'none' : timerMode) }));
}

function remainingSeconds(a: { timer_mode: string; duration_minutes: number | null; elapsed_seconds: number; last_resumed_at: Date; status: string }): number | null {
  if (a.timer_mode !== 'official' || !a.duration_minutes) return null;
  const running = a.status === 'in_progress' ? Math.floor((Date.now() - new Date(a.last_resumed_at).getTime()) / 1000) : 0;
  return Math.max(0, a.duration_minutes * 60 - a.elapsed_seconds - running);
}

export async function getAttempt(tx: Tx, userId: string, attemptId: string) {
  const a = await one<{ id: string; exam_id: string; status: string; timer_mode: string; elapsed_seconds: number; last_resumed_at: Date; started_at: Date; finished_at: Date | null; result: unknown; title: string; kind: string; duration_minutes: number | null; includes_essay: boolean }>(
    tx, `select a.id, a.exam_id, a.status, a.timer_mode, a.elapsed_seconds, a.last_resumed_at, a.started_at, a.finished_at, a.result, e.title, e.kind, e.duration_minutes, e.includes_essay
           from exam_attempts a join exams e on e.id = a.exam_id where a.id = $1 and a.user_id = $2`, [attemptId, userId]);
  if (!a) throw notFound('Simulado');
  const finished = a.status === 'finished';
  const answers = await tx.query<{ position: number; question_id: string; selected_alternative: string | null; marked_for_review: boolean; area_code: string; correct_alternative?: string | null }>(
    `select ea.position, ea.question_id, ea.selected_alternative, ea.marked_for_review, q.area_code ${finished ? ', q.correct_alternative, q.is_annulled' : ''}
       from exam_answers ea join questions q on q.id = ea.question_id where ea.attempt_id = $1 order by ea.position`, [attemptId]);
  return { ...a, remainingSeconds: remainingSeconds(a), answers };
}

export async function saveExamAnswer(userId: string, attemptId: string, input: { position: number; selected?: 'A' | 'B' | 'C' | 'D' | 'E' | null; marked?: boolean; eliminated?: string[]; confidence?: 1 | 2 | 3 | null }) {
  return asService(async (tx) => {
    const a = await getAttempt(tx, userId, attemptId);
    if (a.status !== 'in_progress') throw conflict('Simulado não está em andamento.', 'exam_not_active');
    if (a.remainingSeconds === 0) return finishExamTx(tx, userId, attemptId); // tempo esgotado: encerra
    await tx.query(
      `update exam_answers set selected_alternative = coalesce($3, case when $4 then null else selected_alternative end),
         marked_for_review = coalesce($5, marked_for_review), eliminated = coalesce($6, eliminated), confidence = coalesce($7, confidence), answered_at = now()
       where attempt_id = $1 and position = $2`,
      [attemptId, input.position, input.selected ?? null, input.selected === null, input.marked ?? null, input.eliminated ? JSON.stringify(input.eliminated) : null, input.confidence ?? null]);
    return { ok: true, remainingSeconds: a.remainingSeconds };
  });
}

export async function pauseExam(userId: string, attemptId: string, pause: boolean) {
  return asService(async (tx) => {
    const a = await getAttempt(tx, userId, attemptId);
    if (a.timer_mode === 'official' && pause) throw conflict('Simulados cronometrados no formato oficial não podem ser pausados.', 'pause_not_allowed');
    if (pause && a.status === 'in_progress') {
      await tx.query(`update exam_attempts set status = 'paused', elapsed_seconds = elapsed_seconds + extract(epoch from (now() - last_resumed_at))::int where id = $1`, [attemptId]);
    } else if (!pause && a.status === 'paused') {
      await tx.query(`update exam_attempts set status = 'in_progress', last_resumed_at = now() where id = $1`, [attemptId]);
    }
    return getAttempt(tx, userId, attemptId);
  });
}

async function finishExamTx(tx: Tx, userId: string, attemptId: string) {
  const a = await getAttempt(tx, userId, attemptId);
  if (a.status === 'finished') return a;
  const rows = await tx.query<{ position: number; question_id: string; selected_alternative: 'A' | 'B' | 'C' | 'D' | 'E' | null; confidence: 1 | 2 | 3 | null; area_code: string; correct_alternative: string | null; is_annulled: boolean }>(
    `select ea.position, ea.question_id, ea.selected_alternative, ea.confidence, q.area_code, q.correct_alternative, q.is_annulled
       from exam_answers ea join questions q on q.id = ea.question_id where ea.attempt_id = $1 order by ea.position`, [attemptId]);
  const mode = a.kind === 'diagnostic' ? 'diagnostic' : 'exam';
  for (const r of rows) {
    if (!r.selected_alternative) continue; // em branco não vira evidência de erro (ausência ≠ zero)
    await processQuestionAnswer(tx, { userId, questionId: r.question_id, selected: r.selected_alternative, mode, source: mode, contextId: attemptId,
      idempotencyKey: `exam:${attemptId}:${r.position}`, confidence: r.confidence });
  }
  const result = scoreExam(rows.map((r) => ({ questionId: r.question_id, areaCode: r.area_code, selected: r.selected_alternative, correct: r.correct_alternative, annulled: r.is_annulled })));
  await tx.query(`update exam_attempts set status = 'finished', finished_at = now(),
      elapsed_seconds = elapsed_seconds + case when status = 'in_progress' then extract(epoch from (now() - last_resumed_at))::int else 0 end, result = $2 where id = $1`,
    [attemptId, JSON.stringify(result)]);
  await checkAchievements(tx, userId);
  return getAttempt(tx, userId, attemptId);
}

export async function finishExam(userId: string, attemptId: string) {
  return asService((tx) => finishExamTx(tx, userId, attemptId));
}
