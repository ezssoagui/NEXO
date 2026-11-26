import { appendFileSync, mkdirSync } from 'node:fs';
import { env } from '@/config/env';
import { asService } from '@/server/db';
import { one } from '@/server/db/types';
import { generateTotpSecret, hashPassword, randomToken, sha256, verifyPassword, verifyTotp } from './crypto';
import { isStrongPassword, type AuthProvider, type AuthResult, type SessionData } from './provider';

/**
 * Provedor LOCAL — exclusivamente desenvolvimento e testes automatizados.
 * env() impede seu uso em produção. E-mails de verificação/recuperação vão para a caixa de
 * desenvolvimento (memória + .data/dev-mail.log), nunca para destinatários reais.
 */
export interface DevMail { to: string; subject: string; link: string; at: string }
declare global {
  var __nexoDevMailbox: DevMail[] | undefined;
}
export function devMailbox(): DevMail[] {
  globalThis.__nexoDevMailbox ??= [];
  return globalThis.__nexoDevMailbox;
}

function sendDevMail(mail: Omit<DevMail, 'at'>): void {
  const entry = { ...mail, at: new Date().toISOString() };
  devMailbox().push(entry);
  try {
    mkdirSync('.data', { recursive: true });
    appendFileSync('.data/dev-mail.log', JSON.stringify(entry) + '\n');
  } catch {
    // caixa em memória é suficiente para testes
  }
}

async function issueToken(userId: string, purpose: 'email_verification' | 'password_reset', ttlMinutes: number): Promise<string> {
  const token = randomToken();
  await asService((tx) =>
    tx.query(`insert into auth.local_tokens (token_hash, user_id, purpose, expires_at) values ($1,$2,$3, now() + make_interval(mins => $4))`, [
      sha256(token), userId, purpose, ttlMinutes,
    ]),
  );
  return token;
}

async function consumeToken(token: string, purpose: string): Promise<string | null> {
  return asService(async (tx) => {
    const row = await one<{ user_id: string }>(
      tx,
      `update auth.local_tokens set used_at = now() where token_hash = $1 and purpose = $2 and used_at is null and expires_at > now() returning user_id`,
      [sha256(token), purpose],
    );
    return row?.user_id ?? null;
  });
}

const session = (id: string, email: string, aal: 'aal1' | 'aal2'): SessionData => ({ sub: id, email, aal, prov: 'local' });

export const localProvider: AuthProvider = {
  name: 'local',

  async signUp(email, password) {
    if (!isStrongPassword(password)) return { ok: false, code: 'weak_password' };
    const normalized = email.trim().toLowerCase();
    const verify = env().NEXO_EMAIL_VERIFICATION === 'required';
    const userId = await asService(async (tx) => {
      const exists = await one(tx, 'select 1 from auth.users where email = $1', [normalized]);
      if (exists) return null;
      const [u] = await tx.query<{ id: string }>('insert into auth.users (email) values ($1) returning id', [normalized]);
      await tx.query('insert into auth.local_credentials (user_id, password_hash) values ($1, $2)', [u!.id, hashPassword(password)]);
      return u!.id;
    });
    if (!userId) return { ok: false, code: 'email_taken' };
    if (!verify) return { ok: true, userId, needsVerification: false, session: session(userId, normalized, 'aal1') };
    const token = await issueToken(userId, 'email_verification', 60 * 24);
    sendDevMail({ to: normalized, subject: 'Confirme seu e-mail no NEXO', link: `${env().NEXO_APP_URL}/auth/confirmar?token_hash=${token}&type=signup` });
    return { ok: true, userId, needsVerification: true, session: null };
  },

  async signIn(email, password): Promise<AuthResult> {
    const normalized = email.trim().toLowerCase();
    const row = await asService((tx) =>
      one<{ id: string; email: string; email_confirmed_at: Date | null; password_hash: string }>(
        tx,
        `select u.id, u.email, u.email_confirmed_at, c.password_hash from auth.users u join auth.local_credentials c on c.user_id = u.id where u.email = $1`,
        [normalized],
      ),
    );
    if (!row || !verifyPassword(password, row.password_hash)) return { ok: false, code: 'invalid_credentials' };
    // Contas criadas antes de desligar a verificação também passam a entrar (o e-mail segue NÃO marcado como confirmado).
    if (!row.email_confirmed_at && env().NEXO_EMAIL_VERIFICATION === 'required') return { ok: false, code: 'email_not_verified' };
    return { ok: true, session: session(row.id, row.email, 'aal1') };
  },

  async verifyEmail(tokenHash) {
    const userId = await consumeToken(tokenHash, 'email_verification');
    if (!userId) return { ok: false, code: 'invalid_token' };
    const u = await asService(async (tx) => {
      await tx.query('update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1', [userId]);
      return one<{ email: string }>(tx, 'select email from auth.users where id = $1', [userId]);
    });
    return { ok: true, session: session(userId, u!.email, 'aal1') };
  },

  async requestPasswordReset(email) {
    const normalized = email.trim().toLowerCase();
    const u = await asService((tx) => one<{ id: string }>(tx, 'select id from auth.users where email = $1', [normalized]));
    if (!u) return; // não revela existência da conta
    const token = await issueToken(u.id, 'password_reset', 60);
    sendDevMail({ to: normalized, subject: 'Redefinição de senha do NEXO', link: `${env().NEXO_APP_URL}/redefinir-senha?token_hash=${token}` });
  },

  async resetPassword(tokenHash, newPassword) {
    if (!isStrongPassword(newPassword)) return false;
    const userId = await consumeToken(tokenHash, 'password_reset');
    if (!userId) return false;
    await asService((tx) => tx.query('update auth.local_credentials set password_hash = $2, updated_at = now() where user_id = $1', [userId, hashPassword(newPassword)]));
    return true;
  },

  async mfaStatus(s) {
    const row = await asService((tx) => one<{ totp_confirmed_at: Date | null }>(tx, 'select totp_confirmed_at from auth.local_credentials where user_id = $1', [s.sub]));
    return { enrolled: Boolean(row?.totp_confirmed_at) };
  },

  async mfaEnroll(s) {
    const status = await this.mfaStatus(s);
    if (status.enrolled) return { ok: false, code: 'not_supported' };
    const secret = generateTotpSecret();
    await asService((tx) => tx.query('update auth.local_credentials set totp_secret = $2 where user_id = $1', [s.sub, secret]));
    const label = encodeURIComponent(`NEXO:${s.email}`);
    return { ok: true, factorId: 'local-totp', secret, otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=NEXO&algorithm=SHA1&digits=6&period=30` };
  },

  async mfaVerify(s, code) {
    const row = await asService((tx) => one<{ totp_secret: string | null }>(tx, 'select totp_secret from auth.local_credentials where user_id = $1', [s.sub]));
    if (!row?.totp_secret) return { ok: false, code: 'mfa_not_enrolled' };
    if (!verifyTotp(row.totp_secret, code)) return { ok: false, code: 'invalid_code' };
    await asService((tx) => tx.query('update auth.local_credentials set totp_confirmed_at = coalesce(totp_confirmed_at, now()) where user_id = $1', [s.sub]));
    return { ok: true, session: { ...s, aal: 'aal2' } };
  },

  async oauthStart() {
    return null; // Google requer Supabase Auth configurado
  },
  async oauthCallback() {
    return { ok: false, code: 'not_supported' };
  },
  async refresh(s) {
    return s;
  },
  async signOut() {},
  async deleteUser(userId) {
    await asService((tx) => tx.query('delete from auth.users where id = $1', [userId]));
  },
};
