import { computePriority, type Focus } from '@/modules/adaptive-engine/priority';
import { planSession, type Candidates } from '@/modules/adaptive-engine/composition';
import type { Difficulty } from '@/modules/mastery/params';
import { asService } from '@/server/db';
import { one, type Tx } from '@/server/db/types';
import { AppError, conflict, notFound } from '@/server/http/errors';
import { consumeQuota, engineParams, userPlan } from './core';
import { processQuestionAnswer } from './learning';
import { buildSnapshots } from './recommendations';
import { lessonAccessible } from './content';
import { answerTwinTx, findEquivalent } from './twins';

async function candidatesFor(tx: Tx, userId: string, subtopicId: string): Promise<{ candidates: Candidates; comprehension: number | null }> {
  const lang = await one<{ foreign_language: string | null }>(tx, 'select foreign_language from profiles where id = $1', [userId]);
  const questions = await tx.query<{ id: string; difficulty: Difficulty | null; seen: boolean }>(
    `select q.id, q.difficulty, exists (select 1 from attempts a where a.user_id = $1 and a.question_id = q.id) as seen
       from questions q where q.primary_subtopic_id = $2 and q.publication_status = 'published' and not q.is_annulled
        and (q.language is null or q.language = $3) order by q.id`, [userId, subtopicId, lang?.foreign_language ?? null]);
  const { plan } = await userPlan(tx, userId);
  const lessonRows = await tx.query<{ id: string; kind: Candidates['lessons'][number]['kind']; is_free: boolean }>(
    `select id, kind, is_free from lessons where subtopic_id = $1 and status = 'published' order by kind, title`, [subtopicId]);
  const lessons = await Promise.all(lessonRows.map(async (l) => ({ id: l.id, kind: l.kind, accessible: await lessonAccessible(tx, plan, l) })));
  const concepts = await tx.query<{ id: string; answered: boolean }>(
    `select ca.id, exists (select 1 from concept_responses cr where cr.user_id = $1 and cr.activity_id = ca.id and cr.status = 'evaluated') as answered
       from concept_activities ca join skills k on k.id = ca.skill_id where k.subtopic_id = $2 and ca.status = 'published' order by ca.id`, [userId, subtopicId]);
  const [due] = await tx.query<{ n: number }>(
    `select count(*)::int as n from flashcards f join decks d on d.id = f.deck_id
       left join card_states cs on cs.flashcard_id = f.id and cs.user_id = $1
      where d.subtopic_id = $2 and d.status = 'published' and f.status = 'published' and (cs.due is null or cs.due <= now())`, [userId, subtopicId]);
  const [c] = await tx.query<{ c: string | null }>(
    `select avg(ms.c)::text as c from mastery_scores ms join skills k on k.id = ms.skill_id where ms.user_id = $1 and k.subtopic_id = $2 and ms.c is not null`, [userId, subtopicId]);
  return { candidates: { questions, lessons, conceptActivities: concepts, flashcardsDue: due!.n }, comprehension: c?.c ? Number(c.c) : null };
}

/** Monta (sem iniciar) a sessão recomendada ou escolhida livremente (4.4/4.6). */
export async function createSession(userId: string, input: { recommendationId?: string; subtopicId?: string; focus?: Focus }) {
  return asService(async (tx) => {
    const { version, params } = await engineParams(tx);
    let subtopicId: string, category, focus: Focus, level, relevance, recommendationId: string | null = null, origin: 'recommendation' | 'free_choice';
    if (input.recommendationId) {
      const rec = await one<{ subtopic_id: string; category: string; focus: Focus; factors: { level: string } }>(
        tx, `select subtopic_id, category, focus, factors from recommendations where id = $1 and user_id = $2 and status in ('active','accepted')`, [input.recommendationId, userId]);
      if (!rec) throw notFound('Recomendação');
      subtopicId = rec.subtopic_id; recommendationId = input.recommendationId; origin = 'recommendation';
      const snap = (await buildSnapshots(tx, userId)).find((s) => s.subtopicId === subtopicId)!;
      const pr = computePriority(snap, { daysToExam: null }, params);
      category = rec.category as typeof pr.category; focus = rec.focus; level = pr.level; relevance = snap.relevance;
    } else if (input.subtopicId) {
      const snap = (await buildSnapshots(tx, userId)).find((s) => s.subtopicId === input.subtopicId);
      if (!snap) throw notFound('Conteúdo');
      const pr = computePriority(snap, { daysToExam: null }, params);
      subtopicId = input.subtopicId; category = pr.category; focus = input.focus ?? pr.focus; level = pr.level; relevance = snap.relevance; origin = 'free_choice';
    } else {
      throw new AppError(400, 'bad_request', 'Informe uma recomendação ou um conteúdo.');
    }
    const { candidates, comprehension } = await candidatesFor(tx, userId, subtopicId);
    const plan = planSession({ focus, category, level, relevance, subtopicId, comprehension, candidates, params });
    // Falta de itens oficiais inéditos (2.12): gêmeas aprovadas inéditas; senão, solicitação à fila.
    if (plan.shortfall.questions > 0 && ['transfer', 'retention', 'maintenance'].includes(focus)) {
      const twins = await tx.query<{ id: string }>(
        `select t.id from twin_questions t join skills k on k.id = t.skill_id where k.subtopic_id = $1 and t.status = 'approved'
           and not exists (select 1 from attempts a where a.user_id = $2 and a.twin_question_id = t.id) order by t.approved_at limit $3`,
        [subtopicId, userId, plan.shortfall.questions]);
      for (const t of twins) plan.activities.push({ activityType: 'question', refType: 'twin' as never, refId: t.id });
      plan.shortfall.questions -= twins.length;
      if (plan.shortfall.questions > 0) {
        const origin = await one<{ question_id: string }>(tx,
          `select a.question_id from attempts a join questions q on q.id = a.question_id where a.user_id = $1 and q.primary_subtopic_id = $2 order by a.submitted_at desc limit 1`, [userId, subtopicId]);
        if (origin) await findEquivalent(tx, userId, origin.question_id);
      }
    }
    if (!plan.activities.length) throw new AppError(422, 'no_activities', 'Ainda não há atividades publicadas para este conteúdo.', { alternatives: plan.alternatives });
    const [s] = await tx.query<{ id: string }>(
      `insert into study_sessions (user_id, recommendation_id, subtopic_id, category, focus, origin, plan, rule_version)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [userId, recommendationId, subtopicId, category, focus, origin, JSON.stringify(plan), version]);
    for (const [i, a] of plan.activities.entries()) {
      await tx.query(`insert into session_activities (session_id, position, activity_type, ref_type, ref_id, result) values ($1,$2,$3,$4,$5,$6)`,
        [s!.id, i + 1, a.activityType, a.refType, a.refId, a.meta ? JSON.stringify({ meta: a.meta }) : null]);
    }
    return getSession(tx, userId, s!.id);
  });
}

export async function getSession(tx: Tx, userId: string, sessionId: string) {
  const s = await one<{ id: string; status: string; category: string; focus: string; plan: unknown; current_index: number; subtopic_id: string; subtopic_name: string; created_at: Date; started_at: Date | null; completed_at: Date | null }>(
    tx, `select s.id, s.status, s.category, s.focus, s.plan, s.current_index, s.subtopic_id, st.name as subtopic_name, s.created_at, s.started_at, s.completed_at
           from study_sessions s left join subtopics st on st.id = s.subtopic_id where s.id = $1 and s.user_id = $2`, [sessionId, userId]);
  if (!s) throw notFound('Sessão');
  const activities = await tx.query<{ id: string; position: number; activity_type: string; ref_type: string; ref_id: string | null; status: string; result: unknown; title: string | null }>(
    `select sa.id, sa.position, sa.activity_type, sa.ref_type, sa.ref_id, sa.status, sa.result,
            coalesce(l.title, case sa.activity_type when 'question' then 'Questão' when 'concept_activity' then 'Explicação ativa' when 'flashcards' then 'Flashcards' else null end) as title
       from session_activities sa left join lessons l on l.id = sa.ref_id and sa.ref_type = 'lesson'
      where sa.session_id = $1 order by sa.position`, [sessionId]);
  return { ...s, activities };
}

/** Ajuste antes do início (5.8): o aluno pode remover atividades; depois do início, nunca muda. */
export async function removePlannedActivity(userId: string, sessionId: string, position: number) {
  return asService(async (tx) => {
    const s = await one<{ status: string }>(tx, 'select status from study_sessions where id = $1 and user_id = $2', [sessionId, userId]);
    if (!s) throw notFound('Sessão');
    if (s.status !== 'planned') throw conflict('A composição não pode ser alterada após o início da sessão.', 'session_frozen');
    const [n] = await tx.query<{ n: number }>('select count(*)::int as n from session_activities where session_id = $1', [sessionId]);
    if (n!.n <= 1) throw conflict('A sessão precisa de pelo menos uma atividade.');
    await tx.query('delete from session_activities where session_id = $1 and position = $2', [sessionId, position]);
    const plan = await one<{ plan: { activities: unknown[] } }>(tx, 'select plan from study_sessions where id = $1', [sessionId]);
    const remaining = await tx.query<{ activity_type: string; ref_type: string; ref_id: string | null }>(
      'select activity_type, ref_type, ref_id from session_activities where session_id = $1 order by position', [sessionId]);
    await tx.query('update study_sessions set plan = $2 where id = $1', [sessionId, JSON.stringify({ ...plan!.plan, activities: remaining, customized: true })]);
    return getSession(tx, userId, sessionId);
  });
}

export async function startSession(userId: string, sessionId: string) {
  const s = await asService((tx) => one<{ status: string; recommendation_id: string | null }>(tx, 'select status, recommendation_id from study_sessions where id = $1 and user_id = $2', [sessionId, userId]));
  if (!s) throw notFound('Sessão');
  if (s.status === 'planned') await consumeQuota(userId, 'adaptive_sessions', `session:${sessionId}`);
  return asService(async (tx) => {
    await tx.query(`update study_sessions set status = 'in_progress', started_at = coalesce(started_at, now()), paused_at = null where id = $1 and status in ('planned','paused')`, [sessionId]);
    if (s.recommendation_id) await tx.query(`update recommendations set status = 'accepted' where id = $1 and status = 'active'`, [s.recommendation_id]);
    return getSession(tx, userId, sessionId);
  });
}

export async function pauseSession(userId: string, sessionId: string) {
  return asService(async (tx) => {
    await tx.query(`update study_sessions set status = 'paused', paused_at = now() where id = $1 and user_id = $2 and status = 'in_progress'`, [sessionId, userId]);
    return getSession(tx, userId, sessionId);
  });
}

async function maybeComplete(tx: Tx, sessionId: string) {
  const [p] = await tx.query<{ n: number }>(`select count(*)::int as n from session_activities where session_id = $1 and status = 'pending'`, [sessionId]);
  if (p!.n === 0) {
    await tx.query(`update study_sessions set status = 'completed', completed_at = now() where id = $1 and status in ('in_progress','paused')`, [sessionId]);
    await tx.query(`update recommendations set status = 'completed' where id = (select recommendation_id from study_sessions where id = $1) and status = 'accepted'`, [sessionId]);
  } else {
    await tx.query(`update study_sessions set current_index = (select min(position) from session_activities where session_id = $1 and status = 'pending') where id = $1`, [sessionId]);
  }
}

async function activityFor(tx: Tx, userId: string, sessionId: string, position: number) {
  const a = await one<{ id: string; activity_type: string; ref_type: string; ref_id: string | null; status: string; session_status: string }>(
    tx, `select sa.id, sa.activity_type, sa.ref_type, sa.ref_id, sa.status, s.status as session_status from session_activities sa join study_sessions s on s.id = sa.session_id
          where s.id = $1 and s.user_id = $2 and sa.position = $3`, [sessionId, userId, position]);
  if (!a) throw notFound('Atividade');
  if (a.session_status !== 'in_progress') throw conflict('Inicie ou retome a sessão para continuar.', 'session_not_active');
  return a;
}

/** Questão da sessão: correção após envio, evidência idêntica à do estudo livre (A.3.1). */
export async function answerSessionQuestion(userId: string, sessionId: string, position: number, input: { selected: 'A' | 'B' | 'C' | 'D' | 'E'; timeSpentMs?: number; confidence?: 1 | 2 | 3; eliminated?: string[] }) {
  return asService(async (tx) => {
    const a = await activityFor(tx, userId, sessionId, position);
    if (a.activity_type !== 'question' || !a.ref_id) throw conflict('Atividade não é uma questão.');
    if (a.ref_type === 'twin') {
      const t = await answerTwinTx(tx, userId, a.ref_id, input.selected, `session:${sessionId}:${position}`);
      await tx.query(`update session_activities set status = 'completed', completed_at = now(), result = $2 where id = $1 and status = 'pending'`, [a.id, JSON.stringify({ isCorrect: t.isCorrect, twin: true })]);
      await maybeComplete(tx, sessionId);
      return { ...t, attemptId: null, annulled: false, isFirstExposure: true, cpeEligible: false, classificationOffered: false, masteryState: null, duplicate: false };
    }
    const r = await processQuestionAnswer(tx, { userId, questionId: a.ref_id, selected: input.selected, mode: 'session', source: 'session', contextId: sessionId,
      idempotencyKey: `session:${sessionId}:${position}`, timeSpentMs: input.timeSpentMs, confidence: input.confidence, eliminated: input.eliminated });
    const sol = await one<{ body_md: string }>(tx, `select body_md from question_solutions where question_id = $1 and validation_status = 'validated' order by version desc limit 1`, [a.ref_id]);
    await tx.query(`update session_activities set status = 'completed', completed_at = now(), result = $2 where id = $1 and status = 'pending'`,
      [a.id, JSON.stringify({ attemptId: r.attemptId, isCorrect: r.isCorrect })]);
    await maybeComplete(tx, sessionId);
    return { ...r, solution: sol?.body_md ?? null };
  });
}

/** Marca atividades não-questão como concluídas (aula lida, flashcards revisados, explicação enviada) ou puladas. */
export async function completeActivity(userId: string, sessionId: string, position: number, outcome: 'completed' | 'skipped', result?: Record<string, unknown>) {
  return asService(async (tx) => {
    const a = await activityFor(tx, userId, sessionId, position);
    if (a.activity_type === 'question' && outcome === 'completed') throw conflict('Responda a questão para concluí-la.');
    await tx.query(`update session_activities set status = $2, completed_at = now(), result = coalesce(result, '{}'::jsonb) || $3::jsonb where id = $1 and status = 'pending'`,
      [a.id, outcome, JSON.stringify(result ?? {})]);
    await maybeComplete(tx, sessionId);
    return getSession(tx, userId, sessionId);
  });
}

export async function abandonSession(userId: string, sessionId: string) {
  return asService(async (tx) => {
    await tx.query(`update study_sessions set status = 'abandoned' where id = $1 and user_id = $2 and status in ('planned','in_progress','paused')`, [sessionId, userId]);
    return { ok: true };
  });
}

export async function resumableSession(tx: Tx, userId: string) {
  return one<{ id: string; status: string; subtopic_name: string; done: number; total: number }>(tx,
    `select s.id, s.status, st.name as subtopic_name,
            (select count(*)::int from session_activities sa where sa.session_id = s.id and sa.status <> 'pending') as done,
            (select count(*)::int from session_activities sa where sa.session_id = s.id) as total
       from study_sessions s left join subtopics st on st.id = s.subtopic_id
      where s.user_id = $1 and s.status in ('in_progress','paused') order by coalesce(s.paused_at, s.started_at) desc limit 1`, [userId]);
}
