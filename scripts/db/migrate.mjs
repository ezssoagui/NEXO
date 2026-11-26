// Aplica as migrações de supabase/migrations em um Postgres via DATABASE_URL (homologação/
// produção sem Supabase CLI) ou em um diretório PGlite local (NEXO_PGLITE_DIR).
// No Supabase, o caminho recomendado é a CLI oficial: `supabase db push`.
// Uso: node scripts/db/migrate.mjs            (lê .env.local se existir)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
if (existsSync(path.join(root, '.env.local'))) {
  for (const line of readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function connect() {
  if (process.env.DATABASE_URL) {
    const { default: postgres } = await import('postgres');
    const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, ssl: process.env.DATABASE_URL.includes('localhost') ? false : 'require' });
    return { exec: (s) => sql.unsafe(s), query: (s, p) => sql.unsafe(s, p ?? []), tx: (fn) => sql.begin((t) => fn({ exec: (s) => t.unsafe(s), query: (s, p) => t.unsafe(s, p ?? []) })), end: () => sql.end(), local: false };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { vector } = await import('@electric-sql/pglite-pgvector');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const pg = await PGlite.create(process.env.NEXO_PGLITE_DIR ?? './.data/pglite', { extensions: { vector, pgcrypto } });
  return { exec: (s) => pg.exec(s), query: async (s, p) => (await pg.query(s, p)).rows, tx: (fn) => pg.transaction((t) => fn({ exec: (s) => t.exec(s), query: async (s, p) => (await t.query(s, p)).rows })), end: () => pg.close(), local: true };
}

const db = await connect();
if (db.local) {
  for (const f of readdirSync(path.join(root, 'supabase', 'local')).filter((f) => f.endsWith('.sql')).sort()) await db.exec(readFileSync(path.join(root, 'supabase', 'local', f), 'utf8'));
}
await db.exec(`create schema if not exists nexo_meta; create table if not exists nexo_meta.schema_migrations (version text primary key, applied_at timestamptz not null default now());`);
const done = new Set((await db.query('select version from nexo_meta.schema_migrations')).map((r) => r.version));
const dir = path.join(root, 'supabase', 'migrations');
let applied = 0;
for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  const version = f.replace(/\.sql$/, '');
  if (done.has(version)) continue;
  await db.tx(async (t) => {
    await t.exec(readFileSync(path.join(dir, f), 'utf8'));
    await t.query('insert into nexo_meta.schema_migrations (version) values ($1)', [version]);
  });
  console.log('aplicada', version);
  applied++;
}
console.log(`${applied} migração(ões) aplicada(s).`);
await db.end();
