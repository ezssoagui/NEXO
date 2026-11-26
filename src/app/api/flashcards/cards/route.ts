import { route, uuid } from '@/server/http/handler';
import { createPersonalCard, personalCardSchema } from '@/server/services/content';

export const POST = route({ auth: 'student', body: personalCardSchema, rateLimit: { bucket: 'card', limit: 200, windowSeconds: 3600 } }, async ({ user, body }) => createPersonalCard(user!.id, body));
