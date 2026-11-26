import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { createCustomExam, listExams } from '@/server/services/exams';

export const GET = route({ auth: 'student' }, async ({ user }) => asService((tx) => listExams(tx, user!.id)));
const n = z.number().int().min(0).max(45);
export const POST = route({ auth: 'student', body: z.object({ perArea: z.object({ LC: n.optional(), CH: n.optional(), CN: n.optional(), MT: n.optional() }), timed: z.boolean().default(true) }), rateLimit: { bucket: 'exam', limit: 20, windowSeconds: 3600 } },
  async ({ user, body }) => createCustomExam(user!.id, body));
