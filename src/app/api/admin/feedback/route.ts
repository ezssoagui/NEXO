import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import * as admin from '@/server/services/admin';

export const GET = route({ auth: 'admin', query: z.object({ status: z.enum(['open', 'triaged', 'resolved', 'dismissed']).optional() }) }, async ({ query }) => ({ items: await asService((tx) => admin.feedbackList(tx, query.status)) }));
export const POST = route({ auth: 'admin', body: z.object({ id: uuid, status: z.enum(['triaged', 'resolved', 'dismissed']) }) }, async ({ user, body }) => admin.updateFeedback(user!.id, body.id, body.status));
