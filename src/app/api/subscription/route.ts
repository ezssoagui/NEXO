import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { cancelSubscription, scheduleDowngrade, startCheckout, subscriptionOverview } from '@/server/services/commerce';

export const GET = route({ auth: 'student' }, async ({ user }) => asService((tx) => subscriptionOverview(tx, user!.id)));
export const POST = route({ auth: 'student', body: z.discriminatedUnion('action', [
  z.object({ action: z.literal('checkout'), plan: z.enum(['plus', 'pro']), cycle: z.enum(['monthly', 'annual']), cpf: z.string().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/), couponCode: z.string().max(32).optional() }),
  z.object({ action: z.literal('cancel'), withdrawal: z.boolean().default(false) }),
  z.object({ action: z.literal('downgrade'), plan: z.literal('plus') }),
]), rateLimit: { bucket: 'billing', limit: 20, windowSeconds: 3600 } }, async ({ user, body }) => {
  if (body.action === 'checkout') return startCheckout(user!.id, body);
  if (body.action === 'cancel') return cancelSubscription(user!.id, { withdrawal: body.withdrawal });
  return scheduleDowngrade(user!.id, body.plan);
});
