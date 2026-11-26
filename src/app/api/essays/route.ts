import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { createEssay, essayFollowUp, essayStats, listEssays } from '@/server/services/essays';

export const GET = route({ auth: 'student' }, async ({ user }) => asService(async (tx) => ({
  items: await listEssays(tx, user!.id), stats: await essayStats(tx, user!.id), followUp: await essayFollowUp(tx, user!.id),
})));
export const POST = route({ auth: 'student', body: z.object({ themeId: uuid.optional(), customTitle: z.string().trim().min(5).max(300).optional() }).refine((b) => b.themeId || b.customTitle, 'Informe um tema') },
  async ({ user, body }) => createEssay(user!.id, body));
