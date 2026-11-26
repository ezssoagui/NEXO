import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { listExercises } from '@/server/services/essays';

export const GET = route({ auth: 'student', query: z.object({ competency: z.coerce.number().int().min(1).max(5).optional() }) }, async ({ query }) => ({ items: await asService((tx) => listExercises(tx, query.competency)) }));
