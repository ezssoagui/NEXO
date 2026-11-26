import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { submitEssay } from '@/server/services/essays';

export const POST = route({ auth: 'student', body: z.object({ idempotencyKey: z.string().uuid() }), rateLimit: { bucket: 'ai', limit: 30, windowSeconds: 3600 } },
  async ({ user, params, body }) => submitEssay(user!.id, uuid.parse(params.id), body.idempotencyKey));
