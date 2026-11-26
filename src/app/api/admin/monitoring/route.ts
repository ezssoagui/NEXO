import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import * as admin from '@/server/services/admin';

export const GET = route({ auth: 'admin' }, async () => asService((tx) => admin.monitoring(tx)));
export const POST = route({ auth: 'admin', body: z.discriminatedUnion('action', [
  z.object({ action: z.literal('ack'), id: uuid }),
  z.object({ action: z.literal('backup'), kind: z.enum(['backup', 'restore_test']), status: z.enum(['success', 'failed']), startedAt: z.string().datetime(), finishedAt: z.string().datetime().optional(), sizeBytes: z.number().int().optional(), locationHint: z.string().max(200).optional(), notes: z.string().max(500).optional() }),
]) }, async ({ user, body }) => {
  if (body.action === 'ack') return admin.acknowledgeAlert(user!.id, body.id);
  const { action: _a, ...rest } = body;
  return admin.recordBackupRun(rest);
});
