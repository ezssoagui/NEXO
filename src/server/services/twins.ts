import { z } from 'zod';
import { wrapData } from '@/modules/ai/prompts';
import { structuralChecks, twinApproved, twinDraftSchema, twinValidationSchema } from '@/modules/twins/checks';
import { deriveQuestionEvidence } from '@/modules/mastery/evidence';
import { localDate } from '@/modules/quotas/period';
import { asService } from '@/server/db';
import { one, type Tx } from '@/server/db/types';
import { AppError, notFound } from '@/server/http/errors';
import { runAi } from './ai';
import { awardXp, engineParams, markStudyDay } from './core';
import { applyEvidence, recordLearningEvent, skillHistory } from './learning';

/**
 * Seleção de questão equivalente (2.12/5.5): 1) oficial inédita da mesma habilidade e dificuldade;
 * 2) gêmea já aprovada e inédita; 3) somente então solicita geração (fila processada com orçamento
 * administrativo, segunda validação independente obrigatória).
 */
export async function findEquivalent(tx: Tx, userId: string, questionId: string) {
  const q = await one<{ primary_skill_id: string | null; difficulty: string | null }>(tx, 'select primary_skill_id, difficulty from questions where id = $1', [questionId]);
  if (!q?.primary_skill_id) throw notFound('Questão');
  const official = await one<{ id: string }>(tx,
    `select q.id from questions q where q.primary_skill_id = $1 and q.id <> $2 and q.publication_status = 'published' and not q.is_annulled
       and not exists (select 1 from attempts a where a.user_id = $3 and a.question_id = q.id)
     order by (q.difficulty is not distinct from $4) desc, q.id limit 1`, [q.primary_skill_id, questionId, userId, q.difficulty]);
  if (official) return { kind: 'official' as const, id: official.id };
  const twin = await one<{ id: string }>(tx,
    `select t.id from twin_questions t where t.skill_id = $1 and t.status = 'approved'
       and not exists (select 1 from attempts a where a.user_id = $2 and a.twin_question_id = t.id) order by t.approved_at limit 1`, [q.primary_skill_id, userId]);
  if (twin) return { kind: 'twin' as const, id: twin.id };
  await tx.query(`insert into twin_requests (origin_question_id, skill_id, reason) values ($1,$2,'sem equivalente oficial ou gêmea validada')
    on conflict (origin_question_id, skill_id, status) do nothing`, [questionId, q.primary_skill_id]);
  return { kind: 'requested' as const, id: null };
}

export async function twinPayload(tx: Tx, twinId: string) {
  const t = await one<{ id: string; statement_md: string; alternatives: { letter: string; text: string }[]; difficulty: string | null; status: string }>(
    tx, 'select id, statement_md, alternatives, difficulty, status from twin_questions where id = $1', [twinId]);
  if (!t || t.status !== 'approved') throw notFound('Questão');
  // Identificada como questão autoral NEXO (não oficial) — 5.5.
  return { id: t.id, statement_md: t.statement_md, alternatives: t.alternatives.map((a) => ({ letter: a.letter, body_md: a.text })), difficulty: t.difficulty, origin: 'nexo_twin' };
}

export async function answerTwin(userId: string, twinId: string, selected: 'A' | 'B' | 'C' | 'D' | 'E', idempotencyKey: string) {
  return asService((tx) => answerTwinTx(tx, userId, twinId, selected, idempotencyKey));
}

export async function answerTwinTx(tx: Tx, userId: string, twinId: string, selected: 'A' | 'B' | 'C' | 'D' | 'E', idempotencyKey: string) {
  {
    const t = await one<{ skill_id: string; correct_alternative: string; difficulty: 'easy' | 'medium' | 'hard' | null; solution_md: string; status: string }>(
      tx, 'select skill_id, correct_alternative, difficulty, solution_md, status from twin_questions where id = $1', [twinId]);
    if (!t || t.status !== 'approved') throw notFound('Questão');
    const ev = await recordLearningEvent(tx, { userId, eventType: 'question_answer', source: 'free', idempotencyKey: `twin:${idempotencyKey}`, entityType: 'twin_question', entityId: twinId });
    const isCorrect = selected === t.correct_alternative;
    if (ev.created) {
      const seen = await one(tx, 'select 1 from attempts where user_id = $1 and twin_question_id = $2', [userId, twinId]);
      await tx.query(`insert into attempts (user_id, twin_question_id, selected_alternative, is_correct, mode, is_first_exposure, learning_event_id) values ($1,$2,$3,$4,'single',$5,$6)`,
        [userId, twinId, selected, isCorrect, !seen, ev.id]);
      const { params } = await engineParams(tx);
      const history = await skillHistory(tx, userId, t.skill_id);
      await applyEvidence(tx, userId, ev.id, deriveQuestionEvidence({ skillId: t.skill_id, itemKey: `tw:${twinId}`, isCorrect, difficulty: t.difficulty, isFirstExposure: !seen, history, at: new Date(), params }), new Date());
      await awardXp(tx, userId, 'question', `twin:${twinId}:${localDate(new Date())}`);
      await markStudyDay(tx, userId);
    }
    return { isCorrect, correctAlternative: t.correct_alternative, solution: t.solution_md, origin: 'nexo_twin' };
  }
}

/** Processa a fila de gêmeas (job administrativo). Cada item: geração → checagens → validação independente. */
export async function processTwinRequests(limit = 5): Promise<{ processed: number; approved: number; rejected: number; skipped: string | null }> {
  const pending = await asService((tx) => tx.query<{ id: string; origin_question_id: string; skill_id: string }>(
    `update twin_requests set status = 'processing' where id in (select id from twin_requests where status = 'pending' order by created_at limit $1) returning id, origin_question_id, skill_id`, [limit]));
  let approved = 0, rejected = 0;
  for (const r of pending) {
    const origin = await asService((tx) => one<{ statement_md: string; correct_alternative: string; alternatives: string; skill_name: string; difficulty: string | null }>(tx,
      `select q.statement_md, q.correct_alternative, q.difficulty, k.name as skill_name,
              (select string_agg(a.letter || ') ' || a.body_md, E'\\n' order by a.letter) from alternatives a where a.question_id = q.id) as alternatives
         from questions q join skills k on k.id = $2 where q.id = $1`, [r.origin_question_id, r.skill_id]));
    if (!origin) continue;
    const gen = await runAi({
      purpose: 'twin_generate', userId: null, planCode: null, requestId: `twin-gen:${r.id}`, schema: twinDraftSchema,
      user: [`Habilidade: ${origin.skill_name}. Dificuldade alvo: ${origin.difficulty ?? 'média'}.`, wrapData('Questão de origem (oficial)', `${origin.statement_md}\n${origin.alternatives}\nGabarito: ${origin.correct_alternative}`)].join('\n\n'),
    });
    if (!gen.ok) {
      await asService((tx) => tx.query(`update twin_requests set status = 'failed', processed_at = now(), reason = $2 where id = $1`, [r.id, gen.reason]));
      if (gen.reason === 'unavailable' || gen.reason === 'budget_blocked') {
        await asService((tx) => tx.query(`update twin_requests set status = 'pending' where status = 'processing'`));
        return { processed: approved + rejected, approved, rejected, skipped: gen.reason };
      }
      continue;
    }
    const draft = gen.value;
    const structural = structuralChecks(draft, origin.statement_md);
    const [twin] = await asService((tx) => tx.query<{ id: string }>(
      `insert into twin_questions (origin_question_id, skill_id, statement_md, alternatives, correct_alternative, solution_md, difficulty, generation_model, prompt_version_id, ai_usage_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [r.origin_question_id, r.skill_id, draft.statement, JSON.stringify(draft.alternatives), draft.correct, draft.solution, draft.difficulty, gen.modelId, gen.promptVersionId, gen.usageId]));
    let verdict: 'approved' | 'rejected' = 'rejected';
    let validation: z.infer<typeof twinValidationSchema> | null = null;
    if (structural.ok) {
      const val = await runAi({
        purpose: 'twin_validate', userId: null, planCode: null, requestId: `twin-val:${r.id}`, schema: twinValidationSchema,
        user: [wrapData('Questão de origem', `${origin.statement_md}\n${origin.alternatives}\nGabarito: ${origin.correct_alternative}`),
          wrapData('Questão proposta', `${draft.statement}\n${draft.alternatives.map((a) => `${a.letter}) ${a.text}`).join('\n')}\nGabarito informado: ${draft.correct}\nResolução: ${draft.solution}`)].join('\n\n'),
      });
      if (val.ok) {
        validation = val.value;
        verdict = twinApproved(structural, val.value) ? 'approved' : 'rejected';
      }
    }
    await asService(async (tx) => {
      await tx.query(`insert into twin_validations (twin_id, validator_model, structural_checks, result, verdict) values ($1,$2,$3,$4,$5)`,
        [twin!.id, validation ? 'validator' : 'none', JSON.stringify(structural.checks), validation ? JSON.stringify(validation) : null, verdict]);
      await tx.query(`update twin_questions set status = $2, approved_at = case when $2 = 'approved' then now() end where id = $1`, [twin!.id, verdict]);
      await tx.query(`update twin_requests set status = $2, twin_id = $3, processed_at = now() where id = $1`, [r.id, verdict === 'approved' ? 'fulfilled' : 'failed', twin!.id]);
    });
    if (verdict === 'approved') approved++; else rejected++;
  }
  return { processed: approved + rejected, approved, rejected, skipped: null };
}

export function assertTwinOrigin(kind: string): void {
  if (kind !== 'official' && kind !== 'twin' && kind !== 'requested') throw new AppError(500, 'invalid_equivalent', 'Equivalente inválido');
}
