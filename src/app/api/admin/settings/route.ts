import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import * as admin from '@/server/services/admin';

export const GET = route({ auth: 'admin' }, async () => asService((tx) => admin.settingsView(tx)));
export const POST = route({ auth: 'admin', body: z.discriminatedUnion('action', [
  z.object({ action: z.literal('setting'), key: z.string().max(60), value: z.unknown(), status: z.enum(['proposal', 'approved']) }),
  z.object({ action: z.literal('limit'), plan: z.enum(['free', 'plus', 'pro']), resource: z.string().max(40), limit: z.number().int().min(0).nullable() }),
  z.object({ action: z.literal('price'), plan: z.enum(['plus', 'pro']), monthlyCents: z.number().int().positive().nullable(), annualCents: z.number().int().positive().nullable(), status: z.enum(['not_defined', 'pending_approval', 'approved']) }),
  z.object({ action: z.literal('coupon'), coupon: admin.couponSchema }),
  z.object({ action: z.literal('engine'), version: z.string().min(3).max(40), params: z.unknown(), notes: z.string().min(3).max(500), activate: z.boolean() }),
  z.object({ action: z.literal('relevance'), subtopicId: uuid, relevance: z.enum(['low', 'medium', 'high', 'unknown']), sourceCode: z.string().max(60), locator: z.string().max(200) }),
]) }, async ({ user, body }) => {
  switch (body.action) {
    case 'setting': return admin.updateSetting(user!.id, body.key, body.value, body.status);
    case 'limit': return admin.updatePlanLimit(user!.id, body);
    case 'price': return admin.updatePlanPrice(user!.id, body);
    case 'coupon': return admin.createCoupon(user!.id, body.coupon);
    case 'engine': return admin.createEngineParams(user!.id, body);
    case 'relevance': return admin.updateSubtopicRelevance(user!.id, body);
  }
});
