import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import { listThemes } from '@/server/services/essays';

export const GET = route({ auth: 'student' }, async () => ({ items: await asService((tx) => listThemes(tx)) }));
