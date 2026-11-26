import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { dueCards } from '@/server/services/content';

export const GET = route({ auth: 'student', query: z.object({ deckId: uuid.optional(), subtopicId: uuid.optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }) },
  async ({ user, query }) => ({ cards: await asService((tx) => dueCards(tx, user!.id, query)) }));
