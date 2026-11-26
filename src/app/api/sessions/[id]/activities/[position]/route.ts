import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { answerSessionQuestion, completeActivity, removePlannedActivity } from '@/server/services/sessions';

const letter = z.enum(['A', 'B', 'C', 'D', 'E']);
const position = (p: string) => z.coerce.number().int().min(1).max(100).parse(p);

export const POST = route({ auth: 'student', body: z.object({
  selected: letter.optional(), timeSpentMs: z.number().int().min(0).max(36e5).optional(), confidence: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  eliminated: z.array(letter).max(4).optional(), outcome: z.enum(['completed', 'skipped']).optional(), result: z.record(z.string(), z.unknown()).optional() }) },
  async ({ user, params, body }) => {
    const id = uuid.parse(params.id);
    if (body.selected) return answerSessionQuestion(user!.id, id, position(params.position!), { selected: body.selected, timeSpentMs: body.timeSpentMs, confidence: body.confidence, eliminated: body.eliminated });
    return completeActivity(user!.id, id, position(params.position!), body.outcome ?? 'completed', body.result);
  });

export const DELETE = route({ auth: 'student' }, async ({ user, params }) => removePlannedActivity(user!.id, uuid.parse(params.id), position(params.position!)));
