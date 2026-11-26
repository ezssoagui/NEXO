import { route, uuid } from '@/server/http/handler';
import { authProvider, clearSessionCookie } from '@/server/auth';

export const POST = route({ auth: 'user' }, async ({ user }) => {
  await authProvider().signOut(user!.session).catch(() => undefined);
  await clearSessionCookie();
  return { ok: true };
});
