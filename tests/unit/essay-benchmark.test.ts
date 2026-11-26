import { describe, expect, it } from 'vitest';
import {
  benchmarkSampleSchema, computeBenchmarkMetrics, DEFAULT_ACCEPTANCE, evaluateAcceptance, isDiscrepant, scoreBand,
  type BenchmarkPrediction, type BenchmarkSample,
} from '@/modules/essays/benchmark';

// Amostras SINTÉTICAS (sem relação com o acervo real ou com o conjunto privado de benchmark).
const TEXT = 'Texto sintético de teste para o benchmark do corretor. '.repeat(8);
function sample(id: string, c: [number, number, number, number, number]): BenchmarkSample {
  return { id, source: 'sintetico', theme: 'Tema sintético', human: { c, total: c.reduce((a, b) => a + b, 0) }, text: TEXT, rights_status: 'own', usage: 'benchmark' };
}
const ok = (id: string, c: [number, number, number, number, number]): BenchmarkPrediction => ({ id, ok: true, c, total: c.reduce((a, b) => a + b, 0), zeroed: false });

describe('critério oficial de discrepância (Cartilha 2026, p.8)', () => {
  it('discrepante quando total difere > 100 ou alguma competência > 80', () => {
    const h = { c: [160, 160, 160, 160, 160], total: 800 };
    expect(isDiscrepant(h, { c: [200, 200, 160, 160, 160], total: 880 })).toBe(false); // 80 no total, 40 por competência
    expect(isDiscrepant(h, { c: [200, 200, 200, 160, 160], total: 920 })).toBe(true); // 120 no total
    expect(isDiscrepant(h, { c: [40, 200, 200, 160, 200], total: 800 })).toBe(true); // 120 na C1, total igual
    expect(isDiscrepant(h, { c: [80, 200, 200, 160, 160], total: 800 })).toBe(false); // exatamente 80 não é discrepância
  });
});

describe('esquema das amostras', () => {
  it('aceita notas humanas em passos de 20 (média de dois avaliadores) e exige soma = total', () => {
    expect(benchmarkSampleSchema.safeParse(sample('a', [180, 200, 200, 200, 200])).success).toBe(true);
    expect(benchmarkSampleSchema.safeParse({ ...sample('b', [170, 200, 200, 200, 200]) }).success).toBe(false);
    expect(benchmarkSampleSchema.safeParse({ ...sample('c', [200, 200, 200, 200, 200]), human: { c: [200, 200, 200, 200, 200], total: 980 } }).success).toBe(false);
    expect(benchmarkSampleSchema.safeParse({ ...sample('d', [200, 200, 200, 200, 200]), usage: 'rag' }).success).toBe(false);
  });
});

describe('métricas', () => {
  it('calcula erro, viés, concordância e falhas por competência e no total', () => {
    const samples = [sample('s1', [160, 160, 160, 160, 160]), sample('s2', [120, 120, 120, 120, 120]), sample('s3', [200, 200, 200, 200, 200]), sample('s4', [80, 80, 80, 80, 80])];
    const preds: BenchmarkPrediction[] = [
      ok('s1', [160, 160, 160, 160, 200]), // +40 total
      ok('s2', [200, 200, 120, 120, 120]), // +160 total -> discrepante
      ok('s3', [200, 200, 200, 200, 200]), // exato
      { id: 's4', ok: false, reason: 'invalid_output' },
    ];
    const m = computeBenchmarkMetrics(samples, preds);
    expect(m.samples).toBe(4);
    expect(m.evaluated).toBe(3);
    expect(m.failureRate).toBe(0.25);
    expect(m.failureReasons).toEqual({ invalid_output: 1 });
    expect(m.nonDiscrepantRate).toBeCloseTo(2 / 3, 3);
    expect(m.total.mae).toBeCloseTo((40 + 160 + 0) / 3, 2);
    expect(m.total.bias).toBeCloseTo((40 + 160) / 3, 2);
    expect(m.competencies[0]).toMatchObject({ competency: 1, mae: 26.67, bias: 26.67 });
    expect(m.competencies[4]).toMatchObject({ competency: 5, mae: 13.33, bias: 13.33 });
    expect(m.bands).toEqual({ 'alta (≥800)': 2, 'intermediária (600–799)': 1, 'baixa (<600)': 1 });
  });

  it('nunca aprova amostra pequena ou de uma faixa só, mesmo com previsões perfeitas', () => {
    const samples = Array.from({ length: 10 }, (_, i) => sample(`h${i}`, [200, 200, 200, 200, 180]));
    const m = computeBenchmarkMetrics(samples, samples.map((s) => ok(s.id, [200, 200, 200, 200, 200])));
    expect(m.nonDiscrepantRate).toBe(1);
    const acc = evaluateAcceptance(m);
    expect(acc.passed).toBe(false);
    expect(acc.reasons).toEqual([]);
    expect(acc.representativeness.length).toBe(2);
  });

  it('aprova quando representativo e dentro dos limites; reprova por viés sistemático', () => {
    const levels: [number, number, number, number, number][] = [[200, 200, 200, 200, 200], [140, 140, 140, 140, 140], [80, 80, 80, 80, 80]];
    const samples = Array.from({ length: 30 }, (_, i) => sample(`r${i}`, levels[i % 3]!));
    const good = computeBenchmarkMetrics(samples, samples.map((s) => ok(s.id, s.human.c.map((v) => (v === 140 ? 120 : v)) as [number, number, number, number, number])));
    expect(scoreBand(700)).toBe('intermediária (600–799)');
    expect(evaluateAcceptance(good)).toEqual({ passed: true, reasons: [], representativeness: [] });
    const biased = computeBenchmarkMetrics(samples, samples.map((s) => ok(s.id, s.human.c.map((v, i) => (i === 2 ? Math.min(200, v + 80) : v)) as [number, number, number, number, number])));
    const acc = evaluateAcceptance(biased, { ...DEFAULT_ACCEPTANCE });
    expect(acc.passed).toBe(false);
    expect(acc.reasons.some((r) => r.includes('competência 3'))).toBe(true);
  });
});
