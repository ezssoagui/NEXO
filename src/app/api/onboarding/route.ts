import { route, uuid } from '@/server/http/handler';
import { completeOnboarding, onboardingSchema } from '@/server/services/account';

export const POST = route({ auth: 'user', body: onboardingSchema }, async ({ user, body }) => {
  const r = await completeOnboarding(user!.id, body);
  // O link ao responsável é enviado por e-mail transacional quando configurado (pendência de fornecedor).
  return { minor: r.minor, guardianPending: Boolean(r.guardianToken) };
});
