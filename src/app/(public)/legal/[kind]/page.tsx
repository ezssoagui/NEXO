import { notFound } from 'next/navigation';
import { Markdown } from '@/components/markdown';
import { asService } from '@/server/db';

export const dynamic = 'force-dynamic';

export default async function LegalPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const doc = await asService(async (tx) => (await tx.query<{ title: string; version: string; body_md: string; published_at: Date }>(
    `select title, version, body_md, published_at from legal_documents where kind = $1 and status = 'published' order by published_at desc limit 1`, [kind]))[0]);
  if (!doc) notFound();
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">{doc.title}</h1>
      <p className="mb-4 text-sm text-muted">Versão {doc.version} · publicada em {new Date(doc.published_at).toLocaleDateString('pt-BR')}</p>
      <Markdown text={doc.body_md} />
    </article>
  );
}
