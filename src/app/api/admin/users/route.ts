import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import * as admin from '@/server/services/admin';

export const GET = route({ auth: 'admin', query: z.object({ q: z.string().max(100).optional(), page: z.coerce.number().int().min(1).default(1) }) }, async ({ query }) => ({ items: await asService((tx) => admin.listUsers(tx, query)) }));
