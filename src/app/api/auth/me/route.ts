import { route, uuid } from '@/server/http/handler';

export const GET = route({ auth: 'user' }, async ({ user }) => ({
  id: user!.id, email: user!.email, aal: user!.aal, isAdmin: user!.isAdmin, onboarded: user!.onboarded,
}));
