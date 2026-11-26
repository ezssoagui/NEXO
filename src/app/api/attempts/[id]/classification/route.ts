import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { ERROR_CAUSES } from '@/modules/questions/rules';
import { classifyError } from '@/server/services/questions';

export const POST = route({ auth: 'student', body: z.object({ cause: z.enum(ERROR_CAUSES) }) }, async ({ user, params, body }) => classifyError(user!.id, uuid.parse(params.id), body.cause));
