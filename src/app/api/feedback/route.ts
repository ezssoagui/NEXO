import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { submitFeedback } from '@/server/services/account';

export const POST = route({ auth: 'user', body: z.object({ kind: z.enum(['question_error', 'evaluation_issue', 'technical', 'suggestion']), entityType: z.string().max(40).optional(), entityId: uuid.optional(), message: z.string().min(3).max(2000) }), rateLimit: { bucket: 'feedback', limit: 20, windowSeconds: 3600 } },
  async ({ user, body }) => submitFeedback(user!.id, body));
