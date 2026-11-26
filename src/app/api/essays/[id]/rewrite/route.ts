import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { submitPartialRewrite } from '@/server/services/essays';

export const POST = route({ auth: 'student', body: z.object({ competency: z.number().int().min(1).max(5), original: z.string().min(10).max(4000), rewritten: z.string().min(10).max(4000), idempotencyKey: z.string().uuid() }), rateLimit: { bucket: 'ai', limit: 30, windowSeconds: 3600 } },
  async ({ user, params, body }) => submitPartialRewrite(user!.id, uuid.parse(params.id), body));
