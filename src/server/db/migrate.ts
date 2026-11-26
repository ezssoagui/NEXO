import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Database } from './types';

/**
 * Aplica migrações SQL versionadas de supabase/migrations em ordem, uma única vez cada.
 * Em PGlite aplica antes o shim local (supabase/local). No Supabase real, as migrações
 * são aplicadas pela CLI do Supabase (`supabase db push`), sem o shim.
 */
export async function migrate(db: Database, opts: { withLocalShim: boolean; root?: string }): Promise<string[]> {
  const root = opts.root ?? process.cwd();
  const applied: string[] = [];
  if (opts.withLocalShim) {
    const shimDir = path.join(root, 'supabase', 'local');
    for (const f of readdirSync(shimDir).filter((f) => f.endsWith('.sql')).sort()) {
      await db.exec(readFileSync(path.join(shimDir, f), 'utf8'));
    }
  }
  await db.exec(`create schema if not exists nexo_meta;
    create table if not exists nexo_meta.schema_migrations (version text primary key, applied_at timestamptz not null default now());`);
  const done = new Set(
    (await db.query<{ version: string }>('select version from nexo_meta.schema_migrations')).map((r) => r.version),
  );
  const dir = path.join(root, 'supabase', 'migrations');
  if (!existsSync(dir)) throw new Error('Diretório de migrações ausente');
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const version = f.replace(/\.sql$/, '');
    if (done.has(version)) continue;
    const sql = readFileSync(path.join(dir, f), 'utf8');
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query('insert into nexo_meta.schema_migrations (version) values ($1)', [version]);
    });
    applied.push(version);
  }
  return applied;
}
