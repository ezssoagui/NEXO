import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import { getEssay } from '@/server/services/essays';

export const GET = route({ auth: 'student' }, async ({ user, params }) => asService((tx) => getEssay(tx, user!.id, uuid.parse(params.id))));
