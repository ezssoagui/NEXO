import { route, uuid } from '@/server/http/handler';
import { z } from 'zod';
import { asService } from '@/server/db';
import * as admin from '@/server/services/admin';

export const GET = route({ auth: 'admin' }, async () => ({ runs: await asService((tx) => admin.importRuns(tx)) }));
export const POST = route({ auth: 'admin', body: z.object({ kind: z.literal('enem_items'), manifest: z.record(z.string(), z.unknown()), items: z.array(z.unknown()).min(1).max(2000) }) },
  async ({ user, body }) => admin.importQuestions(user!.id, body.items, body.manifest));
