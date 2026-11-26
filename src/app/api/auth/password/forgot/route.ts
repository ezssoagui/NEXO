import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { authProvider } from '@/server/auth';

export const POST = route({ auth: 'public', body: z.object({ email: z.string().email().max(200) }), rateLimit: { bucket: 'forgot', limit: 5, windowSeconds: 3600, by: 'ip' } },
  async ({ body }) => {
    await authProvider().requestPasswordReset(body.email);
    return { ok: true }; // resposta idêntica exista ou não a conta
  });
