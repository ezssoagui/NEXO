import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import * as admin from '@/server/services/admin';

export const GET = route({ auth: 'admin' }, async () => asService((tx) => admin.adminOverview(tx)));
