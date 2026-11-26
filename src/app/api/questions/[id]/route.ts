import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { serveQuestion } from '@/server/services/questions';

const ctx = z.string().regex(/^(free|(list|session|exam):[0-9a-f-]{36})$/).default('free');

/** Entrega a questão sem gabarito (2.4/7.7); franquia conforme contexto. */
export const GET = route({ auth: 'student', query: z.object({ context: ctx }), rateLimit: { bucket: 'question', limit: 300, windowSeconds: 600 } }, async ({ user, params, query }) => {
  const [kind, id] = query.context.split(':') as ['free' | 'list' | 'session' | 'exam', string | undefined];
  return serveQuestion(user!.id, uuid.parse(params.id), { kind, id });
});
