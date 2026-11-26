import { route } from '@/server/http/handler';
import { z } from 'zod';
import { authProvider, setSessionCookie } from '@/server/auth';
import { AppError } from '@/server/http/errors';

export const POST = route({ auth: 'public', body: z.object({ email: z.string().email().max(200), password: z.string().min(1).max(128) }), rateLimit: { bucket: 'signup', limit: 5, windowSeconds: 3600, by: 'ip' } },
  async ({ body }) => {
    const r = await authProvider().signUp(body.email, body.password);
    if (!r.ok) {
      const msg = { email_taken: 'Este e-mail já está cadastrado.', weak_password: 'Use uma senha com pelo menos 10 caracteres, incluindo letras e números.' }[r.code as string] ?? 'Não foi possível criar a conta.';
      throw new AppError(r.code === 'email_taken' ? 409 : 422, r.code, msg);
    }
    // Sem verificação de e-mail (NEXO_EMAIL_VERIFICATION=off): a conta criada já entra e segue para o onboarding.
    if (r.session) await setSessionCookie(r.session);
    return { needsVerification: r.needsVerification, signedIn: Boolean(r.session) };
  });
