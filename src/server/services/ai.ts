import type { ZodType } from 'zod';
import { env } from '@/config/env';
import { openAiTransport, toStrictJsonSchema, type AiTransport } from '@/integrations/openai';
import { PROMPTS, type PromptPurpose } from '@/modules/ai/prompts';
import { asService } from '@/server/db';
import { num, one, type Tx } from '@/server/db/types';
import { periodKey } from '@/modules/quotas/period';

/**
 * Orquestração de IA (7.8/7.9/7.10/15.8):
 *  - modelo aprovado por finalidade (sem troca automática); sem modelo aprovado → indisponível;
 *  - chamadas pagas somente com OPENAI_ALLOW_PAID_CALLS=true;
 *  - orçamento mensal com alertas 70/90/100% e bloqueio de segurança;
 *  - retry limitado (falha transitória até 2 tentativas; saída inválida 1 nova tentativa);
 *  - registro de modelo, versão de prompt, tokens, custo, latência e status por tentativa.
 * Ausência de sucesso NUNCA atualiza aprendizagem nem consome franquia (quem chama libera a reserva).
 */
let transportOverride: AiTransport | undefined;
export function setAiTransportForTests(t: AiTransport | undefined): void {
  transportOverride = t;
}

function transport(): AiTransport | null {
  if (transportOverride) return transportOverride;
  const e = env();
  if (process.env.NEXO_AI_FAKE === '1' && e.NEXO_ENV === 'test') {
    // Dublê determinístico SOMENTE em ambiente de teste (E2E). Nunca em produção.
    return async (req) => ({ kind: 'ok', json: fakeResponse(req.schemaName, req.user), inputTokens: 100, outputTokens: 100 });
  }
  if (e.OPENAI_ALLOW_PAID_CALLS !== 'true' || !e.OPENAI_API_KEY) return null;
  return openAiTransport;
}

export type AiOutcome<T> =
  | { ok: true; value: T; usageId: string; modelId: string; promptVersionId: string }
  | { ok: false; reason: 'unavailable' | 'budget_blocked' | 'invalid_output' | 'provider_error' | 'timeout'; message: string };

export async function ensurePromptVersion(tx: Tx, purpose: PromptPurpose): Promise<{ id: string; template: string; version: string }> {
  const def = PROMPTS[purpose];
  const active = await one<{ id: string; template: string; version: string }>(
    tx, `select id, template, version from prompt_versions where purpose = $1 and status = 'active'`, [purpose]);
  if (active) return active;
  const [row] = await tx.query<{ id: string; template: string; version: string }>(
    `insert into prompt_versions (purpose, version, template, status) values ($1,$2,$3,'active')
     on conflict (purpose, version) do update set status = 'active' returning id, template, version`,
    [purpose, def.version, def.system]);
  return row!;
}

async function approvedModel(tx: Tx, purpose: string) {
  return one<{ model_id: string; input_usd_per_mtok: string | null; output_usd_per_mtok: string | null }>(
    tx, `select model_id, input_usd_per_mtok, output_usd_per_mtok from ai_models where purpose = $1 and status = 'approved'`, [purpose]);
}

export async function monthSpendUsd(tx: Tx, at = new Date()): Promise<number> {
  const key = periodKey('month', at).slice(2);
  const [r] = await tx.query<{ s: string | null }>(
    `select sum(cost_usd)::text as s from ai_usage where to_char(created_at at time zone 'America/Sao_Paulo', 'YYYY-MM') = $1`, [key]);
  return num(r?.s) ?? 0;
}

async function checkBudget(tx: Tx): Promise<{ blocked: boolean }> {
  const key = periodKey('month', new Date()).slice(2);
  const b = await one<{ budget_usd: string; hard_limit: boolean; alerted_70: boolean; alerted_90: boolean; alerted_100: boolean }>(
    tx, 'select budget_usd, hard_limit, alerted_70, alerted_90, alerted_100 from ai_budgets where period_key = $1', [key]);
  if (!b) return { blocked: false };
  const budget = num(b.budget_usd)!;
  const spent = await monthSpendUsd(tx);
  const ratio = spent / budget;
  const alert = async (level: 70 | 90 | 100, severity: string) => {
    await tx.query(`update ai_budgets set alerted_${level} = true where period_key = $1`, [key]);
    await tx.query(
      `insert into alerts (kind, severity, message, details, dedupe_key) values ('ai_budget', $1, $2, $3, $4) on conflict (dedupe_key) do nothing`,
      [severity, `Orçamento de IA atingiu ${level}% em ${key}.`, JSON.stringify({ spent, budget }), `ai_budget:${key}:${level}`]);
  };
  if (ratio >= 0.7 && !b.alerted_70) await alert(70, 'warning');
  if (ratio >= 0.9 && !b.alerted_90) await alert(90, 'high');
  if (ratio >= 1 && !b.alerted_100) await alert(100, 'critical');
  return { blocked: b.hard_limit && ratio >= 1 };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runAi<T>(input: {
  purpose: PromptPurpose;
  userId: string | null;
  planCode: string | null;
  requestId: string;
  user: string;
  schema: ZodType<T>;
  /** Validação semântica adicional (ex.: citações literais). */
  validate?: (value: T) => { ok: true; value: T } | { ok: false; errors: string[] };
  modelPurposeOverride?: 'essay' | 'mini' | 'nano' | 'validator';
}): Promise<AiOutcome<T>> {
  const def = PROMPTS[input.purpose];
  const modelPurpose = input.modelPurposeOverride ?? def.modelPurpose;
  const t = transport();
  const prep = await asService(async (tx) => {
    const prompt = await ensurePromptVersion(tx, input.purpose);
    const model = await approvedModel(tx, modelPurpose);
    const budget = model ? await checkBudget(tx) : { blocked: false };
    return { prompt, model, budget };
  });
  const log = (status: string, extra: { model?: string; inTok?: number; outTok?: number; cost?: number | null; latency?: number; attempt: number; error?: string }) =>
    asService(async (tx) => {
      const [r] = await tx.query<{ id: string }>(
        `insert into ai_usage (user_id, purpose, plan_code, model_id, prompt_version_id, request_id, input_tokens, output_tokens, cost_usd, latency_ms, attempt_no, status, error_code)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
        [input.userId, input.purpose, input.planCode, extra.model ?? null, prep.prompt.id, input.requestId, extra.inTok ?? null, extra.outTok ?? null,
          extra.cost ?? null, extra.latency ?? null, extra.attempt, status, extra.error ?? null]);
      return r!.id;
    });

  const fakeModel = process.env.NEXO_AI_FAKE === '1' && env().NEXO_ENV === 'test' ? { model_id: 'test-double', input_usd_per_mtok: '0', output_usd_per_mtok: '0' } : null;
  const model = prep.model ?? fakeModel;
  if (!t || !model) {
    await log('unavailable', { attempt: 1, error: !t ? 'paid_calls_disabled' : 'no_approved_model' });
    return { ok: false, reason: 'unavailable', message: 'Avaliação por IA indisponível no momento. Sua franquia não foi consumida.' };
  }
  if (prep.budget.blocked) {
    await log('budget_blocked', { attempt: 1, model: model.model_id });
    return { ok: false, reason: 'budget_blocked', message: 'Avaliação por IA temporariamente indisponível. Sua franquia não foi consumida.' };
  }

  const jsonSchema = toStrictJsonSchema(input.schema);
  let invalidRetries = 0;
  let last: AiOutcome<T> = { ok: false, reason: 'provider_error', message: 'Falha na avaliação.' };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const started = Date.now();
    const res = await t({
      model: model.model_id, system: prep.prompt.template, user: input.user, schemaName: input.purpose,
      jsonSchema, maxOutputTokens: def.maxOutputTokens,
    });
    const latency = Date.now() - started;
    if (res.kind === 'ok' || res.kind === 'invalid_output') {
      const cost = num(model.input_usd_per_mtok) !== null && num(model.output_usd_per_mtok) !== null
        ? (res.inputTokens * num(model.input_usd_per_mtok)! + res.outputTokens * num(model.output_usd_per_mtok)!) / 1_000_000
        : null;
      if (res.kind === 'ok') {
        const parsed = input.schema.safeParse(res.json);
        const semantic = parsed.success ? (input.validate ? input.validate(parsed.data) : { ok: true as const, value: parsed.data }) : null;
        if (parsed.success && semantic && semantic.ok) {
          const usageId = await log('success', { model: model.model_id, inTok: res.inputTokens, outTok: res.outputTokens, cost, latency, attempt });
          return { ok: true, value: semantic.value, usageId, modelId: model.model_id, promptVersionId: prep.prompt.id };
        }
        await log('invalid_output', { model: model.model_id, inTok: res.inputTokens, outTok: res.outputTokens, cost, latency, attempt, error: 'validation' });
      } else {
        await log('invalid_output', { model: model.model_id, inTok: res.inputTokens, outTok: res.outputTokens, cost, latency, attempt, error: res.error });
      }
      last = { ok: false, reason: 'invalid_output', message: 'A avaliação gerada não passou na validação. Sua franquia não foi consumida.' };
      if (++invalidRetries > 1) break;
      continue;
    }
    await log(res.kind === 'timeout' ? 'timeout' : 'provider_error', { model: model.model_id, latency, attempt, error: res.kind === 'provider_error' ? res.error : 'timeout' });
    last = { ok: false, reason: res.kind === 'timeout' ? 'timeout' : 'provider_error', message: 'Serviço de IA indisponível. Sua franquia não foi consumida.' };
    if (attempt >= 2) break;
    await sleep(attempt * 1000);
  }
  // Avaliações inválidas recorrentes geram alerta para análise (12.7).
  await asService((tx) =>
    tx.query(
      `insert into alerts (kind, severity, message, details, dedupe_key) values ('ai_failure', 'warning', $1, $2, $3) on conflict (dedupe_key) do nothing`,
      [`Falha de IA em ${input.purpose}`, JSON.stringify({ reason: last.ok ? null : last.reason }), `ai_failure:${input.purpose}:${new Date().toISOString().slice(0, 13)}`]));
  return last;
}

/** Respostas fixas do dublê de teste, coerentes com os schemas (usadas apenas em E2E). */
function fakeResponse(schemaName: string, userText: string): unknown {
  const firstSentence = (userText.split('<<<DADOS>>>').at(-1) ?? '').split('<<<FIM>>>')[0]!.trim().split(/(?<=[.!?])\s/)[0]?.slice(0, 80) ?? '';
  switch (schemaName) {
    case 'essay_full':
      return {
        zeroed: false, zero_reason: null, total: 600, overall_feedback: 'Avaliação de teste (dublê E2E): texto com estrutura adequada.',
        recommendations: ['Exemplo de recomendação do dublê de teste.'],
        competencies: [1, 2, 3, 4, 5].map((c) => ({ competency: c, score: 120, justification: 'Justificativa do dublê de teste para validação de fluxo.', citations: firstSentence ? [firstSentence] : [], strengths: [], improvements: [] })),
      };
    case 'essay_partial':
      return { competency: Number(/Competência alvo: (\d)/.exec(userText)?.[1] ?? 1), improved: 'partially', estimated_score: null, justification: 'Justificativa do dublê de teste para validação de fluxo.', citations: [], next_steps: ['Passo do dublê.'] };
    case 'concept_eval':
      return { score: 2, justification: 'Avaliação do dublê de teste.', correct_points: [], missing_points: [], misconceptions: [], feedback: 'Feedback do dublê de teste.' };
    case 'discursive_eval':
      return { score: 2, justification: 'Avaliação do dublê de teste.', citations: [], improvements: ['Melhoria do dublê.'] };
    default:
      return {};
  }
}
