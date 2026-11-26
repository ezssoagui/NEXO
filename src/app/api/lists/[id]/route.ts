import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import { finishList, getList, saveListAnswer } from '@/server/services/questions';

export const GET = route({ auth: 'student' }, async ({ user, params }) => asService((tx) => getList(tx, user!.id, uuid.parse(params.id))));
export const PUT = route({ auth: 'student', body: z.object({ position: z.number().int().min(1).max(45), selected: z.enum(['A', 'B', 'C', 'D', 'E']).nullable(), eliminated: z.array(z.enum(['A', 'B', 'C', 'D', 'E'])).max(4).default([]) }) },
  async ({ user, params, body }) => saveListAnswer(user!.id, uuid.parse(params.id), body.position, body.selected, body.eliminated));
export const POST = route({ auth: 'student' }, async ({ user, params }) => finishList(user!.id, uuid.parse(params.id)));
