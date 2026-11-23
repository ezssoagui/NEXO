import type { DB } from './db';
import type { AuthUser, Result } from './auth';

/** Histórico de aprendizagem e estado do aluno. Cada usuário só acessa os próprios dados; admin vê só agregados. */
const MAX_STATE = 3_000_000;
const deny = (status = 401): Result => ({ status, body: { error: status === 401 ? 'unauthorized' : 'forbidden', message: status === 401 ? 'Faça login.' : 'Acesso restrito.' } });

export function putState(db: DB, user: AuthUser | null, body: any, raw: string): Result {
  if (!user) return deny();
  if (raw.length > MAX_STATE) return { status: 413, body: { error: 'too_large', message: 'Estado grande demais.' } };
  const state = body?.state; if (!state || typeof state !== 'object') return { status: 400, body: { error: 'bad_request', message: 'Estado ausente.' } };
  const { account, toast, ...clean } = state;   // nunca persiste token
  db.saveState(user.id, JSON.stringify(clean));
  if (Array.isArray(clean.attempts)) db.upsertAttempts(user.id, clean.attempts.slice(-5000));
  return { status: 200, body: { ok: true, savedAt: Date.now() } };
}
export function getState(db: DB, user: AuthUser | null): Result {
  if (!user) return deny();
  const row = db.getState(user.id);
  return { status: 200, body: { state: row ? JSON.parse(row.json) : null, updatedAt: row?.updated_at ?? null } };
}
export function exportMe(db: DB, user: AuthUser | null): Result {
  if (!user) return deny();
  const row = db.getState(user.id);
  return { status: 200, body: { exportedAt: new Date().toISOString(), account: db.userById(user.id), state: row ? JSON.parse(row.json) : null, attempts: db.attemptsOf(user.id) } };
}
export function deleteMe(db: DB, user: AuthUser | null): Result { if (!user) return deny(); db.deleteUser(user.id); return { status: 204, body: null }; }
export function adminMetrics(db: DB, user: AuthUser | null): Result { if (!user) return deny(); if (user.role !== 'admin') return deny(403); return { status: 200, body: db.metrics() }; }
