import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import { gamificationSummary } from '@/server/services/account';

export const GET = route({ auth: 'student' }, async ({ user }) => asService((tx) => gamificationSummary(tx, user!.id)));
