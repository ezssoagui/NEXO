import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { authProvider, setSessionCookie } from '@/server/auth';
import { AppError } from '@/server/http/errors';

export const POST = route({ auth: 'public', body: z.object({ email: z.string().email().max(200), password: z.string().min(1).max(128) }), rateLimit: { bucket: 'login', limit: 10, windowSeconds: 900, by: 'ip' } },
  async ({ body }) => {
    const r = await authProvider().signIn(body.email, body.password);
    if (!r.ok) {
      if (r.code === 'email_not_verified') throw new AppError(403, r.code, 'Confirme seu e-mail antes de entrar.');
      throw new AppError(401, 'invalid_credentials', 'E-mail ou senha incorretos.');
    }
    await setSessionCookie(r.session);
    return { ok: true };
  });
