import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { submitDiscursive } from '@/server/services/essays';

export const POST = route({ auth: 'student', body: z.object({ response: z.string().trim().min(10).max(6000), idempotencyKey: z.string().uuid() }), rateLimit: { bucket: 'ai', limit: 30, windowSeconds: 3600 } },
  async ({ user, params, body }) => submitDiscursive(user!.id, { exerciseId: uuid.parse(params.id), response: body.response, idempotencyKey: body.idempotencyKey }));
