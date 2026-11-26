import { route, uuid } from '@/server/http/handler';
import { claimsOf } from '@/server/auth';
import { getProfile, profileUpdateSchema, updateProfile } from '@/server/services/account';

export const GET = route({ auth: 'user' }, async ({ user }) => getProfile(claimsOf(user!)));
export const PATCH = route({ auth: 'student', body: profileUpdateSchema }, async ({ user, body }) => updateProfile(claimsOf(user!), body));
