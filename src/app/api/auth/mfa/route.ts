import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { authProvider, setSessionCookie } from '@/server/auth';
import { AppError } from '@/server/http/errors';

export const GET = route({ auth: 'user' }, async ({ user }) => ({ ...(await authProvider().mfaStatus(user!.session)), aal: user!.aal }));

export const POST = route({ auth: 'user', body: z.object({ action: z.enum(['enroll', 'verify']), code: z.string().regex(/^\d{6}$/).optional() }), rateLimit: { bucket: 'mfa', limit: 10, windowSeconds: 600 } },
  async ({ user, body }) => {
    const p = authProvider();
    if (body.action === 'enroll') {
      const r = await p.mfaEnroll(user!.session);
      if (!r.ok) throw new AppError(409, r.code, 'Autenticação multifator já configurada ou indisponível.');
      return { secret: r.secret, otpauthUrl: r.otpauthUrl };
    }
    const r = await p.mfaVerify(user!.session, body.code ?? '');
    if (!r.ok) throw new AppError(401, r.code, 'Código inválido.');
    await setSessionCookie(r.session);
    return { aal: r.session.aal };
  });
