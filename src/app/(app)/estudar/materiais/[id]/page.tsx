'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApi } from '@/lib/api';
import { Markdown } from '@/components/markdown';
import { Card, ErrorState, Loading, PageHeader } from '@/components/ui';

interface Material { title: string; blocks: { id: string; subtopic: string; block_type: string; body_md: string }[]; composition: { errorQuestionIds: string[]; gaps: string[] } }

export default function MaterialPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useApi<Material>(`/api/materials/${id}`);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;
  const bySub = data.blocks.reduce<Record<string, typeof data.blocks>>((m, b) => ((m[b.subtopic] ??= []).push(b), m), {});
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={data.title} description="Montado com blocos validados já armazenados." />
      {Object.entries(bySub).map(([sub, blocks]) => (
        <Card key={sub}><h2 className="mb-2 font-semibold">{sub}</h2>{blocks.map((b) => <Markdown key={b.id} text={b.body_md} />)}</Card>
      ))}
      {data.blocks.length === 0 && <p className="text-muted">Nenhum bloco de resumo validado disponível para este escopo ainda.</p>}
      {data.composition.errorQuestionIds.length > 0 && (
        <Card><h2 className="mb-2 font-semibold">Erros recorrentes para refazer</h2><ul className="space-y-1">{data.composition.errorQuestionIds.map((q, i) => <li key={q}><Link className="text-sm text-primary" href={`/questoes/${q}`}>Questão {i + 1}</Link></li>)}</ul></Card>
      )}
      {data.composition.gaps.length > 0 && <Card><h2 className="mb-1 font-semibold">Lacunas de material</h2><p className="text-sm text-muted">{data.composition.gaps.join(' · ')}</p></Card>}
    </div>
  );
}
