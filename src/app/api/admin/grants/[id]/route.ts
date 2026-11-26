import { route, uuid } from '@/server/http/handler';
import * as admin from '@/server/services/admin';

export const DELETE = route({ auth: 'admin' }, async ({ user, params }) => admin.revokeGrant(user!.id, uuid.parse(params.id)));
