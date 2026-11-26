import { route, uuid } from '@/server/http/handler';
import { claimsOf } from '@/server/auth';
import { preferencesSchema, updatePreferences } from '@/server/services/account';

export const PATCH = route({ auth: 'student', body: preferencesSchema }, async ({ user, body }) => updatePreferences(claimsOf(user!), body));
