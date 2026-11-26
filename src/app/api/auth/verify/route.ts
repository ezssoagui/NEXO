import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { authProvider, setSessionCookie } from '@/server/auth';
import { AppError } from '@/server/http/errors';

export const POST = route({ auth: 'public', body: z.object({ token_hash: z.string().min(10).max(200), type: z.string().max(20).default('signup') }), rateLimit: { bucket: 'verify', limit: 20, windowSeconds: 3600, by: 'ip' } },
  async ({ body }) => {
    const r = await authProvider().verifyEmail(body.token_hash, body.type);
    if (!r.ok) throw new AppError(410, 'invalid_token', 'Link inválido ou expirado.');
    if (r.session) await setSessionCookie(r.session);
    return { ok: true };
  });
