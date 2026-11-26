import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { authProvider } from '@/server/auth';
import { AppError } from '@/server/http/errors';

export const POST = route({ auth: 'public', body: z.object({ token_hash: z.string().min(10).max(200), password: z.string().min(1).max(128) }), rateLimit: { bucket: 'reset', limit: 10, windowSeconds: 3600, by: 'ip' } },
  async ({ body }) => {
    const ok = await authProvider().resetPassword(body.token_hash, body.password);
    if (!ok) throw new AppError(422, 'reset_failed', 'Link inválido/expirado ou senha fraca (mínimo 10 caracteres com letras e números).');
    return { ok: true };
  });
