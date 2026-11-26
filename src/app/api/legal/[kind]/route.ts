import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import { notFound } from '@/server/http/errors';

export const GET = route({ auth: 'public' }, async ({ params }) => {
  const doc = await asService(async (tx) => (await tx.query(`select kind, version, title, body_md, published_at from legal_documents where kind = $1 and status = 'published' order by published_at desc limit 1`, [params.kind]))[0]);
  if (!doc) throw notFound('Documento');
  return doc;
});
