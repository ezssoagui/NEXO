import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { reviewFlashcard } from '@/server/services/content';

export const POST = route({ auth: 'student', body: z.object({ cardId: uuid, rating: z.enum(['again', 'hard', 'good', 'easy']), idempotencyKey: z.string().uuid() }), rateLimit: { bucket: 'fc', limit: 600, windowSeconds: 3600 } },
  async ({ user, body }) => reviewFlashcard(user!.id, body));
