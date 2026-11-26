import { computeMastery, type Evidence, type MasteryResult } from '@/modules/mastery/compute';
import { deriveQuestionEvidence, type DerivedEvidence, type SkillHistory } from '@/modules/mastery/evidence';
import type { Difficulty, Relevance } from '@/modules/mastery/params';
import { nextReview } from '@/modules/reviews/schedule';
import { proximityMultiplier } from '@/modules/adaptive-engine/priority';
import { cpeEligible, errorClassificationOffered } from '@/modules/questions/rules';
import { localDate } from '@/modules/quotas/period';
import { one, type Tx } from '@/server/db/types';
import { AppError } from '@/server/http/errors';
import { awardXp, checkAchievements, engineParams, markStudyDay, setting } from './core';

export type EventSource = 'free' | 'session' | 'list' | 'exam' | 'diagnostic' | 'review';

export async function recordLearningEvent(tx: Tx, e: {
  userId: string; eventType: string; source: EventSource; idempotencyKey: string;
  entityType?: string; entityId?: string | null; payload?: Record<string, unknown>; at?: Date;
}): Promise<{ id: string; created: boolean }> {
  const ins = await tx.query<{ id: string }>(
    `insert into learning_events (user_id, event_type, source, idempotency_key, entity_type, entity_id, payload, occurred_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (user_id, idempotency_key) do nothing returning id`,
    [e.userId, e.eventType, e.source, e.idempotencyKey, e.entityType ?? null, e.entityId ?? null, JSON.stringify(e.payload ?? {}), e.at ?? new Date()]);
  if (ins[0]) return { id: ins[0].id, created: true };
  const ex = await one<{ id: string }>(tx, 'select id from learning_events where user_id = $1 and idempotency_key = $2', [e.userId, e.idempotencyKey]);
  return { id: ex!.id, created: false };
}

export async function skillHistory(tx: Tx, userId: string, skillId: string): Promise<SkillHistory> {
  const r = await one<{ first: Date | null; last: Date | null }>(
    tx, 'select min(occurred_at) as first, max(occurred_at) as last from skill_evidence where user_id = $1 and skill_id = $2', [userId, skillId]);
  return { firstEvidenceAt: r?.first ?? null, lastEvidenceAt: r?.last ?? null };
}

async function daysToExam(tx: Tx, userId: string, now: Date): Promise<number | null> {
  const prof = await one<{ enem_target_year: number }>(tx, 'select enem_target_year from profiles where id = $1', [userId]);
  const dates = await setting<Record<string, { day1?: string }>>(tx, 'enem_exam_dates', {});
  const d1 = prof ? dates[String(prof.enem_target_year)]?.day1 : undefined;
  return d1 ? Math.ceil((Date.parse(d1) - now.getTime()) / 86_400_000) : null;
}

export async function recomputeSkill(tx: Tx, userId: string, skillId: string, eventId: string | null): Promise<MasteryResult> {
  const { version, params } = await engineParams(tx);
  const rows = await tx.query<{ dimension: Evidence['dimension']; score: string; difficulty: Difficulty | null; independence: Evidence['independence']; item_key: string; occurred_at: Date }>(
    'select dimension, score, difficulty, independence, item_key, occurred_at from skill_evidence where user_id = $1 and skill_id = $2', [userId, skillId]);
  const rel = await one<{ relevance: Relevance }>(tx, 'select st.relevance from skills k join subtopics st on st.id = k.subtopic_id where k.id = $1', [skillId]);
  const avail = await tx.query<{ difficulty: Difficulty | null; n: number }>(
    `select difficulty, count(*)::int as n from questions where primary_skill_id = $1 and publication_status = 'published' and not is_annulled group by difficulty`, [skillId]);
  const available: Partial<Record<Difficulty, number>> = { easy: 0, medium: 0, hard: 0 };
  for (const a of avail) available[a.difficulty ?? 'medium'] = (available[a.difficulty ?? 'medium'] ?? 0) + a.n;
  const result = computeMastery(
    rows.map((r) => ({ dimension: r.dimension, score: Number(r.score), difficulty: r.difficulty, independence: r.independence, itemKey: r.item_key, occurredAt: new Date(r.occurred_at) })),
    params, rel?.relevance ?? 'unknown', available,
  );
  const prev = await one<{ d: string | null; state: string }>(tx, 'select d, state from mastery_scores where user_id = $1 and skill_id = $2', [userId, skillId]);
  await tx.query(
    `insert into mastery_scores (user_id, skill_id, r, c, t, m, d, state, evidence_count, details, rule_version, computed_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
     on conflict (user_id, skill_id) do update set r = excluded.r, c = excluded.c, t = excluded.t, m = excluded.m, d = excluded.d,
       state = excluded.state, evidence_count = excluded.evidence_count, details = excluded.details, rule_version = excluded.rule_version, computed_at = now()`,
    [userId, skillId, result.r, result.c, result.t, result.m, result.d, result.state, result.evidenceCount, JSON.stringify(result.details), version]);
  if (!prev || prev.state !== result.state || Number(prev.d) !== result.d) {
    await tx.query('insert into mastery_history (user_id, skill_id, d, state, rule_version, learning_event_id) values ($1,$2,$3,$4,$5,$6)',
      [userId, skillId, result.d, result.state, version, eventId]);
  }
  return result;
}

export async function updateReviewSchedule(tx: Tx, userId: string, skillId: string, score: number, at: Date, eventId: string): Promise<void> {
  const { version, params } = await engineParams(tx);
  const cur = await one<{ due_at: Date; interval_days: string; ladder_index: number }>(
    tx, 'select due_at, interval_days, ladder_index from review_schedules where user_id = $1 and skill_id = $2', [userId, skillId]);
  const rel = await one<{ relevance: Relevance }>(tx, 'select st.relevance from skills k join subtopics st on st.id = k.subtopic_id where k.id = $1', [skillId]);
  const next = nextReview({
    current: cur ? { dueAt: new Date(cur.due_at), intervalDays: Number(cur.interval_days), ladderIndex: cur.ladder_index } : null,
    evidenceScore: score, at, relevance: rel?.relevance ?? 'unknown',
    proximityMultiplier: proximityMultiplier(await daysToExam(tx, userId, at), params), params,
  });
  if (next.satisfiedDue && cur) {
    // Estudo livre válido satisfaz a revisão pendente (5.10).
    await tx.query(
      `insert into review_evidence (user_id, skill_id, learning_event_id, satisfied_due_at, retention_score) values ($1,$2,$3,$4,$5) on conflict do nothing`,
      [userId, skillId, eventId, cur.due_at, score]);
  }
  await tx.query(
    `insert into review_schedules (user_id, skill_id, due_at, interval_days, ladder_index, last_evidence_at, reason, rule_version, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8, now())
     on conflict (user_id, skill_id) do update set due_at = excluded.due_at, interval_days = excluded.interval_days, ladder_index = excluded.ladder_index,
       last_evidence_at = excluded.last_evidence_at, reason = excluded.reason, rule_version = excluded.rule_version, updated_at = now()`,
    [userId, skillId, next.dueAt, next.intervalDays, next.ladderIndex, at, score >= params.reviews.successThreshold ? 'success' : 'reinforce', version]);
}

/** Grava evidências derivadas (dedupe por evento/habilidade/dimensão) e recalcula o perfil. */
export async function applyEvidence(tx: Tx, userId: string, eventId: string, derived: DerivedEvidence[], at: Date): Promise<Map<string, MasteryResult>> {
  const { version } = await engineParams(tx);
  for (const d of derived) {
    await tx.query(
      `insert into skill_evidence (user_id, skill_id, dimension, score, difficulty, independence, item_key, learning_event_id, rule_version, occurred_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (learning_event_id, skill_id, dimension) do nothing`,
      [userId, d.skillId, d.dimension, d.score, d.difficulty, d.independence, d.itemKey, eventId, version, at]);
  }
  const results = new Map<string, MasteryResult>();
  for (const skillId of new Set(derived.map((d) => d.skillId))) {
    results.set(skillId, await recomputeSkill(tx, userId, skillId, eventId));
    const main = derived.find((d) => d.skillId === skillId && d.dimension !== 'transfer')!;
    await updateReviewSchedule(tx, userId, skillId, main.score, at, eventId);
  }
  return results;
}

export interface AnswerInput {
  userId: string;
  questionId: string;
  selected: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  mode: 'single' | 'list' | 'session' | 'exam' | 'diagnostic';
  source: EventSource;
  contextId?: string | null;
  timeSpentMs?: number | null;
  confidence?: 1 | 2 | 3 | null;
  eliminated?: string[];
  idempotencyKey: string;
  at?: Date;
}

export interface AnswerResult {
  attemptId: string;
  isCorrect: boolean | null;
  correctAlternative: string | null;
  annulled: boolean;
  isFirstExposure: boolean;
  cpeEligible: boolean;
  classificationOffered: boolean;
  masteryState: string | null;
  duplicate: boolean;
}

/**
 * Pipeline único de resposta (A.3.1): o mesmo tipo de evidência em qualquer modo,
 * sem duplicação (idempotência por chave), com caderno de erros, revisões e XP.
 */
export async function processQuestionAnswer(tx: Tx, input: AnswerInput): Promise<AnswerResult> {
  const at = input.at ?? new Date();
  const q = await one<{ area_code: string; correct_alternative: string | null; difficulty: Difficulty | null; primary_skill_id: string | null; primary_subtopic_id: string | null; is_annulled: boolean; publication_status: string }>(
    tx, 'select area_code, correct_alternative, difficulty, primary_skill_id, primary_subtopic_id, is_annulled, publication_status from questions where id = $1', [input.questionId]);
  if (!q || q.publication_status !== 'published') throw new AppError(404, 'not_found', 'Questão não encontrada.');

  const event = await recordLearningEvent(tx, {
    userId: input.userId, eventType: 'question_answer', source: input.source, idempotencyKey: input.idempotencyKey,
    entityType: 'question', entityId: input.questionId, payload: { mode: input.mode, contextId: input.contextId ?? null }, at,
  });
  if (!event.created) {
    const prev = await one<{ id: string; is_correct: boolean | null; is_first_exposure: boolean }>(
      tx, 'select id, is_correct, is_first_exposure from attempts where learning_event_id = $1', [event.id]);
    return {
      attemptId: prev!.id, isCorrect: prev!.is_correct, correctAlternative: q.correct_alternative, annulled: q.is_annulled,
      isFirstExposure: prev!.is_first_exposure, cpeEligible: false, classificationOffered: false, masteryState: null, duplicate: true,
    };
  }
  const seen = await one(tx, 'select 1 from attempts where user_id = $1 and question_id = $2 limit 1', [input.userId, input.questionId]);
  const isFirstExposure = !seen;
  const isCorrect = q.is_annulled || input.selected === null ? (q.is_annulled ? null : false) : input.selected === q.correct_alternative;
  const [attempt] = await tx.query<{ id: string }>(
    `insert into attempts (user_id, question_id, selected_alternative, is_correct, mode, context_id, time_spent_ms, confidence, eliminated, is_first_exposure, learning_event_id, submitted_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
    [input.userId, input.questionId, input.selected, isCorrect, input.mode, input.contextId ?? null, input.timeSpentMs ?? null,
      input.confidence ?? null, JSON.stringify(input.eliminated ?? []), isFirstExposure, event.id, at]);
  const attemptId = attempt!.id;

  let masteryState: string | null = null;
  if (!q.is_annulled && q.primary_skill_id && isCorrect !== null) {
    const { params } = await engineParams(tx);
    const history = await skillHistory(tx, input.userId, q.primary_skill_id);
    const derived = deriveQuestionEvidence({
      skillId: q.primary_skill_id, itemKey: `q:${input.questionId}`, isCorrect, difficulty: q.difficulty,
      isFirstExposure, history, at, params,
    });
    const results = await applyEvidence(tx, input.userId, event.id, derived, at);
    masteryState = results.get(q.primary_skill_id)?.state ?? null;
    await updateErrorNotebook(tx, { userId: input.userId, questionId: input.questionId, attemptId, isCorrect, isFirstExposure, q, eventId: event.id, at });
  }

  await awardXp(tx, input.userId, 'question', `question:${input.questionId}:${localDate(at)}`);
  await markStudyDay(tx, input.userId, at);
  await checkAchievements(tx, input.userId);

  return {
    attemptId, isCorrect, correctAlternative: q.correct_alternative, annulled: q.is_annulled, isFirstExposure,
    cpeEligible: isCorrect === false && cpeEligible({ areaCode: q.area_code, difficulty: q.difficulty, isCorrect }),
    classificationOffered: isCorrect === false && errorClassificationOffered({ areaCode: q.area_code, isCorrect }),
    masteryState, duplicate: false,
  };
}

/**
 * Caderno de erros automático (5.7). Superação exige NOVAS evidências: ≥2 acertos independentes
 * em itens distintos da mesma habilidade após o erro; acertar a mesma questão só move para "em recuperação".
 */
async function updateErrorNotebook(tx: Tx, a: {
  userId: string; questionId: string; attemptId: string; isCorrect: boolean; isFirstExposure: boolean; eventId: string; at: Date;
  q: { area_code: string; difficulty: Difficulty | null; primary_skill_id: string | null; primary_subtopic_id: string | null };
}): Promise<void> {
  if (!a.isCorrect) {
    const cpe = cpeEligible({ areaCode: a.q.area_code, difficulty: a.q.difficulty, isCorrect: false }) ? 'pending' : 'not_applicable';
    await tx.query(
      `insert into error_entries (user_id, question_id, skill_id, subtopic_id, difficulty, first_attempt_id, last_attempt_id, cpe_status)
       values ($1,$2,$3,$4,$5,$6,$6,$7)
       on conflict (user_id, question_id) do update set last_attempt_id = excluded.last_attempt_id, attempts_count = error_entries.attempts_count + 1,
         recovery_status = 'open', overcome_event_id = null, overcome_at = null,
         cpe_status = case when error_entries.cpe_status = 'completed' then 'completed' else excluded.cpe_status end`,
      [a.userId, a.questionId, a.q.primary_skill_id, a.q.primary_subtopic_id, a.q.difficulty, a.attemptId, cpe]);
    return;
  }
  // Acerto na mesma questão: no máximo "em recuperação".
  await tx.query(
    `update error_entries set recovery_status = 'recovering', attempts_count = attempts_count + 1, last_attempt_id = $3
     where user_id = $1 and question_id = $2 and recovery_status = 'open'`, [a.userId, a.questionId, a.attemptId]);
  if (!a.q.primary_skill_id || !a.isFirstExposure) return;
  const entries = await tx.query<{ id: string; question_id: string; since: Date }>(
    `select e.id, e.question_id, at.submitted_at as since from error_entries e join attempts at on at.id = e.last_attempt_id
     where e.user_id = $1 and e.skill_id = $2 and e.recovery_status <> 'overcome' and e.question_id <> $3`,
    [a.userId, a.q.primary_skill_id, a.questionId]);
  for (const e of entries) {
    const [c] = await tx.query<{ n: number }>(
      `select count(distinct item_key)::int as n from skill_evidence where user_id = $1 and skill_id = $2 and dimension = 'resolution'
       and independence = 'independent' and score = 100 and occurred_at > $3 and item_key <> $4`,
      [a.userId, a.q.primary_skill_id, e.since, `q:${e.question_id}`]);
    if (c!.n >= 2) {
      await tx.query(`update error_entries set recovery_status = 'overcome', overcome_event_id = $2, overcome_at = $3 where id = $1`, [e.id, a.eventId, a.at]);
    } else if (c!.n >= 1) {
      await tx.query(`update error_entries set recovery_status = 'recovering' where id = $1 and recovery_status = 'open'`, [e.id]);
    }
  }
}
