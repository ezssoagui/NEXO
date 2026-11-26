import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@/config/env';
import { AppError } from '@/server/http/errors';
import { runEssayBenchmark } from '@/server/services/essay-benchmark';
import { safeEqual } from '@/server/auth/crypto';
import { asService } from '@/server/db';
import { reconcileSubscriptions } from '@/server/services/commerce';
import { processTwinRequests } from '@/server/services/twins';
import { checkBackupFreshness, recordBackupRun } from '@/server/services/admin';
import { loadReferenceData } from '@/server/db/reference-loader';

/** Jobs agendados (Cron do provedor): reconciliação, fila de gêmeas e verificação de backups. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ job: string }> }) {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!secret || !safeEqual(auth, secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { job } = await ctx.params;
  switch (job) {
    case 'reconcile': return NextResponse.json(await reconcileSubscriptions());
    case 'twins': return NextResponse.json(await processTwinRequests(5));
    case 'backup-check': return NextResponse.json(await asService((tx) => checkBackupFreshness(tx)));
    case 'record-backup': {
      const b = await req.json().catch(() => null);
      if (!b || !['backup', 'restore_test'].includes(b.kind) || !['success', 'failed'].includes(b.status) || typeof b.startedAt !== 'string') {
        return NextResponse.json({ error: 'bad_request' }, { status: 400 });
      }
      return NextResponse.json(await recordBackupRun(b));
    }
    case 'load-reference': {
      // Carrega/atualiza dados de referência (currículo-base, rubrica e relevância) sem ativar versão por padrão.
      const activate = req.nextUrl.searchParams.get('activate') === '1';
      return NextResponse.json(await asService((tx) => loadReferenceData(tx, { activateCurriculum: activate })));
    }
    case 'essay-benchmark': {
      // Benchmark do corretor (6.3). Conjuntos JSONL ficam apenas no servidor, em data/private/essay-benchmark (fora do Git).
      const parsed = benchmarkJobSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return NextResponse.json({ error: 'bad_request', issues: parsed.error.issues.map((i) => i.message) }, { status: 400 });
      try {
        const ds = readBenchmarkDatasets(parsed.data.datasets);
        const samples = parsed.data.limit ? ds.samples.slice(0, parsed.data.limit) : ds.samples;
        return NextResponse.json(await runEssayBenchmark({ label: parsed.data.label, datasetSha256: ds.sha256, samples, confirmPaidCalls: parsed.data.confirmPaidCalls }));
      } catch (err) {
        if (err instanceof AppError) return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
        throw err;
      }
    }
    default: return NextResponse.json({ error: 'unknown_job' }, { status: 404 });
  }
}

const benchmarkJobSchema = z.object({
  label: z.string().min(1).max(120),
  datasets: z.array(z.string().regex(/^[\w.-]+\.jsonl$/, 'nome de arquivo .jsonl simples')).min(1).max(20),
  limit: z.number().int().min(1).max(500).optional(),
  confirmPaidCalls: z.boolean().default(false),
});

function readBenchmarkDatasets(names: string[]): { samples: unknown[]; sha256: string } {
  const dir = path.join(process.cwd(), 'data', 'private', 'essay-benchmark');
  const hash = createHash('sha256');
  const samples: unknown[] = [];
  for (const name of names) {
    const file = path.join(dir, path.basename(name));
    if (!existsSync(file)) throw new AppError(404, 'dataset_not_found', `Conjunto ${name} não encontrado no servidor.`);
    const raw = readFileSync(file);
    hash.update(raw);
    for (const line of raw.toString('utf8').split('\n')) if (line.trim()) samples.push(JSON.parse(line));
  }
  return { samples, sha256: hash.digest('hex') };
}
