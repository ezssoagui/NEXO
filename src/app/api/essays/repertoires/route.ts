import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { listRepertoires } from '@/server/services/essays';

export const GET = route({ auth: 'student', query: z.object({ axis: z.string().max(60).optional() }) }, async ({ user, query }) => ({ items: await asService((tx) => listRepertoires(tx, user!.id, query.axis)) }));
