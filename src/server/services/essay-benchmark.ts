import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { env } from '@/config/env';
import { scrubPII } from '@/modules/ai/pii';
import {
  benchmarkSampleSchema, computeBenchmarkMetrics, DEFAULT_ACCEPTANCE, evaluateAcceptance,
  type AcceptanceThresholds, type BenchmarkPrediction, type BenchmarkSample,
} from '@/modules/essays/benchmark';
import { fullEvaluationSchema, validateFullEvaluation } from '@/modules/essays/validation';
import { asService } from '@/server/db';
import { one, type Tx } from '@/server/db/types';
import { AppError, badRequest, notFound } from '@/server/http/errors';
import { runAi } from './ai';
import { audit } from './core';
import { buildEssayUserPrompt, ragContext } from './essays';

/**
 * Executa o benchmark do corretor (6.3) com o MESMO prompt, RAG, modelo aprovado e validação da produção.
 * Persiste somente métricas agregadas e hash do conjunto — nenhum texto ou dado de autor.
 * Chamadas pagas exigem OPENAI_ALLOW_PAID_CALLS=true (runAi) E confirmação explícita por execução.
 */
export const benchmarkRunSchema = z.object({
  label: z.string().min(1).max(120),
  datasetSha256: z.string().regex(/^[0-9a-f]{64}$/),
  samples: z.array(z.unknown()).min(1).max(500),
  thresholds: z.object(Object.fromEntries(Object.keys(DEFAULT_ACCEPTANCE).map((k) => [k, z.number().nonnegative()])) as Record<keyof AcceptanceThresholds, z.ZodNumber>).partial().optional(),
  confirmPaidCalls: z.boolean().default(false),
});

export async function runEssayBenchmark(raw: z.input<typeof benchmarkRunSchema>) {
  const input = benchmarkRunSchema.parse(raw);
  const samples: BenchmarkSample[] = input.samples.map((s, i) => {
    const r = benchmarkSampleSchema.safeParse(s);
    if (!r.success) throw badRequest(`Amostra ${i + 1} inválida: ${r.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ')}`);
    return r.data;
  });
  if (new Set(samples.map((s) => s.id)).size !== samples.length) throw badRequest('Identificadores de amostra repetidos.');
  const e = env();
  const testDouble = e.NEXO_ENV === 'test';
  if (!testDouble && e.OPENAI_ALLOW_PAID_CALLS === 'true' && !input.confirmPaidCalls) {
    throw new AppError(409, 'paid_calls_confirmation_required', `O benchmark fará ${samples.length} chamada(s) paga(s) ao modelo de redação. Reenvie com confirmPaidCalls=true após autorização.`);
  }
  const rag = await asService((tx) => ragContext(tx));
  const runId = randomUUID();
  const predictions: BenchmarkPrediction[] = [];
  let modelId: string | null = null, promptVersionId: string | null = null;
  for (const s of samples) {
    const essay = scrubPII(s.text, { names: [] }).text;
    const outcome = await runAi({
      purpose: 'essay_full', userId: null, planCode: null, requestId: `bench:${runId}:${s.id}`, schema: fullEvaluationSchema,
      validate: (v) => validateFullEvaluation(v, essay),
      user: buildEssayUserPrompt({ theme: s.theme, rag, essay }),
    });
    if (!outcome.ok) {
      if (outcome.reason === 'unavailable' || outcome.reason === 'budget_blocked') {
        throw new AppError(503, outcome.reason, 'Benchmark não executado: IA indisponível (modelo não aprovado, chamadas pagas desabilitadas ou orçamento bloqueado).');
      }
      predictions.push({ id: s.id, ok: false, reason: outcome.reason });
      continue;
    }
    modelId = outcome.modelId; promptVersionId = outcome.promptVersionId;
    const c = outcome.value.competencies.map((x) => x.score) as [number, number, number, number, number];
    predictions.push({ id: s.id, ok: true, c, total: outcome.value.total, zeroed: outcome.value.zeroed });
  }
  const thresholds: AcceptanceThresholds = { ...DEFAULT_ACCEPTANCE, ...(input.thresholds ?? {}) };
  const metrics = computeBenchmarkMetrics(samples, predictions);
  const acceptance = evaluateAcceptance(metrics, thresholds);
  const isTestDouble = testDouble || modelId === 'test-double';
  await asService((tx) => tx.query(
    `insert into essay_benchmark_runs (id, label, dataset_sha256, dataset_sources, model_id, prompt_version_id, is_test_double, samples, metrics, acceptance, thresholds, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [runId, input.label, input.datasetSha256, [...new Set(samples.map((s) => s.source))], modelId, promptVersionId, isTestDouble, samples.length,
      JSON.stringify(metrics), JSON.stringify(acceptance), JSON.stringify(thresholds), acceptance.passed ? 'passed' : 'failed']));
  return {
    runId, status: acceptance.passed ? 'passed' : 'failed', isTestDouble, modelId, metrics, acceptance,
    // Por amostra: somente identificadores e notas (sem texto), para análise de erros pelo administrador.
    perSample: samples.map((s) => ({ id: s.id, human: s.human, prediction: predictions.find((p) => p.id === s.id) ?? null })),
  };
}

export async function listBenchmarkRuns(tx: Tx, limit = 20) {
  return tx.query(
    `select id, label, dataset_sources, model_id, prompt_version_id, is_test_double, samples, status, metrics, acceptance, approved_at, created_at
       from essay_benchmark_runs order by created_at desc limit $1`, [limit]);
}

/** Aprovação explícita: só execuções aprovadas pelos critérios, com modelo real (nunca o dublê de teste). */
export async function approveBenchmarkRun(adminId: string, runId: string) {
  return asService(async (tx) => {
    const r = await one<{ status: string; is_test_double: boolean; approved_at: string | null }>(tx,
      'select status, is_test_double, approved_at from essay_benchmark_runs where id = $1', [runId]);
    if (!r) throw notFound('Execução de benchmark');
    if (r.status !== 'passed') throw new AppError(422, 'benchmark_failed', 'Somente execuções que atingiram os critérios podem ser aprovadas.');
    if (r.is_test_double) throw new AppError(422, 'benchmark_test_double', 'Execuções com dublê de teste não liberam correções reais.');
    if (r.approved_at) return { ok: true };
    await tx.query('update essay_benchmark_runs set approved_by = $2, approved_at = now() where id = $1', [runId, adminId]);
    await audit(tx, adminId, 'admin', 'essay_benchmark_approve', 'essay_benchmark_run', runId);
    return { ok: true };
  });
}
