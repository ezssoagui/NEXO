import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { notFound } from '@/server/http/errors';
import { updateRecommendationStatus } from '@/server/services/recommendations';

export const POST = route({ auth: 'student', body: z.object({ action: z.enum(['postpone', 'dismiss']), days: z.number().int().min(1).max(30).optional() }) },
  async ({ user, params, body }) => {
    const ok = await asService((tx) => updateRecommendationStatus(tx, user!.id, uuid.parse(params.id), body.action, body.days));
    if (!ok) throw notFound('Recomendação');
    return { ok };
  });
