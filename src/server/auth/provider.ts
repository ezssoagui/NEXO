import type { SessionPayload } from './session';

export type SessionData = Omit<SessionPayload, 'iat' | 'exp'>;

export type AuthErrorCode =
  | 'invalid_credentials' | 'email_not_verified' | 'email_taken' | 'weak_password' | 'invalid_token'
  | 'invalid_code' | 'mfa_not_enrolled' | 'unavailable' | 'not_supported';

export type AuthResult = { ok: true; session: SessionData } | { ok: false; code: AuthErrorCode };

/**
 * Contrato de autenticação (13.3). Implementações: Supabase Auth (produção/homologação) e
 * provedor local (somente desenvolvimento/testes, bloqueado em produção por env()).
 */
export interface AuthProvider {
  readonly name: 'local' | 'supabase';
  /** Sem verificação de e-mail, devolve a sessão já criada (session); com verificação, session = null. */
  signUp(email: string, password: string): Promise<{ ok: true; userId: string; needsVerification: boolean; session: SessionData | null } | { ok: false; code: AuthErrorCode }>;
  signIn(email: string, password: string): Promise<AuthResult>;
  verifyEmail(tokenHash: string, type: string): Promise<AuthResult | { ok: true; session: null }>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(tokenHash: string, newPassword: string): Promise<boolean>;
  mfaStatus(session: SessionData): Promise<{ enrolled: boolean }>;
  mfaEnroll(session: SessionData): Promise<{ ok: true; factorId: string; secret: string; otpauthUrl: string } | { ok: false; code: AuthErrorCode }>;
  mfaVerify(session: SessionData, code: string): Promise<AuthResult>;
  oauthStart(provider: 'google', redirectTo: string): Promise<{ url: string; verifier?: string } | null>;
  oauthCallback(code: string, verifier: string | undefined): Promise<AuthResult>;
  refresh(session: SessionData): Promise<SessionData | null>;
  signOut(session: SessionData): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

export function isStrongPassword(pw: string): boolean {
  return pw.length >= 10 && pw.length <= 128 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}
