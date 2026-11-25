import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { DB } from '../db';

/**
 * Repositório de Contas, Sessões, Recuperação de Senha e Perfil Pedagógico (LGPD).
 * FR-001 a FR-005: e-mail + senha, apelido pedagógico, separação Pagador × Estudante (sem CPF do menor).
 */
const SESSION_DAYS = 30;
const RESET_TOKEN_MS = 60 * 60 * 1000; // 1 hora
const loginTries = new Map<string, { n: number; until: number }>();

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
const hashPass = (p: string, salt: string) => scryptSync(p, salt, 64).toString('hex');

export interface AuthUserV1 {
  id: string;
  email: string;
  nickname: string;
  role: 'student' | 'admin';
  isMinor: boolean;
}

export interface StudentProfileRow {
  userId: string;
  targetCourse: string | null;
  weeklyHours: number;
  examYear: number;
  perceivedDifficulties: string[];
  weeklyGoalQuestions: number;
  onboardingCompletedAt: number | null;
  updatedAt: number;
}

export function resetV1LoginThrottle() {
  loginTries.clear();
}

export class UsersRepository {
  constructor(private db: DB) {}

  register(input: { email: string; password: string; nickname: string; isMinor?: boolean; lgpdConsent?: boolean; adminCode?: string }) {
    const email = String(input.email ?? '').trim().toLowerCase();
    const nickname = String(input.nickname ?? '').trim();
    const password = String(input.password ?? '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false as const, status: 400, error: 'bad_request', message: 'Informe um e-mail válido.' };
    }
    if (!/^[\p{L}\p{N} _.-]{2,20}$/u.test(nickname)) {
      return { ok: false as const, status: 400, error: 'bad_request', message: 'Apelido deve ter de 2 a 20 caracteres.' };
    }
    if (password.length < 8) {
      return { ok: false as const, status: 400, error: 'bad_request', message: 'A senha deve ter pelo menos 8 caracteres.' };
    }
    if (input.lgpdConsent === false) {
      return { ok: false as const, status: 400, error: 'bad_request', message: 'É necessário aceitar a Política de Privacidade e LGPD.' };
    }
    if (this.db.userByEmail(email)) {
      return { ok: false as const, status: 409, error: 'conflict', message: 'E-mail já cadastrado.' };
    }
    if (this.db.userByNick(nickname)) {
      return { ok: false as const, status: 409, error: 'conflict', message: 'Apelido já em uso.' };
    }

    const adminCode = process.env.NEXO_ADMIN_CODE;
    const role: 'student' | 'admin' = adminCode && input.adminCode === adminCode ? 'admin' : 'student';
    const salt = randomBytes(16).toString('hex');
    const id = randomUUID();
    const now = Date.now();

    this.db.raw
      .prepare('INSERT INTO users (id, email, nickname, pass_hash, salt, role, lgpd_consent_at, is_minor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, email, nickname, hashPass(password, salt), salt, role, now, input.isMinor ? 1 : 0, now);

    this.db.raw
      .prepare('INSERT INTO student_profiles (user_id, weekly_hours, exam_year, perceived_difficulties, weekly_goal_questions, updated_at) VALUES (?, 10, ?, ?, 30, ?)')
      .run(id, new Date().getFullYear(), '[]', now);

    const token = this.issueSession(id);
    return {
      ok: true as const,
      status: 201,
      token,
      user: { id, email, nickname, role, isMinor: !!input.isMinor } satisfies AuthUserV1,
    };
  }

  login(emailRaw: string, password: string) {
    const email = String(emailRaw ?? '').trim().toLowerCase();
    const t = loginTries.get(email);
    if (t && t.n >= 8 && t.until > Date.now()) {
      return { ok: false as const, status: 429, error: 'locked', message: 'Muitas tentativas. Tente novamente em alguns minutos.' };
    }
    const u = this.db.userByEmail(email);
    const ok = !!u && timingSafeEqual(Buffer.from(hashPass(String(password ?? ''), u.salt), 'hex'), Buffer.from(u.pass_hash, 'hex'));
    if (!ok) {
      loginTries.set(email, { n: (t?.n ?? 0) + 1, until: Date.now() + 15 * 60_000 });
      return { ok: false as const, status: 401, error: 'unauthorized', message: 'E-mail ou senha incorretos.' };
    }
    loginTries.delete(email);
    const token = this.issueSession(u.id);
    return {
      ok: true as const,
      status: 200,
      token,
      user: { id: u.id, email: u.email, nickname: u.nickname, role: u.role, isMinor: !!u.is_minor } satisfies AuthUserV1,
    };
  }

  authenticate(authHeader?: string | string[]): AuthUserV1 | null {
    const h = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const m = h?.match(/^Bearer\s+(.+)$/i);
    if (!m) return null;
    const row = this.db.sessionUser(hashToken(m[1]));
    if (!row) return null;
    return { id: row.id, email: row.email ?? '', nickname: row.nickname, role: row.role, isMinor: !!row.is_minor };
  }

  logout(authHeader?: string) {
    const m = authHeader?.match(/^Bearer\s+(.+)$/i);
    if (m) this.db.dropSession(hashToken(m[1]));
  }

  createPasswordResetToken(emailRaw: string): { resetToken?: string } {
    const u = this.db.userByEmail(String(emailRaw ?? '').trim().toLowerCase());
    if (!u) return {};
    const resetToken = randomBytes(24).toString('base64url');
    this.db.raw
      .prepare('INSERT INTO password_reset_tokens (token_hash, user_id, expires, used_at) VALUES (?, ?, ?, NULL)')
      .run(hashToken(resetToken), u.id, Date.now() + RESET_TOKEN_MS);
    return { resetToken };
  }

  resetPassword(resetToken: string, newPassword: string) {
    if (String(newPassword ?? '').length < 8) {
      return { ok: false as const, status: 400, error: 'bad_request', message: 'A nova senha deve ter pelo menos 8 caracteres.' };
    }
    const hash = hashToken(String(resetToken ?? ''));
    const row = this.db.raw
      .prepare('SELECT user_id, expires, used_at FROM password_reset_tokens WHERE token_hash = ?')
      .get(hash) as any;
    if (!row || row.used_at || row.expires < Date.now()) {
      return { ok: false as const, status: 400, error: 'invalid_token', message: 'Token de recuperação inválido ou expirado.' };
    }
    const salt = randomBytes(16).toString('hex');
    this.db.raw.exec('BEGIN');
    try {
      this.db.raw.prepare('UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?').run(hashPass(newPassword, salt), salt, row.user_id);
      this.db.raw.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?').run(Date.now(), hash);
      this.db.raw.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
      this.db.raw.exec('COMMIT');
    } catch (e) {
      this.db.raw.exec('ROLLBACK');
      throw e;
    }
    return { ok: true as const, status: 200 };
  }

  getProfile(userId: string): StudentProfileRow | null {
    const r = this.db.raw.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(userId) as any;
    if (!r) return null;
    return {
      userId: r.user_id,
      targetCourse: r.target_course,
      weeklyHours: r.weekly_hours,
      examYear: r.exam_year,
      perceivedDifficulties: JSON.parse(r.perceived_difficulties || '[]'),
      weeklyGoalQuestions: r.weekly_goal_questions,
      onboardingCompletedAt: r.onboarding_completed_at,
      updatedAt: r.updated_at,
    };
  }

  updateProfile(
    userId: string,
    patch: { targetCourse?: string | null; weeklyHours?: number; examYear?: number; perceivedDifficulties?: string[]; weeklyGoalQuestions?: number; nickname?: string; onboardingCompletedAt?: number },
  ) {
    const now = Date.now();
    if (patch.nickname !== undefined) {
      const nick = String(patch.nickname).trim();
      if (!/^[\p{L}\p{N} _.-]{2,20}$/u.test(nick)) {
        return { ok: false as const, status: 400, message: 'Apelido inválido.' };
      }
      const existing = this.db.userByNick(nick);
      if (existing && existing.id !== userId) {
        return { ok: false as const, status: 409, message: 'Apelido já em uso.' };
      }
      this.db.raw.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(nick, userId);
    }
    const current = this.getProfile(userId);
    const targetCourse = patch.targetCourse !== undefined ? patch.targetCourse : current?.targetCourse ?? null;
    const weeklyHours = patch.weeklyHours !== undefined ? Math.max(1, Math.min(80, Math.round(patch.weeklyHours))) : current?.weeklyHours ?? 10;
    const examYear = patch.examYear !== undefined ? Math.round(patch.examYear) : current?.examYear ?? new Date().getFullYear();
    const perceivedDifficulties = patch.perceivedDifficulties !== undefined ? patch.perceivedDifficulties : current?.perceivedDifficulties ?? [];
    const weeklyGoalQuestions = patch.weeklyGoalQuestions !== undefined ? Math.max(5, Math.min(500, Math.round(patch.weeklyGoalQuestions))) : current?.weeklyGoalQuestions ?? 30;
    const onboardingCompletedAt = patch.onboardingCompletedAt !== undefined ? patch.onboardingCompletedAt : current?.onboardingCompletedAt ?? null;

    this.db.raw
      .prepare(
        `INSERT INTO student_profiles (user_id, target_course, weekly_hours, exam_year, perceived_difficulties, weekly_goal_questions, onboarding_completed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           target_course = excluded.target_course,
           weekly_hours = excluded.weekly_hours,
           exam_year = excluded.exam_year,
           perceived_difficulties = excluded.perceived_difficulties,
           weekly_goal_questions = excluded.weekly_goal_questions,
           onboarding_completed_at = excluded.onboarding_completed_at,
           updated_at = excluded.updated_at`,
      )
      .run(userId, targetCourse, weeklyHours, examYear, JSON.stringify(perceivedDifficulties), weeklyGoalQuestions, onboardingCompletedAt, now);

    return { ok: true as const, status: 200, profile: this.getProfile(userId)! };
  }

  exportUserData(userId: string) {
    const account = this.db.userById(userId);
    const profile = this.getProfile(userId);
    const subscriptions = this.db.raw
      .prepare('SELECT id, plan_code, payment_method, status, current_period_start, current_period_end, cdc_deadline_at, grace_until, updated_at FROM subscriptions WHERE user_id = ? ORDER BY updated_at DESC')
      .all(userId);
    const attempts = this.db.attemptsOf(userId);
    const essays = this.db.raw.prepare('SELECT * FROM essays WHERE user_id = ?').all(userId);
    const flashcards = this.db.raw.prepare('SELECT * FROM flashcards WHERE owner_user_id = ?').all(userId);
    const simulations = this.db.raw.prepare('SELECT * FROM simulations WHERE user_id = ?').all(userId);
    const streak = this.db.raw.prepare('SELECT * FROM daily_streaks WHERE user_id = ?').get(userId) ?? null;

    return {
      exportedAt: new Date().toISOString(),
      lgpdNotice: 'Exportação integral dos dados pedagógicos do estudante (dados fiscais do pagador permanecem isolados conforme LGPD).',
      account,
      profile,
      subscriptions,
      attempts,
      essays,
      flashcards,
      simulations,
      streak,
    };
  }

  deleteAccount(userId: string) {
    // ON DELETE CASCADE remove sessões, perfil, assinaturas, cotas, tentativas, redações, flashcards privados e simulados.
    // Payers permanecem preservados (ou sem vínculo pessoal ao estudante) para fins fiscais/contábeis.
    this.db.deleteUser(userId);
  }

  private issueSession(userId: string): string {
    const token = randomBytes(32).toString('base64url');
    this.db.addSession(hashToken(token), userId, Date.now() + SESSION_DAYS * 86_400_000);
    return token;
  }
}
