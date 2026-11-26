import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { submitSingle } from '@/server/services/questions';

const letter = z.enum(['A', 'B', 'C', 'D', 'E']);
export const POST = route({ auth: 'student', body: z.object({ selected: letter, idempotencyKey: z.string().uuid(), timeSpentMs: z.number().int().min(0).max(36e5).optional(),
  confidence: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(), eliminated: z.array(letter).max(4).optional() }) },
  async ({ user, params, body }) => submitSingle(user!.id, { questionId: uuid.parse(params.id), ...body }));
