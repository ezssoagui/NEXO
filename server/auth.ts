import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { DB } from './db';

/**
 * AUTENTICAÇÃO E AUTORIZAÇÃO
 * - Conta por APELIDO + senha (sem e-mail, CPF ou nome real: minimização de dados para adolescentes).
 * - Senha com scrypt + sal; token aleatório de sessão guardado apenas como hash; expira em 30 dias.
 * - Papéis: student (só os próprios dados) e admin (métricas agregadas). Admin exige NEXO_ADMIN_CODE no cadastro.
 */
const SESSION_DAYS = 30;
const tries = new Map<string, { n: number; until: number }>();
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
const hashPass = (p: string, salt: string) => scryptSync(p, salt, 64).toString('hex');

export interface AuthUser { id: string; nickname: string; role: 'student' | 'admin' }
export type Result = { status: number; body: any };

export function register(db: DB, body: any): Result {
  const nickname = String(body?.nickname ?? '').trim(); const password = String(body?.password ?? '');
  if (!/^[\p{L}\p{N} _.-]{2,20}$/u.test(nickname)) return { status: 400, body: { error: 'bad_request', message: 'Apelido deve ter de 2 a 20 caracteres (letras, números, espaço, . _ -).' } };
  if (password.length < 8) return { status: 400, body: { error: 'bad_request', message: 'A senha deve ter pelo menos 8 caracteres.' } };
  if (db.userByNick(nickname)) return { status: 409, body: { error: 'conflict', message: 'Apelido já em uso.' } };
  const adminCode = process.env.NEXO_ADMIN_CODE;
  const role = adminCode && body?.adminCode === adminCode ? 'admin' : 'student';
  const salt = randomBytes(16).toString('hex'); const id = randomUUID();
  db.createUser({ id, nickname, pass_hash: hashPass(password, salt), salt, role });
  return { status: 201, body: issue(db, { id, nickname, role }) };
}

export function login(db: DB, body: any): Result {
  const nickname = String(body?.nickname ?? '').trim(); const password = String(body?.password ?? '');
  const key = nickname.toLowerCase(); const t = tries.get(key);
  if (t && t.n >= 8 && t.until > Date.now()) return { status: 429, body: { error: 'locked', message: 'Muitas tentativas. Tente novamente em alguns minutos.' } };
  const u = db.userByNick(nickname);
  const ok = !!u && timingSafeEqual(Buffer.from(hashPass(password, u.salt), 'hex'), Buffer.from(u.pass_hash, 'hex'));
  if (!ok) { tries.set(key, { n: (t?.n ?? 0) + 1, until: Date.now() + 15 * 60000 }); return { status: 401, body: { error: 'unauthorized', message: 'Apelido ou senha incorretos.' } }; }
  tries.delete(key);
  return { status: 200, body: issue(db, { id: u.id, nickname: u.nickname, role: u.role }) };
}

function issue(db: DB, u: AuthUser) { const token = randomBytes(32).toString('base64url'); db.addSession(hashToken(token), u.id, Date.now() + SESSION_DAYS * 86400000); return { token, nickname: u.nickname, role: u.role }; }

export function authenticate(db: DB, header?: string | string[]): AuthUser | null {
  const h = Array.isArray(header) ? header[0] : header;
  const m = h?.match(/^Bearer\s+(.+)$/i); if (!m) return null;
  return db.sessionUser(hashToken(m[1])) ?? null;
}
export function logout(db: DB, header?: string): Result { const m = header?.match(/^Bearer\s+(.+)$/i); if (m) db.dropSession(hashToken(m[1])); return { status: 204, body: null }; }
export const resetLoginThrottle = () => tries.clear();
