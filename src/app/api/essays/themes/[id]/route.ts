import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import { getTheme } from '@/server/services/essays';

export const GET = route({ auth: 'student' }, async ({ params }) => asService((tx) => getTheme(tx, uuid.parse(params.id))));
