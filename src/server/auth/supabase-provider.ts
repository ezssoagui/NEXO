import { createHash, randomBytes } from 'node:crypto';
import { env } from '@/config/env';
import { isStrongPassword, type AuthProvider, type AuthResult, type SessionData } from './provider';

/**
 * Provedor Supabase Auth via API REST do GoTrue (sem SDK no cliente; chaves só no servidor).
 * STATUS: implementado conforme a documentação pública; NÃO testado contra um projeto real
 * (credenciais indisponíveis). Validar na prova de conceito antes do piloto.
 */
interface TokenResponse {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string };
}

function cfg() {
  const e = env();
  if (!e.SUPABASE_URL || !e.SUPABASE_ANON_KEY) throw new Error('Supabase Auth não configurado');
  return { url: e.SUPABASE_URL.replace(/\/$/, ''), key: e.SUPABASE_ANON_KEY };
}

async function gotrue<T>(path: string, init: RequestInit & { token?: string; serviceKey?: string } = {}): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  const { url, key } = cfg();
  const headers: Record<string, string> = { apikey: init.serviceKey ?? key, 'Content-Type': 'application/json' };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.serviceKey) headers.Authorization = `Bearer ${init.serviceKey}`;
  const res = await fetch(`${url}/auth/v1${path}`, { ...init, headers, signal: AbortSignal.timeout(10_000) });
  const body = (await res.json().catch(() => null)) as (T & { msg?: string; error_description?: string; error_code?: string }) | null;
  return { ok: res.ok, status: res.status, data: res.ok ? body : null, error: res.ok ? null : (body?.error_code ?? body?.msg ?? body?.error_description ?? String(res.status)) };
}

/** Lê claims do access token. A assinatura é validada pelo endpoint /user (revalidação). */
function claims(token: string): { sub: string; email: string; aal: 'aal1' | 'aal2'; exp: number } | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
    return { sub: payload.sub, email: payload.email, aal: payload.aal === 'aal2' ? 'aal2' : 'aal1', exp: payload.exp };
  } catch {
    return null;
  }
}

function toSession(t: TokenResponse): SessionData {
  const c = claims(t.access_token);
  return { sub: t.user.id, email: t.user.email, aal: c?.aal ?? 'aal1', prov: 'supabase', sat: t.access_token, srt: t.refresh_token };
}

export const supabaseProvider: AuthProvider = {
  name: 'supabase',

  async signUp(email, password) {
    if (!isStrongPassword(password)) return { ok: false, code: 'weak_password' };
    const redirect = encodeURIComponent(`${env().NEXO_APP_URL}/auth/confirmar`);
    const r = await gotrue<Partial<TokenResponse> & { id?: string; user?: { id: string; email: string } }>(`/signup?redirect_to=${redirect}`, { method: 'POST', body: JSON.stringify({ email, password }) });
    if (!r.ok) return { ok: false, code: r.status === 422 || r.error === 'user_already_exists' ? 'email_taken' : 'unavailable' };
    const id = r.data?.user?.id ?? r.data?.id;
    if (!id) return { ok: false, code: 'unavailable' };
    // Com "Confirm email" desligado no projeto Supabase, o GoTrue já devolve a sessão no cadastro.
    if (r.data?.access_token && r.data.refresh_token && r.data.user) {
      return { ok: true, userId: id, needsVerification: false, session: toSession(r.data as TokenResponse) };
    }
    return { ok: true, userId: id, needsVerification: true, session: null };
  },

  async signIn(email, password): Promise<AuthResult> {
    const r = await gotrue<TokenResponse>('/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (!r.ok) return { ok: false, code: r.error === 'email_not_confirmed' ? 'email_not_verified' : r.status >= 500 ? 'unavailable' : 'invalid_credentials' };
    return { ok: true, session: toSession(r.data!) };
  },

  async verifyEmail(tokenHash, type) {
    const r = await gotrue<TokenResponse>('/verify', { method: 'POST', body: JSON.stringify({ type: type === 'email' ? 'email' : 'signup', token_hash: tokenHash }) });
    if (!r.ok || !r.data) return { ok: false, code: 'invalid_token' };
    return { ok: true, session: toSession(r.data) };
  },

  async requestPasswordReset(email) {
    const redirect = encodeURIComponent(`${env().NEXO_APP_URL}/redefinir-senha`);
    await gotrue(`/recover?redirect_to=${redirect}`, { method: 'POST', body: JSON.stringify({ email }) });
  },

  async resetPassword(tokenHash, newPassword) {
    if (!isStrongPassword(newPassword)) return false;
    const v = await gotrue<TokenResponse>('/verify', { method: 'POST', body: JSON.stringify({ type: 'recovery', token_hash: tokenHash }) });
    if (!v.ok || !v.data) return false;
    const u = await gotrue('/user', { method: 'PUT', token: v.data.access_token, body: JSON.stringify({ password: newPassword }) });
    return u.ok;
  },

  async mfaStatus(s) {
    const r = await gotrue<{ factors?: { status: string; factor_type: string }[] }>('/user', { token: s.sat });
    return { enrolled: Boolean(r.data?.factors?.some((f) => f.factor_type === 'totp' && f.status === 'verified')) };
  },

  async mfaEnroll(s) {
    const r = await gotrue<{ id: string; totp: { secret: string; uri: string } }>('/factors', { method: 'POST', token: s.sat, body: JSON.stringify({ factor_type: 'totp', friendly_name: 'NEXO admin' }) });
    if (!r.ok || !r.data) return { ok: false, code: 'unavailable' };
    return { ok: true, factorId: r.data.id, secret: r.data.totp.secret, otpauthUrl: r.data.totp.uri };
  },

  async mfaVerify(s, code) {
    const u = await gotrue<{ factors?: { id: string; factor_type: string }[] }>('/user', { token: s.sat });
    const factor = u.data?.factors?.find((f) => f.factor_type === 'totp');
    if (!factor) return { ok: false, code: 'mfa_not_enrolled' };
    const ch = await gotrue<{ id: string }>(`/factors/${factor.id}/challenge`, { method: 'POST', token: s.sat, body: '{}' });
    if (!ch.ok || !ch.data) return { ok: false, code: 'unavailable' };
    const v = await gotrue<TokenResponse>(`/factors/${factor.id}/verify`, { method: 'POST', token: s.sat, body: JSON.stringify({ challenge_id: ch.data.id, code }) });
    if (!v.ok || !v.data) return { ok: false, code: 'invalid_code' };
    return { ok: true, session: toSession(v.data) };
  },

  async oauthStart(provider, redirectTo) {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const { url } = cfg();
    const q = new URLSearchParams({ provider, redirect_to: redirectTo, code_challenge: challenge, code_challenge_method: 's256' });
    return { url: `${url}/auth/v1/authorize?${q}`, verifier };
  },

  async oauthCallback(code, verifier) {
    if (!verifier) return { ok: false, code: 'invalid_token' };
    const r = await gotrue<TokenResponse>('/token?grant_type=pkce', { method: 'POST', body: JSON.stringify({ auth_code: code, code_verifier: verifier }) });
    if (!r.ok || !r.data) return { ok: false, code: 'invalid_token' };
    return { ok: true, session: toSession(r.data) };
  },

  async refresh(s) {
    const c = s.sat ? claims(s.sat) : null;
    if (c && c.exp - 60 > Date.now() / 1000) {
      // Revalida o token no servidor do Supabase (assinatura, revogação).
      const u = await gotrue('/user', { token: s.sat });
      if (u.ok) return s;
    }
    if (!s.srt) return null;
    const r = await gotrue<TokenResponse>('/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: s.srt }) });
    return r.ok && r.data ? toSession(r.data) : null;
  },

  async signOut(s) {
    if (s.sat) await gotrue('/logout', { method: 'POST', token: s.sat });
  },

  async deleteUser(userId) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente para exclusão de conta');
    const r = await gotrue(`/admin/users/${userId}`, { method: 'DELETE', serviceKey });
    if (!r.ok) throw new Error('Falha ao excluir usuário no Supabase Auth');
  },
};
