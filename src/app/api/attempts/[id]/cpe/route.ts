import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import { cpeStepSchema, getCpe, submitCpeStep } from '@/server/services/questions';

export const GET = route({ auth: 'student' }, async ({ user, params }) => asService((tx) => getCpe(tx, user!.id, uuid.parse(params.id))));
export const POST = route({ auth: 'student', body: cpeStepSchema }, async ({ user, params, body }) => submitCpeStep(user!.id, uuid.parse(params.id), body));
