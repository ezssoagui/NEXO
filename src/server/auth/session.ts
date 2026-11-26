import { hmac, safeEqual } from './crypto';
import { sessionSecret } from '@/config/env';

/**
 * Cookie de sessão assinado (HMAC-SHA256), httpOnly, SameSite=Lax, Secure fora de localhost.
 * Para o provedor Supabase, o cookie carrega também os tokens emitidos pelo Supabase Auth,
 * revalidados periodicamente.
 */
export const SESSION_COOKIE = 'nexo_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface SessionPayload {
  sub: string;
  email: string;
  aal: 'aal1' | 'aal2';
  prov: 'local' | 'supabase';
  iat: number;
  exp: number;
  sat?: string; // access token do Supabase
  srt?: string; // refresh token do Supabase
}

export function signSession(p: Omit<SessionPayload, 'iat' | 'exp'>, ttl = SESSION_TTL_SECONDS): string {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ ...p, iat: now, exp: now + ttl })).toString('base64url');
  return `${body}.${hmac(sessionSecret(), body)}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig || !safeEqual(sig, hmac(sessionSecret(), body))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;
    if (typeof p.exp !== 'number' || p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}

export function cookieOptions(appUrl: string) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: !appUrl.startsWith('http://localhost') && !appUrl.startsWith('http://127.0.0.1'),
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
