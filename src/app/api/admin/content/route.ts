import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import * as admin from '@/server/services/admin';

const type = z.enum(admin.contentTypes as [admin.ContentType, ...admin.ContentType[]]);
export const GET = route({ auth: 'admin', query: z.object({ type, status: z.enum(['staging', 'pending_review', 'published', 'retired']).default('pending_review'), page: z.coerce.number().int().min(1).default(1) }) },
  async ({ query }) => ({ items: await asService((tx) => admin.contentQueue(tx, query.type, query.status, query.page)) }));
export const POST = route({ auth: 'admin', body: z.discriminatedUnion('action', [
  z.object({ action: z.literal('review'), type, id: uuid, kind: z.enum(['technical', 'pedagogical', 'rights']), decision: z.enum(['approved', 'rejected', 'changes_requested']), notes: z.string().max(1000).optional() }),
  z.object({ action: z.literal('publish'), type, id: uuid }),
  z.object({ action: z.literal('retire'), type, id: uuid, reason: z.string().min(3).max(300) }),
]) }, async ({ user, body }) => {
  if (body.action === 'review') return admin.reviewContent(user!.id, body);
  if (body.action === 'publish') return admin.publishContent(user!.id, body.type, body.id);
  return admin.retireContent(user!.id, body.type, body.id, body.reason);
});
