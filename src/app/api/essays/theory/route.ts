import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import { listTheory } from '@/server/services/essays';

export const GET = route({ auth: 'student' }, async () => ({ items: await asService((tx) => listTheory(tx)) }));
