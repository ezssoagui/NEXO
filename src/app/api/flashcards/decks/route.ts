import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { listDecks } from '@/server/services/content';

export const GET = route({ auth: 'student', query: z.object({ subtopicId: uuid.optional() }) }, async ({ user, query }) => ({ decks: await asService((tx) => listDecks(tx, user!.id, query.subtopicId)) }));
