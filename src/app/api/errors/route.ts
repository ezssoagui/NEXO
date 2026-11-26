import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { errorNotebook } from '@/server/services/questions';

export const GET = route({ auth: 'student', query: z.object({ status: z.enum(['open', 'recovering', 'overcome']).optional(), area: z.enum(['LC', 'MT', 'CN', 'CH']).optional() }) },
  async ({ user, query }) => ({ items: await asService((tx) => errorNotebook(tx, user!.id, query)) }));
