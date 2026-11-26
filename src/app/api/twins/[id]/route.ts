import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { answerTwin, twinPayload } from '@/server/services/twins';

export const GET = route({ auth: 'student' }, async ({ params }) => asService((tx) => twinPayload(tx, uuid.parse(params.id))));
export const POST = route({ auth: 'student', body: z.object({ selected: z.enum(['A', 'B', 'C', 'D', 'E']), idempotencyKey: z.string().uuid() }) },
  async ({ user, params, body }) => answerTwin(user!.id, uuid.parse(params.id), body.selected, body.idempotencyKey));
