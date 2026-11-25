import type { DB } from '../db';
import { UsersRepository, type AuthUserV1 } from '../repositories/users';
import { BillingRepository, hasActivePedagogicalAccess } from '../repositories/billing';
import { QuotasRepository } from '../repositories/quotas';

export interface RouteResult {
  status: number;
  body: unknown;
}

export function createAuthRoutes(db: DB) {
  const users = new UsersRepository(db);
  const billing = new BillingRepository(db);
  const quotas = new QuotasRepository(db);

  return {
    authenticate: (authHeader?: string | string[]) => users.authenticate(authHeader),

    register: (body: any): RouteResult => {
      const r = users.register({
        email: body?.email,
        password: body?.password,
        nickname: body?.nickname,
        isMinor: !!body?.isMinor,
        lgpdConsent: body?.lgpdConsent !== false,
        adminCode: body?.adminCode,
      });
      if (!r.ok) return { status: r.status, body: { error: r.error, message: r.message } };
      return { status: 201, body: { token: r.token, user: r.user } };
    },

    login: (body: any): RouteResult => {
      const r = users.login(body?.email, body?.password);
      if (!r.ok) return { status: r.status, body: { error: r.error, message: r.message } };
      return { status: 200, body: { token: r.token, user: r.user } };
    },

    logout: (authHeader?: string): RouteResult => {
      users.logout(authHeader);
      return { status: 204, body: null };
    },

    forgotPassword: (body: any): RouteResult => {
      const { resetToken } = users.createPasswordResetToken(body?.email);
      const isDev = process.env.NODE_ENV !== 'production';
      return {
        status: 200,
        body: {
          message: 'Se o e-mail estiver cadastrado, enviamos as instruções de recuperação.',
          ...(isDev && resetToken ? { devResetToken: resetToken } : {}),
        },
      };
    },

    resetPassword: (body: any): RouteResult => {
      const r = users.resetPassword(body?.token, body?.newPassword);
      if (!r.ok) return { status: r.status, body: { error: r.error, message: r.message } };
      return { status: 200, body: { message: 'Senha redefinida com sucesso.' } };
    },

    me: (user: AuthUserV1 | null): RouteResult => {
      if (!user) return { status: 401, body: { error: 'unauthorized', message: 'Faça login para continuar.' } };
      const profile = users.getProfile(user.id);
      const subscription = billing.getLatestForUser(user.id);
      const access = hasActivePedagogicalAccess(subscription);
      const quota = access ? quotas.getSnapshot(user.id) : null;
      return {
        status: 200,
        body: { user, profile, subscription, hasPedagogicalAccess: access, quotas: quota },
      };
    },

    updateProfile: (user: AuthUserV1 | null, body: any): RouteResult => {
      if (!user) return { status: 401, body: { error: 'unauthorized' } };
      const r = users.updateProfile(user.id, {
        targetCourse: body?.targetCourse,
        weeklyHours: body?.weeklyHours !== undefined ? Number(body.weeklyHours) : undefined,
        examYear: body?.examYear !== undefined ? Number(body.examYear) : undefined,
        perceivedDifficulties: Array.isArray(body?.perceivedDifficulties) ? body.perceivedDifficulties.map(String) : undefined,
        weeklyGoalQuestions: body?.weeklyGoalQuestions !== undefined ? Number(body.weeklyGoalQuestions) : undefined,
        nickname: body?.nickname,
        onboardingCompletedAt: body?.onboardingCompletedAt !== undefined ? Number(body.onboardingCompletedAt) : undefined,
      });
      if (!r.ok) return { status: r.status, body: { error: 'bad_request', message: r.message } };
      return { status: 200, body: { profile: r.profile } };
    },

    exportMe: (user: AuthUserV1 | null): RouteResult => {
      if (!user) return { status: 401, body: { error: 'unauthorized' } };
      return { status: 200, body: users.exportUserData(user.id) };
    },

    deleteMe: (user: AuthUserV1 | null): RouteResult => {
      if (!user) return { status: 401, body: { error: 'unauthorized' } };
      users.deleteAccount(user.id);
      return { status: 204, body: null };
    },
  };
}
