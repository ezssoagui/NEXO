import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import * as admin from '@/server/services/admin';

export const GET = route({ auth: 'admin' }, async () => asService((tx) => admin.financeReport(tx)));
export const POST = route({ auth: 'admin', body: z.discriminatedUnion('action', [
  z.object({ action: z.literal('expense'), expense: admin.expenseSchema }),
  z.object({ action: z.literal('marketing'), month: z.string().regex(/^\d{4}-\d{2}$/), channel: z.string().min(2).max(40), spendCents: z.number().int().min(0), signups: z.number().int().min(0).optional(), notes: z.string().max(300).optional() }),
]) }, async ({ user, body }) => {
  if (body.action === 'expense') return admin.addExpense(user!.id, body.expense);
  return admin.upsertMarketing(user!.id, body);
});
