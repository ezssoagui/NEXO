import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import { dueReviews } from '@/server/services/content';

export const GET = route({ auth: 'student' }, async ({ user }) => ({ items: await asService((tx) => dueReviews(tx, user!.id)) }));
