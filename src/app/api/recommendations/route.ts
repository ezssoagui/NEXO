import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { currentRecommendations } from '@/server/services/recommendations';

export const GET = route({ auth: 'student', query: z.object({ category: z.enum(['learn', 'improve', 'deepen', 'review']).optional() }) },
  async ({ user, query }) => ({ items: await asService((tx) => currentRecommendations(tx, user!.id, query.category)) }));
