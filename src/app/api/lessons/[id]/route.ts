import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import { completeLesson, getLesson } from '@/server/services/content';

export const GET = route({ auth: 'student' }, async ({ user, params }) => asService((tx) => getLesson(tx, user!.id, uuid.parse(params.id))));
export const POST = route({ auth: 'student' }, async ({ user, params }) => completeLesson(user!.id, uuid.parse(params.id)));
