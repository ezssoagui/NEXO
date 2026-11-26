import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { pgtap } from '@electric-sql/pglite-pgtap';
import { migrate } from '@/server/db/migrate';
import type { Database } from '@/server/db/types';

/** Executa os arquivos pgTAP de supabase/tests em PGlite (mesmas migrações do Supabase). */
describe('pgTAP (supabase/tests)', () => {
  const dir = path.join(process.cwd(), 'supabase', 'tests');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    it(file, async () => {
      const pg = await PGlite.create({ extensions: { vector, pgcrypto, pgtap } });
      const db: Database = {
        driver: 'pglite',
        query: async (sql, params) => (await pg.query(sql, params)).rows as never,
        exec: async (sql) => { await pg.exec(sql); },
        transaction: (fn) => pg.transaction((tx) => fn({ query: async (s, p) => (await tx.query(s, p)).rows as never, exec: async (s) => { await tx.exec(s); } })),
        close: () => pg.close(),
      };
      await migrate(db, { withLocalShim: true });
      await pg.exec('create extension if not exists pgtap');
      const results = await pg.exec(readFileSync(path.join(dir, file), 'utf8'));
      const lines = results.flatMap((r) => r.rows.map((row) => String(Object.values(row)[0])));
      const tap = lines.filter((l) => /^(not )?ok \d+|^1\.\.\d+|^# /.test(l));
      const failures = tap.filter((l) => l.startsWith('not ok') || l.startsWith('# Looks like'));
      expect(failures, tap.join('\n')).toEqual([]);
      expect(tap.some((l) => l.startsWith('ok '))).toBe(true);
      await pg.close();
    });
  }
});
