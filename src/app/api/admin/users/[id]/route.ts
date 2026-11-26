import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import * as admin from '@/server/services/admin';

export const GET = route({ auth: 'admin' }, async ({ params }) => asService((tx) => admin.userDetail(tx, uuid.parse(params.id))));
export const POST = route({ auth: 'admin', body: z.discriminatedUnion('action', [
  z.object({ action: z.literal('grant'), plan: z.enum(['plus', 'pro']), days: z.number().int().min(1).max(366), reason: z.string().min(3).max(200), campaign: z.string().max(60).optional() }),
  z.object({ action: z.literal('suspend'), reason: z.string().min(10).max(500) }),
  z.object({ action: z.literal('unsuspend') }),
]) }, async ({ user, params, body }) => {
  const id = uuid.parse(params.id);
  if (body.action === 'grant') return admin.grantAccess(user!.id, { userId: id, plan: body.plan, days: body.days, reason: body.reason, campaign: body.campaign });
  return admin.setSuspension(user!.id, id, body.action === 'suspend', body.action === 'suspend' ? body.reason : undefined);
});
