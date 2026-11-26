import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { ranking } from '@/server/services/account';

export const GET = route({ auth: 'student', query: z.object({ period: z.enum(['week', 'month', 'all']).default('week') }) }, async ({ user, query }) => ({ items: await asService((tx) => ranking(tx, query.period, user!.id)) }));
