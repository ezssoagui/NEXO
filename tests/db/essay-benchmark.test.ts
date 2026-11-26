import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetEnvCache } from '@/config/env';
import { asService, setDbForTests } from '@/server/db';
import type { Database } from '@/server/db/types';
import { setAiTransportForTests } from '@/server/services/ai';
import { approveBenchmarkRun, runEssayBenchmark } from '@/server/services/essay-benchmark';
import { essayBenchmarkGate } from '@/server/services/essays';
import { createAuthUser, freshDb } from './helpers';

// Conjunto SINTÉTICO: nunca usar o conjunto privado (data/private) em testes automatizados.
const body = (n: number) => `Redação sintética número ${n} para validar o fluxo do benchmark. ` + 'Argumento de teste com coesão e proposta. '.repeat(10);
const samples = [
  { id: 'syn-1', source: 'sintetico', theme: 'Tema sintético', human: { c: [160, 160, 160, 160, 160], total: 800 }, text: body(1), rights_status: 'own', usage: 'benchmark' },
  { id: 'syn-2', source: 'sintetico', theme: 'Tema sintético', human: { c: [120, 120, 100, 120, 120], total: 580 }, text: body(2), rights_status: 'own', usage: 'benchmark' },
  { id: 'syn-3', source: 'sintetico', theme: 'Tema sintético', human: { c: [200, 200, 180, 200, 200], total: 980 }, text: body(3), rights_status: 'own', usage: 'benchmark' },
] as const;
const SHA = 'a'.repeat(64);

let db: Database;
let admin: string;

beforeAll(async () => {
  process.env.NEXO_ENV = 'test';
  resetEnvCache();
  db = await freshDb();
  setDbForTests(db);
  await db.query(`insert into ai_models (purpose, model_id, status, input_usd_per_mtok, output_usd_per_mtok) values ('essay','modelo-teste-essay','approved',1,8)`);
  admin = await createAuthUser(db, 'admin-bench@nexo.test');
  // Dublê: cita o primeiro trecho da redação (citação verificável) e devolve 160 em todas as competências;
  // para a amostra 2 devolve total inconsistente (saída inválida).
  setAiTransportForTests(async (req) => {
    const essay = (req.user.split('<<<DADOS>>>').at(-1) ?? '').split('<<<FIM>>>')[0]!.trim();
    const cite = essay.split(' ').slice(0, 5).join(' ');
    const invalid = essay.includes('número 2');
    return {
      kind: 'ok', inputTokens: 1000, outputTokens: 500,
      json: {
        zeroed: false, zero_reason: null, total: invalid ? 999 : 800, overall_feedback: 'Avaliação do dublê de teste do benchmark.',
        recommendations: ['Recomendação do dublê.'],
        competencies: [1, 2, 3, 4, 5].map((c) => ({ competency: c, score: 160, justification: 'Justificativa do dublê para o benchmark.', citations: [cite], strengths: [], improvements: [] })),
      },
    };
  });
});

afterAll(async () => {
  setAiTransportForTests(undefined);
  setDbForTests(undefined);
  await db.close();
});

describe('benchmark do corretor de redação (6.3, ADR-019)', () => {
  it('usa o caminho de produção, mede contra notas humanas e persiste só métricas', async () => {
    const res = await runEssayBenchmark({ label: 'teste sintético', datasetSha256: SHA, samples: [...samples] });
    expect(res.isTestDouble).toBe(true);
    expect(res.modelId).toBe('modelo-teste-essay');
    expect(res.metrics.samples).toBe(3);
    expect(res.metrics.evaluated).toBe(2);
    expect(res.metrics.failureReasons).toEqual({ invalid_output: 1 });
    expect(res.metrics.nonDiscrepantRate).toBe(0.5); // syn-1 exata; syn-3 difere 180 no total
    expect(res.status).toBe('failed');
    expect(res.acceptance.representativeness.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.perSample)).not.toContain('Redação sintética');

    const [row] = await db.query<{ status: string; is_test_double: boolean; metrics: unknown; acceptance: unknown; dataset_sources: string[] }>(
      `select status, is_test_double, metrics, acceptance, dataset_sources from essay_benchmark_runs where id = $1`, [res.runId]);
    expect(row).toMatchObject({ status: 'failed', is_test_double: true, dataset_sources: ['sintetico'] });
    expect(JSON.stringify(row)).not.toContain('Redação sintética');
    const usage = await db.query<{ n: number }>(`select count(*)::int as n from ai_usage where request_id like $1 and user_id is null`, [`bench:${res.runId}:%`]);
    expect(usage[0]!.n).toBeGreaterThanOrEqual(3);
  });

  it('rejeita amostras inválidas e ids repetidos antes de chamar a IA', async () => {
    await expect(runEssayBenchmark({ label: 'x', datasetSha256: SHA, samples: [{ ...samples[0], human: { c: [170, 160, 160, 160, 160], total: 810 } }] })).rejects.toThrow(/inválida/);
    await expect(runEssayBenchmark({ label: 'x', datasetSha256: SHA, samples: [samples[0], samples[0]] })).rejects.toThrow(/repetidos/);
  });

  it('não aprova execução reprovada nem execução com dublê de teste', async () => {
    const res = await runEssayBenchmark({ label: 'reprovada', datasetSha256: SHA, samples: [...samples] });
    await expect(approveBenchmarkRun(admin, res.runId)).rejects.toMatchObject({ code: 'benchmark_failed' });
    await db.query(`update essay_benchmark_runs set status = 'passed' where id = $1`, [res.runId]);
    await expect(approveBenchmarkRun(admin, res.runId)).rejects.toMatchObject({ code: 'benchmark_test_double' });
    await expect(db.query(`update essay_benchmark_runs set approved_at = now() where id = $1`, [res.runId])).rejects.toThrow();
  });

  it('trava de produção: só libera com execução aprovada para o modelo aprovado e o prompt ativo', async () => {
    expect(await asService((tx) => essayBenchmarkGate(tx, 'development'))).toEqual({ released: true });
    expect((await asService((tx) => essayBenchmarkGate(tx, 'production'))).released).toBe(false);
    const [p] = await db.query<{ id: string }>(`select id from prompt_versions where purpose = 'essay_full' and status = 'active'`);
    const [run] = await db.query<{ id: string }>(
      `insert into essay_benchmark_runs (label, dataset_sha256, model_id, prompt_version_id, is_test_double, samples, metrics, acceptance, thresholds, status, approved_by, approved_at)
       values ('real simulada', $1, 'modelo-teste-essay', $2, false, 40, '{}', '{}', '{}', 'passed', $3, now()) returning id`, [SHA, p!.id, admin]);
    expect(await asService((tx) => essayBenchmarkGate(tx, 'production'))).toEqual({ released: true, runId: run!.id });
    await db.query(`update ai_models set status = 'retired' where model_id = 'modelo-teste-essay'`);
    expect((await asService((tx) => essayBenchmarkGate(tx, 'production'))).released).toBe(false);
  });
});
