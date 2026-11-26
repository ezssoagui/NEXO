import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { decideGuardianConsent } from '@/server/services/account';

export const POST = route({ auth: 'public', body: z.object({ token: z.string().min(20).max(200), decision: z.enum(['granted', 'revoked']) }), rateLimit: { bucket: 'guardian', limit: 20, windowSeconds: 3600, by: 'ip' } },
  async ({ body }) => decideGuardianConsent(body.token, body.decision));
