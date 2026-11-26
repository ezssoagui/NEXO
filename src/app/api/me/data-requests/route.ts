import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { createDataRequest } from '@/server/services/account';

export const POST = route({ auth: 'user', body: z.object({ kind: z.enum(['access', 'correction', 'deletion']), details: z.string().max(2000).optional() }), rateLimit: { bucket: 'datareq', limit: 5, windowSeconds: 86400 } },
  async ({ user, body }) => createDataRequest(user!.id, body.kind, body.details));
