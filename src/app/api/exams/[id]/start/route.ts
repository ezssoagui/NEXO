import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { startExam } from '@/server/services/exams';

export const POST = route({ auth: 'student', body: z.object({ timerMode: z.enum(['official', 'none']).default('official') }) }, async ({ user, params, body }) => startExam(user!.id, uuid.parse(params.id), body.timerMode));
