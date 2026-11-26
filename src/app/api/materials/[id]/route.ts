import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import { getMaterial } from '@/server/services/content';

export const GET = route({ auth: 'student' }, async ({ user, params }) => asService((tx) => getMaterial(tx, user!.id, uuid.parse(params.id))));
