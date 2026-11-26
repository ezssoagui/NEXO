import { cookies } from 'next/headers';
import { env } from '@/config/env';
import { asService } from '@/server/db';
import type { UserClaims } from '@/server/db/types';
import { localProvider } from './local-provider';
import type { AuthProvider, SessionData } from './provider';
import { SESSION_COOKIE, cookieOptions, signSession, verifySession } from './session';
import { supabaseProvider } from './supabase-provider';

export function authProvider(): AuthProvider {
  return env().NEXO_AUTH_PROVIDER === 'supabase' ? supabaseProvider : localProvider;
}

export interface CurrentUser {
  id: string;
  email: string;
  aal: 'aal1' | 'aal2';
  roles: string[];
  isAdmin: boolean; // papel admin (MFA verificado separadamente via aal)
  onboarded: boolean;
  suspended: boolean;
  session: SessionData;
}

export function claimsOf(u: CurrentUser): UserClaims {
  return { sub: u.id, aal: u.aal, email: u.email };
}

/** Lê e valida a sessão do cookie; renova tokens Supabase quando necessário. */
export async function currentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const payload = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  let session: SessionData = { sub: payload.sub, email: payload.email, aal: payload.aal, prov: payload.prov, sat: payload.sat, srt: payload.srt };
  if (payload.prov === 'supabase') {
    const refreshed = await authProvider().refresh(session).catch(() => null);
    if (!refreshed) return null;
    if (refreshed.sat !== session.sat) {
      session = refreshed;
      try {
        jar.set(SESSION_COOKIE, signSession(session), cookieOptions(env().NEXO_APP_URL));
      } catch {
        // Em Server Components não é possível gravar cookies; a renovação ocorre na próxima rota.
      }
    }
  }
  const info = await asService(async (tx) => {
    const roles = await tx.query<{ role: string }>('select role from user_roles where user_id = $1', [session.sub]);
    const prof = await tx.query<{ onboarding_completed_at: Date | null; suspended_at: Date | null }>(
      'select onboarding_completed_at, suspended_at from profiles where id = $1', [session.sub]);
    return { roles: roles.map((r) => r.role), profile: prof[0] };
  });
  return {
    id: session.sub, email: session.email, aal: session.aal, roles: info.roles,
    isAdmin: info.roles.includes('admin'), onboarded: Boolean(info.profile?.onboarding_completed_at),
    suspended: Boolean(info.profile?.suspended_at), session,
  };
}

export async function setSessionCookie(session: SessionData): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(session), cookieOptions(env().NEXO_APP_URL));
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
