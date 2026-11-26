import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import { quotaUsage } from '@/server/services/core';

export const GET = route({ auth: 'student' }, async ({ user }) => asService((tx) => quotaUsage(tx, user!.id)));
