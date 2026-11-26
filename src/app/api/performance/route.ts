import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { performanceOverview } from '@/server/services/account';
import { essayStats } from '@/server/services/essays';

export const GET = route({ auth: 'student', query: z.object({ period: z.enum(['recent', 'all']).default('all') }) }, async ({ user, query }) => asService(async (tx) => ({
  overview: await performanceOverview(tx, user!.id, query.period),
  essays: await essayStats(tx, user!.id),
  exams: await tx.query(`select a.id, e.title, e.kind, a.finished_at, a.result from exam_attempts a join exams e on e.id = a.exam_id where a.user_id = $1 and a.status = 'finished' order by a.finished_at desc limit 30`, [user!.id]),
})));
