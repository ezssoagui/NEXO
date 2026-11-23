import type { DatabaseSync as DatabaseSyncT } from 'node:sqlite';
import { createRequire } from 'node:module';
// Carregado via require para funcionar também sob o Vitest/Vite (que reescreve o prefixo node:).
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: typeof DatabaseSyncT };
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * PERSISTÊNCIA — SQLite nativo do Node (node:sqlite). Em produção, troque por PostgreSQL mantendo esta interface.
 * Guarda: contas (apelido + hash de senha), sessões (hash do token), histórico de aprendizagem (cada tentativa) e o estado do aluno.
 */
export type DB = ReturnType<typeof openDb>;
export function openDb(path = process.env.NEXO_DB_PATH || 'server/data/nexo.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, nickname TEXT UNIQUE NOT NULL COLLATE NOCASE, pass_hash TEXT NOT NULL, salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'student', created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts (id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, ts INTEGER NOT NULL, qid TEXT, skill_id TEXT, correct INTEGER, confidence TEXT, cause TEXT, intervention TEXT, payload TEXT NOT NULL, PRIMARY KEY (user_id, id));
    CREATE TABLE IF NOT EXISTS state (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, json TEXT NOT NULL, updated_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_attempts_user_ts ON attempts(user_id, ts);
  `);
  return {
    raw: db,
    createUser: (u: { id: string; nickname: string; pass_hash: string; salt: string; role: string }) => db.prepare('INSERT INTO users (id, nickname, pass_hash, salt, role, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(u.id, u.nickname, u.pass_hash, u.salt, u.role, Date.now()),
    userByNick: (n: string) => db.prepare('SELECT * FROM users WHERE nickname = ?').get(n) as any,
    userById: (id: string) => db.prepare('SELECT id, nickname, role, created_at FROM users WHERE id = ?').get(id) as any,
    addSession: (hash: string, userId: string, expires: number) => db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hash, userId, expires),
    sessionUser: (hash: string) => db.prepare('SELECT u.id, u.nickname, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires > ?').get(hash, Date.now()) as any,
    dropSession: (hash: string) => db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash),
    saveState: (userId: string, json: string) => db.prepare('INSERT INTO state VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at').run(userId, json, Date.now()),
    getState: (userId: string) => db.prepare('SELECT json, updated_at FROM state WHERE user_id = ?').get(userId) as any,
    upsertAttempts: (userId: string, list: any[]) => {
      const st = db.prepare('INSERT INTO attempts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, id) DO UPDATE SET cause = excluded.cause, intervention = excluded.intervention, payload = excluded.payload');
      db.exec('BEGIN'); try { for (const a of list) st.run(String(a.id), userId, +a.ts || 0, a.qid ?? null, a.skillId ?? null, a.correct ? 1 : 0, a.confidence ?? null, a.cause ?? null, a.intervention ?? null, JSON.stringify(a)); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    attemptsOf: (userId: string) => (db.prepare('SELECT payload FROM attempts WHERE user_id = ? ORDER BY ts').all(userId) as any[]).map((r) => JSON.parse(r.payload)),
    deleteUser: (userId: string) => db.prepare('DELETE FROM users WHERE id = ?').run(userId),
    metrics: () => {
      const one = (sql: string, ...p: any[]) => (db.prepare(sql).get(...p) as any).n as number;
      const causes = Object.fromEntries((db.prepare("SELECT cause, COUNT(*) n FROM attempts WHERE correct = 0 AND cause IS NOT NULL GROUP BY cause").all() as any[]).map((r) => [r.cause, r.n]));
      return { users: one('SELECT COUNT(*) n FROM users'), active7d: one('SELECT COUNT(DISTINCT user_id) n FROM attempts WHERE ts > ?', Date.now() - 7 * 86400000), attempts: one('SELECT COUNT(*) n FROM attempts'), correct: one('SELECT COUNT(*) n FROM attempts WHERE correct = 1'), causes };
    },
  };
}
