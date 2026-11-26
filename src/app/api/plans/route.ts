import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import { plansCatalog } from '@/server/services/commerce';

export const GET = route({ auth: 'public' }, async () => ({ plans: await asService((tx) => plansCatalog(tx)) }));
