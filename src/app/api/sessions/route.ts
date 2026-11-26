import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { createSession } from '@/server/services/sessions';

export const POST = route({ auth: 'student', body: z.object({ recommendationId: uuid.optional(), subtopicId: uuid.optional(),
  focus: z.enum(['exploration', 'fundamentals', 'comprehension', 'practice', 'transfer', 'retention', 'maintenance', 'recovery']).optional() }) },
  async ({ user, body }) => createSession(user!.id, body));
