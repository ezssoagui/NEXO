import { z } from 'zod';
import { deriveConceptEvidence, deriveFlashcardEvidence } from '@/modules/mastery/evidence';
import { conceptEvalSchema, wrapData } from '@/modules/ai/prompts';
import { scrubPII } from '@/modules/ai/pii';
import { FSRS_VERSION, newCard, reviewCard, type StoredCard, type UserRating } from '@/modules/flashcards/fsrs';
import { localDate } from '@/modules/quotas/period';
import type { PlanCode } from '@/modules/subscriptions/state';
import { asService } from '@/server/db';
import { one, type Tx } from '@/server/db/types';
import { AppError, notFound } from '@/server/http/errors';
import { runAi } from './ai';
import { awardXp, checkAchievements, consumeQuota, engineParams, finalizeQuota, markStudyDay, reserveQuota, setting, userPlan, withQuotaRollback } from './core';
import { applyEvidence, recordLearningEvent, skillHistory } from './learning';

// ---------------------------------------------------------------------------
// Aulas e microaulas (5.1). Leitura não comprova domínio: só registra evento e XP.
// ---------------------------------------------------------------------------
export async function lessonAccessible(tx: Tx, plan: PlanCode, lesson: { kind: string; is_free: boolean }): Promise<boolean> {
  if (plan !== 'free') return true;
  const policy = await setting<{ mode: string }>(tx, 'free_lessons_policy', { mode: 'flagged_lessons' });
  if (policy.mode === 'all') return true;
  // Proposta (A.2): no Gratuito, microaulas/resumos/exemplos liberados; aulas completas somente se marcadas como gratuitas.
  return lesson.kind !== 'lesson' || lesson.is_free;
}

export async function listLessons(tx: Tx, userId: string, subtopicId: string) {
  const { plan } = await userPlan(tx, userId);
  const rows = await tx.query<{ id: string; title: string; kind: string; is_free: boolean; estimated_minutes: number | null; is_synthetic: boolean; read: boolean }>(
    `select l.id, l.title, l.kind, l.is_free, l.estimated_minutes, l.is_synthetic,
            exists (select 1 from lesson_reads r where r.user_id = $1 and r.lesson_id = l.id and r.completed_at is not null) as read
       from lessons l where l.subtopic_id = $2 and l.status = 'published' order by l.kind, l.title`, [userId, subtopicId]);
  return Promise.all(rows.map(async (r) => ({ ...r, accessible: await lessonAccessible(tx, plan, r) })));
}

export async function getLesson(tx: Tx, userId: string, lessonId: string) {
  const l = await one<{ id: string; title: string; kind: string; is_free: boolean; subtopic_id: string; subtopic_name: string; is_synthetic: boolean; status: string; estimated_minutes: number | null }>(
    tx, `select l.id, l.title, l.kind, l.is_free, l.subtopic_id, st.name as subtopic_name, l.is_synthetic, l.status, l.estimated_minutes
           from lessons l join subtopics st on st.id = l.subtopic_id where l.id = $1`, [lessonId]);
  if (!l || l.status !== 'published') throw notFound('Aula');
  const { plan } = await userPlan(tx, userId);
  if (!(await lessonAccessible(tx, plan, l))) {
    throw new AppError(402, 'plan_required', 'Esta aula completa faz parte dos planos Plus e Pro. Microaulas e resumos continuam disponíveis.');
  }
  const blocks = await tx.query<{ position: number; block_type: string; body_md: string; asset_key: string | null }>(
    'select position, block_type, body_md, asset_key from lesson_blocks where lesson_id = $1 order by position', [lessonId]);
  await tx.query(`insert into lesson_reads (user_id, lesson_id) values ($1,$2)
    on conflict (user_id, lesson_id) do update set last_read_at = now(), read_count = lesson_reads.read_count + 1`, [userId, lessonId]);
  return { ...l, blocks };
}

export async function completeLesson(userId: string, lessonId: string) {
  return asService(async (tx) => {
    const l = await one<{ kind: string }>(tx, `select kind from lessons where id = $1 and status = 'published'`, [lessonId]);
    if (!l) throw notFound('Aula');
    await tx.query(`insert into lesson_reads (user_id, lesson_id, completed_at) values ($1,$2, now())
      on conflict (user_id, lesson_id) do update set completed_at = coalesce(lesson_reads.completed_at, now())`, [userId, lessonId]);
    await recordLearningEvent(tx, { userId, eventType: 'lesson_read', source: 'free', idempotencyKey: `lesson:${lessonId}:${localDate(new Date())}`, entityType: 'lesson', entityId: lessonId });
    const xp = await awardXp(tx, userId, l.kind === 'lesson' ? 'lesson' : 'microlesson', `lesson:${lessonId}`);
    await markStudyDay(tx, userId);
    return { xp };
  });
}

// ---------------------------------------------------------------------------
// Explicação ativa (2.5/5.4/7.4): resposta sem ajuda; avaliação após envio; franquia transacional.
// ---------------------------------------------------------------------------
export async function getConceptActivity(tx: Tx, activityId: string) {
  const a = await one<{ id: string; kind: string; prompt_md: string; skill_name: string; subtopic_name: string; is_synthetic: boolean }>(
    tx, `select ca.id, ca.kind, ca.prompt_md, k.name as skill_name, st.name as subtopic_name, ca.is_synthetic
           from concept_activities ca join skills k on k.id = ca.skill_id join subtopics st on st.id = k.subtopic_id
          where ca.id = $1 and ca.status = 'published'`, [activityId]);
  if (!a) throw notFound('Atividade');
  return a; // sem resposta de referência antes do envio
}

const COMPLEX_KINDS = new Set(['cause_effect', 'justification', 'application']);

export async function submitConceptResponse(userId: string, input: { activityId: string; response: string; idempotencyKey: string; sessionActivityId?: string }) {
  const prep = await asService(async (tx) => {
    const a = await one<{ id: string; skill_id: string; kind: string; prompt_md: string; reference_answer_md: string; rubric_notes: string | null }>(
      tx, `select id, skill_id, kind, prompt_md, reference_answer_md, rubric_notes from concept_activities where id = $1 and status = 'published'`, [input.activityId]);
    if (!a) throw notFound('Atividade');
    const existing = await one<{ id: string; status: string }>(tx, 'select id, status from concept_responses where user_id = $1 and idempotency_key = $2', [userId, input.idempotencyKey]);
    if (existing && existing.status === 'evaluated') return { done: existing.id, a };
    const prof = await one<{ display_name: string }>(tx, 'select display_name from profiles where id = $1', [userId]);
    const mastery = await one<{ state: string; c: string | null }>(tx, 'select state, c from mastery_scores where user_id = $1 and skill_id = $2', [userId, a.skill_id]);
    const row = existing ?? (await tx.query<{ id: string }>(
      `insert into concept_responses (user_id, activity_id, session_activity_id, response_text, idempotency_key) values ($1,$2,$3,$4,$5) returning id`,
      [userId, a.id, input.sessionActivityId ?? null, input.response, input.idempotencyKey]))[0]!;
    return { done: null, id: row.id, a, name: prof?.display_name ?? '', mastery };
  });
  if (prep.done) return asService((tx) => conceptResult(tx, userId, prep.done!));

  const ticket = await reserveQuota(userId, 'explanations', `concept:${input.idempotencyKey}`);
  const scrubbed = scrubPII(input.response, { names: [prep.name ?? ''] }).text;
  const outcome = await runAi({
    purpose: 'concept_eval', userId, planCode: ticket.plan, requestId: `concept:${input.idempotencyKey}`, schema: conceptEvalSchema,
    modelPurposeOverride: COMPLEX_KINDS.has(prep.a.kind) ? 'mini' : 'nano',
    user: [
      wrapData('Atividade conceitual', prep.a.prompt_md),
      wrapData('Resposta de referência (apoio)', prep.a.reference_answer_md + (prep.a.rubric_notes ? `\nNotas da rubrica: ${prep.a.rubric_notes}` : '')),
      `Contexto pedagógico (sem dados pessoais): estado atual da habilidade = ${prep.mastery?.state ?? 'não avaliado'}.`,
      wrapData('Resposta do estudante', scrubbed),
    ].join('\n\n'),
  });
  if (!outcome.ok) {
    await asService(async (tx) => {
      await finalizeQuota(ticket, false, tx);
      await tx.query(`update concept_responses set status = 'failed' where id = $1`, [prep.id]);
    });
    throw new AppError(503, outcome.reason, outcome.message);
  }
  return withQuotaRollback(ticket, () => asService(async (tx) => {
    const ev = outcome.value;
    await tx.query(`update concept_responses set status = 'evaluated', score = $2, feedback = $3, ai_usage_id = $4, evaluated_at = now() where id = $1`,
      [prep.id, ev.score, JSON.stringify(ev), outcome.usageId]);
    const event = await recordLearningEvent(tx, { userId, eventType: 'concept_response', source: input.sessionActivityId ? 'session' : 'free',
      idempotencyKey: `concept:${input.idempotencyKey}`, entityType: 'concept_activity', entityId: prep.a.id, payload: { score: ev.score } });
    if (event.created) {
      const { params } = await engineParams(tx);
      const history = await skillHistory(tx, userId, prep.a.skill_id);
      await applyEvidence(tx, userId, event.id, deriveConceptEvidence({ skillId: prep.a.skill_id, activityId: prep.a.id, rubric: ev.score as 0 | 1 | 2 | 3, history, at: new Date(), params }), new Date());
    }
    await finalizeQuota(ticket, true, tx);
    await awardXp(tx, userId, 'concept_explanation', `concept:${prep.id}`);
    await markStudyDay(tx, userId);
    return conceptResult(tx, userId, prep.id!);
  }));
}

async function conceptResult(tx: Tx, userId: string, responseId: string) {
  const r = await one<{ id: string; score: number | null; feedback: unknown; status: string; reference_answer_md: string }>(
    tx, `select cr.id, cr.score, cr.feedback, cr.status, ca.reference_answer_md from concept_responses cr join concept_activities ca on ca.id = cr.activity_id
          where cr.id = $1 and cr.user_id = $2`, [responseId, userId]);
  if (!r) throw notFound('Resposta');
  return r;
}

// ---------------------------------------------------------------------------
// Flashcards (5.6/15.7)
// ---------------------------------------------------------------------------
export async function listDecks(tx: Tx, userId: string, subtopicId?: string) {
  return tx.query(
    `select d.id, d.title, d.kind, d.owner_id is not null as personal, st.name as subtopic, d.is_synthetic,
            (select count(*)::int from flashcards f where f.deck_id = d.id and f.status = 'published') as cards,
            (select count(*)::int from flashcards f left join card_states cs on cs.flashcard_id = f.id and cs.user_id = $1
              where f.deck_id = d.id and f.status = 'published' and (cs.due is null or cs.due <= now())) as due
       from decks d left join subtopics st on st.id = d.subtopic_id
      where d.status = 'published' and (d.owner_id is null or d.owner_id = $1) and ($2::uuid is null or d.subtopic_id = $2)
      order by d.owner_id is null, d.title limit 300`, [userId, subtopicId ?? null]);
}

/** Fila de revisão: vencidos primeiro, depois novos (seleção automática de cartões relevantes). */
export async function dueCards(tx: Tx, userId: string, opts: { deckId?: string; subtopicId?: string; limit: number }) {
  return tx.query<{ id: string; front_md: string; back_md: string; deck_title: string; is_new: boolean }>(
    `select f.id, f.front_md, f.back_md, d.title as deck_title, cs.flashcard_id is null as is_new
       from flashcards f join decks d on d.id = f.deck_id
       left join card_states cs on cs.flashcard_id = f.id and cs.user_id = $1
      where f.status = 'published' and d.status = 'published' and (d.owner_id is null or d.owner_id = $1)
        and ($2::uuid is null or d.id = $2) and ($3::uuid is null or d.subtopic_id = $3)
        and (cs.due is null or cs.due <= now())
      order by cs.due nulls last, f.id limit $4`, [userId, opts.deckId ?? null, opts.subtopicId ?? null, opts.limit]);
}

export async function reviewFlashcard(userId: string, input: { cardId: string; rating: UserRating; idempotencyKey: string }) {
  const card = await asService((tx) => one<{ id: string; skill_id: string | null }>(tx,
    `select f.id, f.skill_id from flashcards f join decks d on d.id = f.deck_id where f.id = $1 and f.status = 'published' and (d.owner_id is null or d.owner_id = $2)`, [input.cardId, userId]));
  if (!card) throw notFound('Cartão');
  const already = await asService((tx) => one(tx, 'select 1 from review_logs where user_id = $1 and idempotency_key = $2', [userId, input.idempotencyKey]));
  if (already) return { duplicate: true };
  await consumeQuota(userId, 'flashcards', `fc:${input.idempotencyKey}`);
  return asService(async (tx) => {
    const now = new Date();
    const st = await one<{ card: StoredCard }>(tx, 'select card from card_states where user_id = $1 and flashcard_id = $2 for update', [userId, input.cardId]);
    const current = st?.card ?? (await newCard(now));
    const out = await reviewCard(current, input.rating, now);
    await tx.query(
      `insert into card_states (user_id, flashcard_id, due, state, stability, difficulty, reps, lapses, last_review, card, fsrs_version)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (user_id, flashcard_id) do update set due = excluded.due, state = excluded.state, stability = excluded.stability, difficulty = excluded.difficulty,
         reps = excluded.reps, lapses = excluded.lapses, last_review = excluded.last_review, card = excluded.card, fsrs_version = excluded.fsrs_version`,
      [userId, input.cardId, new Date(out.card.dueAt), out.card.state, out.card.stability, out.card.difficulty, out.card.reps, out.card.lapses, now, JSON.stringify(out.card), FSRS_VERSION]);
    const ratingValue = { again: 1, hard: 2, good: 3, easy: 4 }[input.rating] as 1 | 2 | 3 | 4;
    await tx.query(
      `insert into review_logs (user_id, flashcard_id, rating, state_before, elapsed_days, scheduled_days, due_after, reviewed_at, revlog, idempotency_key, fsrs_version)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (user_id, idempotency_key) do nothing`,
      [userId, input.cardId, ratingValue, out.stateBefore, out.elapsedDays, out.card.scheduledDays, new Date(out.card.dueAt), now, JSON.stringify(out.revlog), input.idempotencyKey, FSRS_VERSION]);
    const ev = await recordLearningEvent(tx, { userId, eventType: 'flashcard_review', source: 'review', idempotencyKey: `fc:${input.idempotencyKey}`, entityType: 'flashcard', entityId: input.cardId, payload: { rating: ratingValue } });
    if (ev.created) {
      const { params } = await engineParams(tx);
      const derived = deriveFlashcardEvidence({ skillId: card.skill_id, cardId: input.cardId, rating: ratingValue, elapsedDaysSinceLastReview: out.elapsedDays, params });
      if (derived.length) await applyEvidence(tx, userId, ev.id, derived, now);
    }
    await awardXp(tx, userId, 'flashcard', `flashcard:${input.cardId}:${localDate(now)}`);
    await markStudyDay(tx, userId, now);
    await checkAchievements(tx, userId);
    return { due: out.card.dueAt, state: out.card.state };
  });
}

export const personalCardSchema = z.object({ deckId: z.string().uuid().optional(), deckTitle: z.string().min(1).max(120).optional(), front: z.string().min(1).max(2000), back: z.string().min(1).max(4000) });

export async function createPersonalCard(userId: string, input: z.infer<typeof personalCardSchema>) {
  return asService(async (tx) => {
    let deckId = input.deckId;
    if (deckId) {
      const own = await one(tx, `select 1 from decks where id = $1 and owner_id = $2`, [deckId, userId]);
      if (!own) throw notFound('Baralho');
    } else {
      const [d] = await tx.query<{ id: string }>(`insert into decks (owner_id, title, kind, status) values ($1,$2,'personal','published') returning id`, [userId, input.deckTitle ?? 'Meus cartões']);
      deckId = d!.id;
    }
    const [c] = await tx.query<{ id: string }>(`insert into flashcards (deck_id, owner_id, front_md, back_md, origin, status) values ($1,$2,$3,$4,'user','published') returning id`,
      [deckId, userId, input.front, input.back]);
    return { deckId, cardId: c!.id };
  });
}

// ---------------------------------------------------------------------------
// Revisões curriculares pendentes (5.10) e materiais montados (5.11/2.11)
// ---------------------------------------------------------------------------
export async function dueReviews(tx: Tx, userId: string) {
  return tx.query(
    `select rs.skill_id, k.name as skill, st.id as subtopic_id, st.name as subtopic, rs.due_at, rs.interval_days, ms.state
       from review_schedules rs join skills k on k.id = rs.skill_id join subtopics st on st.id = k.subtopic_id
       left join mastery_scores ms on ms.user_id = rs.user_id and ms.skill_id = rs.skill_id
      where rs.user_id = $1 and rs.due_at <= now() + interval '1 day' order by rs.due_at limit 100`, [userId]);
}

export async function assembleMaterial(userId: string, input: { scope: 'subtopic' | 'subject' | 'area' | 'final_review'; ref?: string }) {
  return asService(async (tx) => {
    let subtopicIds: string[];
    let title: string;
    if (input.scope === 'final_review') {
      // Reta final: conteúdos já estudados de maior relevância e erros recorrentes (sem geração por IA).
      const rows = await tx.query<{ id: string }>(
        `select distinct st.id from mastery_scores ms join skills k on k.id = ms.skill_id join subtopics st on st.id = k.subtopic_id
          where ms.user_id = $1 and ms.state <> 'not_assessed'
          order by st.id limit 40`, [userId]);
      subtopicIds = rows.map((r) => r.id);
      title = 'Revisão final personalizada';
    } else if (input.scope === 'subtopic') {
      subtopicIds = [input.ref!];
      const s = await one<{ name: string }>(tx, 'select name from subtopics where id = $1', [input.ref]);
      if (!s) throw notFound('Conteúdo');
      title = `Resumo — ${s.name}`;
    } else {
      const col = input.scope === 'subject' ? 't.subject_id' : 's.area_code';
      const rows = await tx.query<{ id: string }>(
        `select st.id from subtopics st join topics t on t.id = st.topic_id join subjects s on s.id = t.subject_id where ${col}::text = $1`, [input.ref]);
      subtopicIds = rows.map((r) => r.id);
      title = input.scope === 'subject' ? 'Resumo da disciplina' : `Resumo da área ${input.ref}`;
    }
    const blocks = await tx.query<{ id: string; subtopic: string; block_type: string; body_md: string }>(
      `select b.id, st.name as subtopic, b.block_type, b.body_md from lesson_blocks b join lessons l on l.id = b.lesson_id join subtopics st on st.id = l.subtopic_id
        where l.status = 'published' and l.subtopic_id = any($1::uuid[]) and (b.block_type in ('key_point','summary_point','formula') or b.is_final_review)
        order by st.code, l.title, b.position limit 400`, [subtopicIds]);
    const errors = await tx.query<{ question_id: string; subtopic: string; attempts_count: number }>(
      `select e.question_id, st.name as subtopic, e.attempts_count from error_entries e join subtopics st on st.id = e.subtopic_id
        where e.user_id = $1 and e.recovery_status <> 'overcome' and e.subtopic_id = any($2::uuid[]) order by e.attempts_count desc limit 30`, [userId, subtopicIds]);
    const gaps = await tx.query<{ name: string }>(
      `select st.name from subtopics st where st.id = any($1::uuid[]) and not exists (select 1 from lessons l where l.subtopic_id = st.id and l.status = 'published') limit 50`, [subtopicIds]);
    const composition = { blockIds: blocks.map((b) => b.id), errorQuestionIds: errors.map((e) => e.question_id), gaps: gaps.map((g) => g.name) };
    const [m] = await tx.query<{ id: string }>(
      `insert into study_materials (user_id, scope, scope_ref, title, composition) values ($1,$2,$3,$4,$5) returning id`,
      [userId, input.scope, input.ref ?? null, title, JSON.stringify(composition)]);
    return { id: m!.id, title, blocks, errors, gaps: composition.gaps };
  });
}

export async function getMaterial(tx: Tx, userId: string, id: string) {
  const m = await one<{ id: string; title: string; scope: string; composition: { blockIds: string[]; errorQuestionIds: string[]; gaps: string[] }; created_at: Date }>(
    tx, 'select id, title, scope, composition, created_at from study_materials where id = $1 and user_id = $2', [id, userId]);
  if (!m) throw notFound('Material');
  const blocks = await tx.query(`select b.id, st.name as subtopic, b.block_type, b.body_md from lesson_blocks b join lessons l on l.id = b.lesson_id
    join subtopics st on st.id = l.subtopic_id where b.id = any($1::uuid[]) order by st.code, b.position`, [m.composition.blockIds]);
  return { ...m, blocks };
}

// ---------------------------------------------------------------------------
// Busca global (5.14): metadados armazenados, sem IA.
// ---------------------------------------------------------------------------
export async function globalSearch(tx: Tx, userId: string, q: string) {
  const like = `%${q.trim()}%`;
  const ts = q.trim();
  const [subtopics, lessons, questions, cards, errors] = await Promise.all([
    tx.query(`select st.id, st.name, t.name as topic from subtopics st join topics t on t.id = st.topic_id
      where st.verification_status <> 'retired' and (st.search_tsv @@ websearch_to_tsquery('portuguese', $1) or st.name ilike $2) order by st.name limit 8`, [ts, like]),
    tx.query(`select l.id, l.title, l.kind from lessons l where l.status = 'published' and (l.search_tsv @@ websearch_to_tsquery('portuguese', $1) or l.title ilike $2) limit 8`, [ts, like]),
    tx.query(`select q.id, q.area_code, q.year, left(regexp_replace(q.statement_md, '\\s+', ' ', 'g'), 140) as snippet from questions q
      where q.publication_status = 'published' and (q.search_tsv @@ websearch_to_tsquery('portuguese', $1) or q.statement_md ilike $2) limit 8`, [ts, like]),
    tx.query(`select f.id, left(f.front_md, 120) as front, d.id as deck_id from flashcards f join decks d on d.id = f.deck_id
      where f.status = 'published' and (d.owner_id is null or d.owner_id = $3) and (f.search_tsv @@ websearch_to_tsquery('portuguese', $1) or f.front_md ilike $2) limit 8`, [ts, like, userId]),
    tx.query(`select e.id, e.question_id, left(regexp_replace(q.statement_md, '\\s+', ' ', 'g'), 120) as snippet from error_entries e join questions q on q.id = e.question_id
      where e.user_id = $3 and (q.search_tsv @@ websearch_to_tsquery('portuguese', $1) or q.statement_md ilike $2) limit 8`, [ts, like, userId]),
  ]);
  return { subtopics, lessons, questions, flashcards: cards, errors };
}
