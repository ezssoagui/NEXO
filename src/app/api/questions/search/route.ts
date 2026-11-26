import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import { bankFilterSchema, searchBank } from '@/server/services/questions';

export const POST = route({ auth: 'student', body: bankFilterSchema, rateLimit: { bucket: 'bank', limit: 240, windowSeconds: 600 } }, async ({ user, body }) => asService((tx) => searchBank(tx, user!.id, body)));
