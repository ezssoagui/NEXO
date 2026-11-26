import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { bankFilterSchema, createList } from '@/server/services/questions';

export const GET = route({ auth: 'student' }, async ({ user }) => ({ items: await asService((tx) => tx.query(
  `select l.id, l.mode, l.status, l.created_at, (select count(*)::int from question_list_items i where i.list_id = l.id) as total from question_lists l where l.user_id = $1 order by l.created_at desc limit 30`, [user!.id])) }));
export const POST = route({ auth: 'student', body: z.object({ mode: z.enum(['adaptive', 'manual']), filters: bankFilterSchema.optional(), count: z.number().int().min(1).max(45).default(10) }), rateLimit: { bucket: 'list', limit: 60, windowSeconds: 3600 } },
  async ({ user, body }) => createList(user!.id, body));
