import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { migrate } from '@/server/db/migrate';

describe('migrações', () => {
  it('aplicam do zero e são idempotentes', async () => {
    const db = await freshDb();
    const again = await migrate(db, { withLocalShim: false });
    expect(again).toEqual([]);
    const versions = await db.query<{ version: string }>('select version from nexo_meta.schema_migrations order by 1');
    expect(versions.length).toBeGreaterThanOrEqual(10);
    await db.close();
  });

  it('todas as tabelas públicas têm RLS habilitada', async () => {
    const db = await freshDb();
    const rows = await db.query<{ tablename: string }>(
      `select c.relname as tablename from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(rows.map((r) => r.tablename)).toEqual([]);
    await db.close();
  });

  it('carrega dados de referência aprovados (franquias 11.5, XP 9.2)', async () => {
    const db = await freshDb();
    const limits = await db.query<{ plan_code: string; resource: string; limit_value: number | null }>(
      `select plan_code, resource, limit_value from plan_limits order by plan_code, resource`);
    const get = (p: string, r: string) => limits.find((l) => l.plan_code === p && l.resource === r)?.limit_value;
    expect([get('free', 'explanations'), get('plus', 'explanations'), get('pro', 'explanations')]).toEqual([1, 5, 15]);
    expect([get('free', 'essays'), get('plus', 'essays'), get('pro', 'essays')]).toEqual([1, 6, 12]);
    expect([get('free', 'rewrites'), get('plus', 'rewrites'), get('pro', 'rewrites')]).toEqual([3, 20, 60]);
    expect([get('free', 'discursive'), get('plus', 'discursive'), get('pro', 'discursive')]).toEqual([5, 30, 90]);
    expect([get('free', 'questions'), get('free', 'adaptive_sessions'), get('free', 'flashcards'), get('free', 'exams')]).toEqual([20, 2, 20, 1]);
    expect(get('plus', 'questions')).toBeNull();
    const prices = await db.query<{ code: string; monthly_price_cents: number | null }>(`select code, monthly_price_cents from plans`);
    expect(prices.every((p) => p.monthly_price_cents === null)).toBe(true);
    await db.close();
  });
});
