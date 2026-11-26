/** Interface mínima de acesso SQL, comum a PGlite (local/testes) e Postgres (Supabase). */
export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface Tx extends Queryable {
  /** Executa várias instruções sem parâmetros (migrações). */
  exec(sql: string): Promise<void>;
}

export interface Database extends Tx {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  readonly driver: 'pglite' | 'postgres';
}

export interface UserClaims {
  sub: string;
  aal: 'aal1' | 'aal2';
  email?: string;
}

export async function one<T>(q: Queryable, sql: string, params?: unknown[]): Promise<T | undefined> {
  const rows = await q.query<T>(sql, params);
  return rows[0];
}

export async function must<T>(q: Queryable, sql: string, params?: unknown[]): Promise<T> {
  const row = await one<T>(q, sql, params);
  if (row === undefined) throw new Error('Registro esperado não encontrado');
  return row;
}

/** Converte numeric/bigint retornados como string em number (null preservado). */
export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
