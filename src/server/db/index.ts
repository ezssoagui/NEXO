import { env } from '@/config/env';
import { createPGlite, createPostgres } from './drivers';
import { migrate } from './migrate';
import type { Database, Tx, UserClaims } from './types';

declare global {
  var __nexoDb: Promise<Database> | undefined;
}

/** Instância única por processo. Em PGlite aplica migrações automaticamente (dev/test). */
export function getDb(): Promise<Database> {
  globalThis.__nexoDb ??= (async () => {
    const e = env();
    if (e.NEXO_DB_DRIVER === 'postgres') {
      if (!e.DATABASE_URL) throw new Error('DATABASE_URL ausente');
      return createPostgres(e.DATABASE_URL);
    }
    const db = await createPGlite(e.NEXO_PGLITE_DIR);
    await migrate(db, { withLocalShim: true });
    if (e.NEXO_SEED_SYNTHETIC === '1') {
      const { seedDevelopment } = await import('./seed');
      await seedDevelopment(db);
    }
    return db;
  })();
  return globalThis.__nexoDb;
}

/** Substitui a instância (testes de integração). */
export function setDbForTests(db: Database | undefined): void {
  globalThis.__nexoDb = db ? Promise.resolve(db) : undefined;
}

/**
 * Executa em transação com o papel `authenticated` e claims do usuário:
 * as políticas RLS são aplicadas pelo banco (defesa em profundidade).
 */
export async function asUser<T>(claims: UserClaims, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: claims.sub, role: 'authenticated', aal: claims.aal }),
    ]);
    await tx.query('set local role authenticated');
    return fn(tx);
  });
}

/**
 * Contexto de serviço (dono das tabelas): usado SOMENTE após autorização na camada de
 * aplicação, para escritas de integridade (evidências, XP, franquias, webhooks, admin).
 */
export async function asService<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(fn);
}
