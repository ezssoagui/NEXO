import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { finishExam, getAttempt, pauseExam, saveExamAnswer } from '@/server/services/exams';

const letter = z.enum(['A', 'B', 'C', 'D', 'E']);
export const GET = route({ auth: 'student' }, async ({ user, params }) => asService((tx) => getAttempt(tx, user!.id, uuid.parse(params.id))));
export const PUT = route({ auth: 'student', body: z.object({ position: z.number().int().min(1).max(180), selected: letter.nullable().optional(), marked: z.boolean().optional(),
  eliminated: z.array(letter).max(4).optional(), confidence: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().optional() }) },
  async ({ user, params, body }) => saveExamAnswer(user!.id, uuid.parse(params.id), body));
export const POST = route({ auth: 'student', body: z.object({ action: z.enum(['pause', 'resume', 'finish']) }) }, async ({ user, params, body }) => {
  const id = uuid.parse(params.id);
  if (body.action === 'finish') return finishExam(user!.id, id);
  return pauseExam(user!.id, id, body.action === 'pause');
});
