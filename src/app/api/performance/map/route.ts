import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import { masteryMap } from '@/server/services/account';

export const GET = route({ auth: 'student' }, async ({ user }) => ({ rows: await asService((tx) => masteryMap(tx, user!.id)) }));
