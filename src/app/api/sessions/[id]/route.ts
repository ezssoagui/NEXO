import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { abandonSession, getSession, pauseSession, startSession } from '@/server/services/sessions';

export const GET = route({ auth: 'student' }, async ({ user, params }) => asService((tx) => getSession(tx, user!.id, uuid.parse(params.id))));

export const POST = route({ auth: 'student', body: z.object({ action: z.enum(['start', 'resume', 'pause', 'abandon']) }) }, async ({ user, params, body }) => {
  const id = uuid.parse(params.id);
  if (body.action === 'pause') return pauseSession(user!.id, id);
  if (body.action === 'abandon') return abandonSession(user!.id, id);
  return startSession(user!.id, id);
});
