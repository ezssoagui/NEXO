import { createPGlite } from '@/server/db/drivers';
import { migrate } from '@/server/db/migrate';
import type { Database } from '@/server/db/types';

/** Banco PGlite novo em memória, com shim local e todas as migrações. */
export async function freshDb(): Promise<Database> {
  const db = await createPGlite('memory://');
  await migrate(db, { withLocalShim: true });
  return db;
}

export async function createAuthUser(db: Database, email: string): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id`, [email]);
  return rows[0]!.id;
}
