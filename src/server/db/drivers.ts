import type { PGlite as PGliteInstance } from '@electric-sql/pglite';
import type { Database, Tx } from './types';

type PgQueryable = Pick<PGliteInstance, 'query' | 'exec'>;

/** PGlite: Postgres embutido (WASM) para desenvolvimento local e testes, sem Docker. */
export async function createPGlite(dataDir: string): Promise<Database> {
  const [{ PGlite }, { vector }, { pgcrypto }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('@electric-sql/pglite-pgvector'),
    import('@electric-sql/pglite/contrib/pgcrypto'),
  ]);
  const extensions: Record<string, unknown> = { vector, pgcrypto };
  if (process.env.NEXO_PGTAP === '1') {
    const { pgtap } = await import('@electric-sql/pglite-pgtap');
    extensions.pgtap = pgtap;
  }
  const pg = (await PGlite.create(dataDir === 'memory://' ? undefined : dataDir, {
    extensions: extensions as never,
  })) as unknown as PGliteInstance;
  const wrap = (q: PgQueryable): Tx => ({
    async query<T>(sql: string, params?: unknown[]) {
      const r = await q.query<T>(sql, params as unknown[] | undefined);
      return r.rows;
    },
    async exec(sql: string) {
      await q.exec(sql);
    },
  });
  const base = wrap(pg);
  return {
    driver: 'pglite',
    query: base.query,
    exec: base.exec,
    transaction: (fn) => pg.transaction((tx) => fn(wrap(tx as never))),
    close: () => pg.close(),
  };
}

/** Postgres gerenciado (Supabase) via postgres.js, com pool e TLS. */
export async function createPostgres(url: string): Promise<Database> {
  const { default: postgres } = await import('postgres');
  const sql = postgres(url, {
    max: 10,
    idle_timeout: 30,
    prepare: false, // compatível com pooler em modo transação
    ssl: url.includes('localhost') ? false : 'require',
    types: { bigint: postgres.BigInt },
  });
  const wrap = (q: typeof sql): Tx => ({
    async query<T>(text: string, params?: unknown[]) {
      return (await q.unsafe(text, (params ?? []) as never[])) as unknown as T[];
    },
    async exec(text: string) {
      await q.unsafe(text);
    },
  });
  const base = wrap(sql);
  return {
    driver: 'postgres',
    query: base.query,
    exec: base.exec,
    transaction: (fn) => sql.begin((tx) => fn(wrap(tx as unknown as typeof sql))) as never,
    close: () => sql.end({ timeout: 5 }),
  };
}
