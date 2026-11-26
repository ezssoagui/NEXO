import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { claimsOf } from '@/server/auth';
import { saveDraft } from '@/server/services/essays';

export const PUT = route({ auth: 'student', body: z.object({ body: z.string().max(20000) }), rateLimit: { bucket: 'draft', limit: 600, windowSeconds: 3600 } },
  async ({ user, params, body }) => saveDraft(claimsOf(user!), uuid.parse(params.id), body.body));
