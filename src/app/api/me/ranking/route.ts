import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { setRanking } from '@/server/services/account';

export const POST = route({ auth: 'student', body: z.object({ optIn: z.boolean(), displayName: z.string().max(24).optional() }) }, async ({ user, body }) => setRanking(user!.id, body));
