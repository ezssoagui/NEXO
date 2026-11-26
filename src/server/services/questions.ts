import { z } from 'zod';
import { deriveCpeEvidence } from '@/modules/mastery/evidence';
import { cpeEligible, errorClassificationOffered, ERROR_CAUSES } from '@/modules/questions/rules';
import { localDate } from '@/modules/quotas/period';
import { asService } from '@/server/db';
import { one, type Tx } from '@/server/db/types';
import { AppError, notFound } from '@/server/http/errors';
import { consumeQuota } from './core';
import { applyEvidence, processQuestionAnswer, recordLearningEvent } from './learning';
import { currentRecommendations } from './recommendations';

export const bankFilterSchema = z.object({
  q: z.string().max(200).optional(),
  areas: z.array(z.enum(['LC', 'MT', 'CN', 'CH'])).max(4).optional(),
  subjectIds: z.array(z.string().uuid()).max(30).optional(),
  subtopicIds: z.array(z.string().uuid()).max(100).optional(),
  difficulties: z.array(z.enum(['easy', 'medium', 'hard'])).max(3).optional(),
  years: z.array(z.number().int().min(1998).max(2100)).max(40).optional(),
  applications: z.array(z.enum(['regular', 'ppl', 'reaplicacao', 'digital', 'outra'])).max(5).optional(),
  status: z.enum(['all', 'unseen', 'answered', 'wrong']).default('all'),
  page: z.number().int().min(1).max(500).default(1),
});
export type BankFilter = z.infer<typeof bankFilterSchema>;

function filterSql(f: BankFilter, userId: string, params: unknown[]): string {
  const where = [`q.publication_status = 'published'`];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
  if (f.q?.trim()) where.push(`(q.search_tsv @@ websearch_to_tsquery('portuguese', ${p(f.q)}) or q.statement_md ilike ${p(`%${f.q.trim()}%`)})`);
  if (f.areas?.length) where.push(`q.area_code = any(${p(f.areas)}::text[])`);
  if (f.subtopicIds?.length) where.push(`(q.primary_subtopic_id = any(${p(f.subtopicIds)}::uuid[]) or exists (select 1 from question_tags qt where qt.question_id = q.id and qt.subtopic_id = any(${p(f.subtopicIds)}::uuid[])))`);
  if (f.subjectIds?.length) where.push(`exists (select 1 from subtopics st join topics t on t.id = st.topic_id where st.id = q.primary_subtopic_id and t.subject_id = any(${p(f.subjectIds)}::uuid[]))`);
  if (f.difficulties?.length) where.push(`q.difficulty = any(${p(f.difficulties)}::text[])`);
  if (f.years?.length) where.push(`q.year = any(${p(f.years)}::int[])`);
  if (f.applications?.length) where.push(`q.application = any(${p(f.applications)}::text[])`);
  const u = f.status === 'all' ? '' : p(userId);
  if (f.status === 'unseen') where.push(`not exists (select 1 from attempts a where a.user_id = ${u} and a.question_id = q.id)`);
  if (f.status === 'answered') where.push(`exists (select 1 from attempts a where a.user_id = ${u} and a.question_id = q.id)`);
  if (f.status === 'wrong') where.push(`exists (select 1 from error_entries e where e.user_id = ${u} and e.question_id = q.id and e.recovery_status <> 'overcome')`);
  return where.join(' and ');
}

/** Busca no banco oficial: somente metadados e trecho do enunciado (sem gabarito). */
export async function searchBank(tx: Tx, userId: string, f: BankFilter) {
  const params: unknown[] = [];
  const where = filterSql(f, userId, params);
  params.push(userId);
  const pageSize = 20;
  const [count] = await tx.query<{ n: number }>(`select count(*)::int as n from questions q where ${where} and $${params.length}::uuid is not null`, params);
  const rows = await tx.query<{ id: string; area_code: string; year: number | null; application: string | null; difficulty: string | null; snippet: string; subtopic: string | null; is_synthetic: boolean; answered: boolean }>(
    `select q.id, q.area_code, q.year, q.application, q.difficulty, left(regexp_replace(q.statement_md, '\\s+', ' ', 'g'), 220) as snippet,
            st.name as subtopic, q.is_synthetic,
            exists (select 1 from attempts a where a.user_id = $${params.length}::uuid and a.question_id = q.id) as answered
       from questions q left join subtopics st on st.id = q.primary_subtopic_id
      where ${where} order by q.year desc nulls last, q.id limit ${pageSize} offset ${(f.page - 1) * pageSize}`, params);
  return { total: count!.n, page: f.page, pageSize, items: rows };
}

export async function questionPayload(tx: Tx, questionId: string) {
  const q = await one<{ id: string; area_code: string; year: number | null; application: string | null; language: string | null; statement_md: string; difficulty: string | null; is_synthetic: boolean; subtopic: string | null; publication_status: string }>(
    tx, `select q.id, q.area_code, q.year, q.application, q.language, q.statement_md, q.difficulty, q.is_synthetic, st.name as subtopic, q.publication_status
           from questions q left join subtopics st on st.id = q.primary_subtopic_id where q.id = $1`, [questionId]);
  if (!q || q.publication_status !== 'published') throw notFound('Questão');
  const alternatives = await tx.query<{ letter: string; body_md: string }>('select letter, body_md from alternatives where question_id = $1 order by letter', [questionId]);
  const assets = await tx.query<{ id: string; kind: string; storage_key: string; alt_text: string }>(
    'select id, kind, storage_key, alt_text from question_assets where question_id = $1 order by sort', [questionId]);
  const { publication_status: _ps, ...rest } = q;
  return { ...rest, alternatives, assets };
}

/**
 * Entrega a questão para resolução (sem gabarito — 2.4/7.7). Contexto define a franquia:
 * livre/lista consomem 'questions' por questão distinta/dia; sessão e simulado não (proposta A.2).
 */
export async function serveQuestion(userId: string, questionId: string, context: { kind: 'free' | 'list' | 'session' | 'exam'; id?: string }) {
  await asService(async (tx) => {
    if (context.kind === 'session') {
      const ok = await one(tx, `select 1 from session_activities sa join study_sessions s on s.id = sa.session_id
        where s.id = $1 and s.user_id = $2 and s.status in ('in_progress','paused') and sa.ref_id = $3`, [context.id, userId, questionId]);
      if (!ok) throw notFound('Atividade da sessão');
    } else if (context.kind === 'list') {
      const ok = await one(tx, `select 1 from question_list_items i join question_lists l on l.id = i.list_id where l.id = $1 and l.user_id = $2 and i.question_id = $3`, [context.id, userId, questionId]);
      if (!ok) throw notFound('Item da lista');
    } else if (context.kind === 'exam') {
      const ok = await one(tx, `select 1 from exam_answers ea join exam_attempts a on a.id = ea.attempt_id where a.id = $1 and a.user_id = $2 and ea.question_id = $3 and a.status in ('in_progress','paused')`, [context.id, userId, questionId]);
      if (!ok) throw notFound('Questão do simulado');
    }
  });
  if (context.kind === 'free' || context.kind === 'list') {
    try {
      await consumeQuota(userId, 'questions', `q:${questionId}:${localDate(new Date())}`);
    } catch (e) {
      if (!(e instanceof AppError && e.code === 'duplicate_request')) throw e; // mesma questão no mesmo dia não conta de novo
    }
  }
  return asService((tx) => questionPayload(tx, questionId));
}

async function correction(tx: Tx, questionId: string) {
  const sol = await one<{ body_md: string; cpe_reference: unknown }>(
    tx, `select body_md, cpe_reference from question_solutions where question_id = $1 and validation_status = 'validated' order by version desc limit 1`, [questionId]);
  const q = await one<{ correct_alternative: string | null; is_annulled: boolean }>(tx, 'select correct_alternative, is_annulled from questions where id = $1', [questionId]);
  return { correctAlternative: q?.correct_alternative ?? null, annulled: q?.is_annulled ?? false, solution: sol?.body_md ?? null };
}

/** Questão avulsa: correção logo após a confirmação (2.4). */
export async function submitSingle(userId: string, input: { questionId: string; selected: 'A' | 'B' | 'C' | 'D' | 'E'; idempotencyKey: string; timeSpentMs?: number; confidence?: 1 | 2 | 3; eliminated?: string[] }) {
  return asService(async (tx) => {
    const r = await processQuestionAnswer(tx, { userId, questionId: input.questionId, selected: input.selected, mode: 'single', source: 'free',
      idempotencyKey: `single:${input.idempotencyKey}`, timeSpentMs: input.timeSpentMs, confidence: input.confidence, eliminated: input.eliminated });
    return { ...r, ...(await correction(tx, input.questionId)) };
  });
}

// ---------------------------------------------------------------------------
// Listas (5.3): adaptativa ou manual; correção somente ao final.
// ---------------------------------------------------------------------------
export async function createList(userId: string, input: { mode: 'adaptive' | 'manual'; filters?: BankFilter; count: number }) {
  return asService(async (tx) => {
    let ids: string[];
    if (input.mode === 'manual') {
      const params: unknown[] = [];
      const where = filterSql(bankFilterSchema.parse({ ...(input.filters ?? {}), page: 1 }), userId, params);
      const rows = await tx.query<{ id: string }>(
        `select q.id from questions q where ${where} and not q.is_annulled order by md5(q.id::text || $${params.length + 1}::text) limit ${input.count}`,
        [...params, crypto.randomUUID()]);
      ids = rows.map((r) => r.id);
    } else {
      // Prática adaptativa: o motor seleciona conteúdos prioritários e itens inéditos.
      const recs = (await currentRecommendations(tx, userId)).filter((r) => r.category !== 'learn').slice(0, 3);
      const targets = recs.length ? recs.map((r) => r.subtopic_id) : (await currentRecommendations(tx, userId)).slice(0, 3).map((r) => r.subtopic_id);
      const rows = await tx.query<{ id: string }>(
        `select q.id from questions q where q.publication_status = 'published' and not q.is_annulled and q.primary_subtopic_id = any($2::uuid[])
           and not exists (select 1 from attempts a where a.user_id = $1 and a.question_id = q.id)
         order by array_position($2::uuid[], q.primary_subtopic_id), case q.difficulty when 'easy' then 1 when 'medium' then 2 else 3 end, q.id
         limit $3`, [userId, targets, input.count]);
      ids = rows.map((r) => r.id);
    }
    if (!ids.length) throw new AppError(404, 'no_questions', 'Nenhuma questão disponível para esses filtros.');
    const [list] = await tx.query<{ id: string }>('insert into question_lists (user_id, mode, filters) values ($1,$2,$3) returning id',
      [userId, input.mode, JSON.stringify(input.filters ?? {})]);
    for (const [i, qid] of ids.entries()) {
      await tx.query('insert into question_list_items (list_id, position, question_id) values ($1,$2,$3)', [list!.id, i + 1, qid]);
    }
    return { id: list!.id, count: ids.length };
  });
}

export async function getList(tx: Tx, userId: string, listId: string) {
  const list = await one<{ id: string; mode: string; status: string; created_at: Date; finished_at: Date | null }>(
    tx, 'select id, mode, status, created_at, finished_at from question_lists where id = $1 and user_id = $2', [listId, userId]);
  if (!list) throw notFound('Lista');
  const items = await tx.query<{ position: number; question_id: string; selected_alternative: string | null; attempt_id: string | null; area_code: string; difficulty: string | null }>(
    `select i.position, i.question_id, i.selected_alternative, i.attempt_id, q.area_code, q.difficulty
       from question_list_items i join questions q on q.id = i.question_id where i.list_id = $1 order by i.position`, [listId]);
  const finished = list.status === 'finished';
  const withCorrection = finished
    ? await Promise.all(items.map(async (it) => ({ ...it, ...(await correction(tx, it.question_id)) })))
    : items;
  return { ...list, items: withCorrection };
}

export async function saveListAnswer(userId: string, listId: string, position: number, selected: string | null, eliminated: string[]) {
  return asService(async (tx) => {
    const r = await tx.query(
      `update question_list_items i set selected_alternative = $4, eliminated = $5 from question_lists l
        where l.id = i.list_id and l.id = $1 and l.user_id = $2 and l.status = 'in_progress' and i.position = $3 returning i.position`,
      [listId, userId, position, selected, JSON.stringify(eliminated)]);
    if (!r.length) throw notFound('Item da lista');
    return { ok: true };
  });
}

export async function finishList(userId: string, listId: string) {
  return asService(async (tx) => {
    const list = await one<{ status: string }>(tx, 'select status from question_lists where id = $1 and user_id = $2 for update', [listId, userId]);
    if (!list) throw notFound('Lista');
    if (list.status === 'in_progress') {
      const items = await tx.query<{ position: number; question_id: string; selected_alternative: 'A' | 'B' | 'C' | 'D' | 'E' | null; eliminated: string[] }>(
        'select position, question_id, selected_alternative, eliminated from question_list_items where list_id = $1 order by position', [listId]);
      for (const it of items) {
        if (!it.selected_alternative) continue; // ausência de resposta não é erro
        const r = await processQuestionAnswer(tx, { userId, questionId: it.question_id, selected: it.selected_alternative, mode: 'list', source: 'list',
          contextId: listId, idempotencyKey: `list:${listId}:${it.position}`, eliminated: it.eliminated });
        await tx.query('update question_list_items set attempt_id = $3 where list_id = $1 and position = $2', [listId, it.position, r.attemptId]);
      }
      await tx.query(`update question_lists set status = 'finished', finished_at = now() where id = $1`, [listId]);
    }
    return getList(tx, userId, listId);
  });
}

// ---------------------------------------------------------------------------
// CPE (2.6) — sem IA: reflexão guiada comparada à referência validada; evidência assistida.
// ---------------------------------------------------------------------------
export const cpeStepSchema = z.object({
  step: z.enum(['comando', 'prova', 'eliminacao']),
  text: z.string().max(2000).optional(),
  eliminations: z.partialRecord(z.enum(['A', 'B', 'C', 'D', 'E']), z.string().max(400)).optional(),
  selfAssessment: z.enum(['correct', 'partial', 'incorrect']),
});

export async function getCpe(tx: Tx, userId: string, attemptId: string) {
  const a = await one<{ question_id: string; is_correct: boolean | null; area_code: string; difficulty: 'easy' | 'medium' | 'hard' | null; selected_alternative: string | null }>(
    tx, `select a.question_id, a.is_correct, q.area_code, q.difficulty, a.selected_alternative from attempts a join questions q on q.id = a.question_id where a.id = $1 and a.user_id = $2`, [attemptId, userId]);
  if (!a) throw notFound('Tentativa');
  if (a.is_correct !== false || !cpeEligible({ areaCode: a.area_code, difficulty: a.difficulty, isCorrect: false })) {
    throw new AppError(422, 'cpe_not_applicable', 'O método CPE se aplica apenas a erros em questões médias ou difíceis de Linguagens e Humanas.');
  }
  const steps = await tx.query<{ step: string; response: unknown; correct: boolean | null }>('select step, response, correct from cpe_responses where attempt_id = $1', [attemptId]);
  const ref = await one<{ cpe_reference: Record<string, unknown> | null }>(tx,
    `select cpe_reference from question_solutions where question_id = $1 and validation_status = 'validated' order by version desc limit 1`, [a.question_id]);
  // A referência só é exibida para a etapa já respondida (sem pistas antes da resposta).
  const done = new Set(steps.map((s) => s.step));
  const reference = ref?.cpe_reference && done.size
    ? Object.fromEntries(Object.entries(ref.cpe_reference).filter(([k]) => done.has(k)))
    : null;
  return { attemptId, questionId: a.question_id, selected: a.selected_alternative, steps, reference };
}

export async function submitCpeStep(userId: string, attemptId: string, input: z.infer<typeof cpeStepSchema>) {
  return asService(async (tx) => {
    const cpe = await getCpe(tx, userId, attemptId);
    const q = await one<{ primary_skill_id: string | null }>(tx, 'select primary_skill_id from questions where id = $1', [cpe.questionId]);
    const correct = input.selfAssessment === 'correct' ? true : input.selfAssessment === 'incorrect' ? false : null;
    await tx.query(
      `insert into cpe_responses (user_id, attempt_id, step, response, correct) values ($1,$2,$3,$4,$5)
       on conflict (attempt_id, step) do nothing`, [userId, attemptId, input.step, JSON.stringify({ text: input.text, eliminations: input.eliminations, self: input.selfAssessment }), correct]);
    const steps = await tx.query<{ step: string; correct: boolean | null }>('select step, correct from cpe_responses where attempt_id = $1', [attemptId]);
    const status = steps.length >= 3 ? 'completed' : 'partial';
    await tx.query(`update error_entries set cpe_status = $3 where user_id = $1 and question_id = $2`, [userId, cpe.questionId, status]);
    if (status === 'completed' && q?.primary_skill_id) {
      const ev = await recordLearningEvent(tx, { userId, eventType: 'cpe_step', source: 'review', idempotencyKey: `cpe:${attemptId}`, entityType: 'attempt', entityId: attemptId });
      if (ev.created) {
        const correctSteps = steps.filter((s) => s.correct === true).length + steps.filter((s) => s.correct === null).length * 0.5;
        await applyEvidence(tx, userId, ev.id, deriveCpeEvidence({ skillId: q.primary_skill_id, attemptId, correctSteps, totalSteps: 3 }), new Date());
      }
    }
    return getCpe(tx, userId, attemptId);
  });
}

export async function classifyError(userId: string, attemptId: string, cause: (typeof ERROR_CAUSES)[number]) {
  return asService(async (tx) => {
    const a = await one<{ is_correct: boolean | null; area_code: string; question_id: string }>(
      tx, 'select a.is_correct, q.area_code, a.question_id from attempts a join questions q on q.id = a.question_id where a.id = $1 and a.user_id = $2', [attemptId, userId]);
    if (!a) throw notFound('Tentativa');
    if (!errorClassificationOffered({ areaCode: a.area_code, isCorrect: Boolean(a.is_correct) })) {
      throw new AppError(422, 'not_applicable', 'Classificação disponível apenas para erros em Matemática e Ciências da Natureza.');
    }
    await tx.query(`insert into error_classifications (user_id, attempt_id, cause) values ($1,$2,$3)
      on conflict (attempt_id) do update set cause = excluded.cause`, [userId, attemptId, cause]);
    await tx.query(`update error_entries set error_type = $3 where user_id = $1 and question_id = $2`, [userId, a.question_id, cause]);
    return { ok: true };
  });
}

export async function errorNotebook(tx: Tx, userId: string, f: { status?: 'open' | 'recovering' | 'overcome'; area?: string }) {
  return tx.query(
    `select e.id, e.question_id, e.attempts_count, e.recovery_status, e.cpe_status, e.error_type, e.difficulty, e.created_at, e.updated_at,
            q.area_code, st.name as subtopic, left(regexp_replace(q.statement_md, '\\s+', ' ', 'g'), 180) as snippet,
            la.selected_alternative as last_answer, q.correct_alternative, e.last_attempt_id
       from error_entries e join questions q on q.id = e.question_id left join subtopics st on st.id = e.subtopic_id
       join attempts la on la.id = e.last_attempt_id
      where e.user_id = $1 and ($2::text is null or e.recovery_status = $2) and ($3::text is null or q.area_code = $3)
      order by e.updated_at desc limit 200`, [userId, f.status ?? null, f.area ?? null]);
}
