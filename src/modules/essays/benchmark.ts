import { z } from 'zod';

/**
 * Benchmark do corretor de redação contra avaliações humanas conhecidas (6.3, 15.x "não prometer precisão sem benchmark").
 *
 * Critério central = o MESMO usado pelo Inep entre dois avaliadores (Cartilha do Participante 2026, p.8):
 * há discrepância quando as notas diferem em mais de 100 pontos no total OU em mais de 80 pontos em qualquer competência.
 * A nota humana final por competência pode vir em passos de 20 (média de dois avaliadores — p.9); a da IA, em passos de 40.
 * Limiares de aceite são PROPOSTA experimental (ADR-019, pendente dos sócios), não regra validada.
 */
const humanScore = z.number().int().min(0).max(200).refine((v) => v % 20 === 0, 'nota humana em passos de 20');

export const benchmarkSampleSchema = z.object({
  id: z.string().min(1).max(80),
  source: z.string().min(1).max(60),
  source_locator: z.string().max(80).optional(),
  theme: z.string().min(3).max(300),
  year: z.number().int().min(1998).max(2100).optional(),
  human: z.object({ c: z.tuple([humanScore, humanScore, humanScore, humanScore, humanScore]), total: z.number().int().min(0).max(1000) })
    .refine((h) => h.c.reduce((a, b) => a + b, 0) === h.total, 'total humano difere da soma das competências'),
  text: z.string().min(200).max(20000),
  rights_status: z.enum(['restricted', 'authorized', 'own', 'official_public_pending_review']),
  usage: z.literal('benchmark'),
});
export type BenchmarkSample = z.infer<typeof benchmarkSampleSchema>;

export type BenchmarkPrediction =
  | { id: string; ok: true; c: [number, number, number, number, number]; total: number; zeroed: boolean }
  | { id: string; ok: false; reason: string };

export const INEP_DISCREPANCY = { total: 100, competency: 80 } as const;

export const DEFAULT_ACCEPTANCE = {
  minSamples: 30,
  minBands: 3,
  minPerBand: 5,
  minNonDiscrepantRate: 0.9,
  maxTotalMae: 60,
  maxAbsCompetencyBias: 40,
  maxFailureRate: 0.05,
} as const;
export type AcceptanceThresholds = { [K in keyof typeof DEFAULT_ACCEPTANCE]: number };

/** Faixas de nota total humana para checar representatividade (6.3: exemplos altos, intermediários e baixos). */
export function scoreBand(total: number): 'baixa (<600)' | 'intermediária (600–799)' | 'alta (≥800)' {
  return total < 600 ? 'baixa (<600)' : total < 800 ? 'intermediária (600–799)' : 'alta (≥800)';
}

export function isDiscrepant(human: { c: readonly number[]; total: number }, pred: { c: readonly number[]; total: number }): boolean {
  if (Math.abs(human.total - pred.total) > INEP_DISCREPANCY.total) return true;
  return human.c.some((h, i) => Math.abs(h - pred.c[i]!) > INEP_DISCREPANCY.competency);
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i]! - mx) * (ys[i]! - my); sxx += (xs[i]! - mx) ** 2; syy += (ys[i]! - my) ** 2; }
  return sxx === 0 || syy === 0 ? null : round(sxy / Math.sqrt(sxx * syy), 3);
}

export interface BenchmarkMetrics {
  samples: number;
  evaluated: number;
  failures: number;
  failureRate: number;
  nonDiscrepantRate: number | null;
  total: { mae: number | null; rmse: number | null; bias: number | null; within40: number | null; within100: number | null; pearson: number | null };
  competencies: { competency: number; mae: number; bias: number; within20: number; within40: number; overDiscrepancy: number }[];
  bands: Record<string, number>;
  failureReasons: Record<string, number>;
}

export function computeBenchmarkMetrics(samples: BenchmarkSample[], predictions: BenchmarkPrediction[]): BenchmarkMetrics {
  const byId = new Map(predictions.map((p) => [p.id, p]));
  const pairs: { h: BenchmarkSample['human']; p: { c: number[]; total: number } }[] = [];
  const failureReasons: Record<string, number> = {};
  const bands: Record<string, number> = {};
  for (const s of samples) {
    bands[scoreBand(s.human.total)] = (bands[scoreBand(s.human.total)] ?? 0) + 1;
    const p = byId.get(s.id);
    if (!p || !p.ok) { const r = p && !p.ok ? p.reason : 'missing'; failureReasons[r] = (failureReasons[r] ?? 0) + 1; continue; }
    pairs.push({ h: s.human, p });
  }
  const n = pairs.length;
  const mean = (f: (x: (typeof pairs)[number]) => number) => (n ? round(pairs.reduce((a, x) => a + f(x), 0) / n) : 0);
  const rate = (f: (x: (typeof pairs)[number]) => boolean) => (n ? round(pairs.filter(f).length / n, 4) : null);
  const failures = samples.length - n;
  return {
    samples: samples.length,
    evaluated: n,
    failures,
    failureRate: samples.length ? round(failures / samples.length, 4) : 0,
    nonDiscrepantRate: rate((x) => !isDiscrepant(x.h, x.p)),
    total: {
      mae: n ? mean((x) => Math.abs(x.p.total - x.h.total)) : null,
      rmse: n ? round(Math.sqrt(pairs.reduce((a, x) => a + (x.p.total - x.h.total) ** 2, 0) / n)) : null,
      bias: n ? mean((x) => x.p.total - x.h.total) : null,
      within40: rate((x) => Math.abs(x.p.total - x.h.total) <= 40),
      within100: rate((x) => Math.abs(x.p.total - x.h.total) <= 100),
      pearson: pearson(pairs.map((x) => x.h.total), pairs.map((x) => x.p.total)),
    },
    competencies: [0, 1, 2, 3, 4].map((i) => ({
      competency: i + 1,
      mae: mean((x) => Math.abs(x.p.c[i]! - x.h.c[i]!)),
      bias: mean((x) => x.p.c[i]! - x.h.c[i]!),
      within20: rate((x) => Math.abs(x.p.c[i]! - x.h.c[i]!) <= 20) ?? 0,
      within40: rate((x) => Math.abs(x.p.c[i]! - x.h.c[i]!) <= 40) ?? 0,
      overDiscrepancy: rate((x) => Math.abs(x.p.c[i]! - x.h.c[i]!) > INEP_DISCREPANCY.competency) ?? 0,
    })),
    bands,
    failureReasons,
  };
}

export interface AcceptanceResult { passed: boolean; reasons: string[]; representativeness: string[] }

/** Aprovação exige métricas E representatividade; nunca aprova com amostra pequena ou de uma faixa só. */
export function evaluateAcceptance(m: BenchmarkMetrics, t: AcceptanceThresholds = DEFAULT_ACCEPTANCE): AcceptanceResult {
  const reasons: string[] = [];
  const representativeness: string[] = [];
  if (m.samples < t.minSamples) representativeness.push(`amostra com ${m.samples} redações (mínimo ${t.minSamples})`);
  const okBands = Object.values(m.bands).filter((v) => v >= t.minPerBand).length;
  if (okBands < t.minBands) representativeness.push(`${okBands} faixa(s) de nota com ≥ ${t.minPerBand} redações (mínimo ${t.minBands}): ${JSON.stringify(m.bands)}`);
  if (m.failureRate > t.maxFailureRate) reasons.push(`falhas/saídas inválidas ${(m.failureRate * 100).toFixed(1)}% > ${(t.maxFailureRate * 100).toFixed(1)}%`);
  if (m.nonDiscrepantRate === null || m.nonDiscrepantRate < t.minNonDiscrepantRate) {
    reasons.push(`concordância no critério oficial de discrepância ${m.nonDiscrepantRate === null ? 'indisponível' : `${(m.nonDiscrepantRate * 100).toFixed(1)}%`} < ${(t.minNonDiscrepantRate * 100).toFixed(0)}%`);
  }
  if (m.total.mae === null || m.total.mae > t.maxTotalMae) reasons.push(`erro absoluto médio no total ${m.total.mae ?? 'indisponível'} > ${t.maxTotalMae}`);
  for (const c of m.competencies) if (Math.abs(c.bias) > t.maxAbsCompetencyBias) reasons.push(`viés na competência ${c.competency} = ${c.bias} (limite ±${t.maxAbsCompetencyBias})`);
  return { passed: reasons.length === 0 && representativeness.length === 0, reasons, representativeness };
}
