import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { authProvider, clearSessionCookie } from '@/server/auth';
import { deleteAccount } from '@/server/services/account';
import { AppError } from '@/server/http/errors';

export const POST = route({ auth: 'user', body: z.object({ confirm: z.literal('EXCLUIR'), password: z.string().min(1).max(128) }), rateLimit: { bucket: 'delete', limit: 3, windowSeconds: 3600 } },
  async ({ user, body }) => {
    // Verificação de identidade proporcional: senha atual (13.6).
    const check = await authProvider().signIn(user!.email, body.password);
    if (!check.ok) throw new AppError(401, 'invalid_credentials', 'Senha incorreta.');
    await deleteAccount(user!.id, (id) => authProvider().deleteUser(id));
    await clearSessionCookie();
    return { ok: true };
  });
