import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { globalSearch } from '@/server/services/content';

export const GET = route({ auth: 'student', query: z.object({ q: z.string().trim().min(2).max(100) }), rateLimit: { bucket: 'search', limit: 120, windowSeconds: 600 } },
  async ({ user, query }) => asService((tx) => globalSearch(tx, user!.id, query.q)));
