import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { getConceptActivity, submitConceptResponse } from '@/server/services/content';

export const GET = route({ auth: 'student' }, async ({ params }) => asService((tx) => getConceptActivity(tx, uuid.parse(params.id))));
export const POST = route({ auth: 'student', body: z.object({ response: z.string().trim().min(1).max(4000), idempotencyKey: z.string().uuid(), sessionActivityId: uuid.optional() }), rateLimit: { bucket: 'ai', limit: 30, windowSeconds: 3600 } },
  async ({ user, params, body }) => submitConceptResponse(user!.id, { activityId: uuid.parse(params.id), response: body.response, idempotencyKey: body.idempotencyKey, sessionActivityId: body.sessionActivityId }));
