import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';

export const dynamic = 'force-dynamic';

export const GET = route({ auth: 'public' }, async () => {
  const ok = await asService(async (tx) => (await tx.query<{ ok: number }>('select 1 as ok'))[0]?.ok === 1);
  return { status: ok ? 'ok' : 'degraded', time: new Date().toISOString() };
});
