import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { assembleMaterial } from '@/server/services/content';

export const GET = route({ auth: 'student' }, async ({ user }) => ({ items: await asService((tx) => tx.query('select id, title, scope, created_at from study_materials where user_id = $1 order by created_at desc limit 50', [user!.id])) }));
export const POST = route({ auth: 'student', body: z.object({ scope: z.enum(['subtopic', 'subject', 'area', 'final_review']), ref: z.string().max(60).optional() }), rateLimit: { bucket: 'material', limit: 30, windowSeconds: 3600 } },
  async ({ user, body }) => assembleMaterial(user!.id, body));
