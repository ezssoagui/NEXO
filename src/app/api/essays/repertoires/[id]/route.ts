import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { claimsOf } from '@/server/auth';
import { toggleRepertoire } from '@/server/services/essays';

export const POST = route({ auth: 'student', body: z.object({ selected: z.boolean() }) }, async ({ user, params, body }) => toggleRepertoire(claimsOf(user!), uuid.parse(params.id), body.selected));
