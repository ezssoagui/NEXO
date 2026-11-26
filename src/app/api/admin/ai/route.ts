import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import * as admin from '@/server/services/admin';
import { approveBenchmarkRun } from '@/server/services/essay-benchmark';

export const GET = route({ auth: 'admin' }, async () => asService((tx) => admin.aiDashboard(tx)));
export const POST = route({ auth: 'admin', body: z.discriminatedUnion('action', [
  z.object({ action: z.literal('register_model'), model: admin.modelSchema }),
  z.object({ action: z.literal('approve_model'), id: uuid }),
  z.object({ action: z.literal('activate_prompt'), id: uuid }),
  z.object({ action: z.literal('set_budget'), periodKey: z.string(), budgetUsd: z.number().positive().max(100000), hardLimit: z.boolean() }),
  z.object({ action: z.literal('approve_benchmark'), id: uuid }),
]) }, async ({ user, body }) => {
  if (body.action === 'register_model') return admin.registerModel(user!.id, body.model);
  if (body.action === 'approve_model') return admin.approveModel(user!.id, body.id);
  if (body.action === 'activate_prompt') return admin.activatePromptVersion(user!.id, body.id);
  if (body.action === 'approve_benchmark') return approveBenchmarkRun(user!.id, body.id);
  return admin.setBudget(user!.id, body);
});
