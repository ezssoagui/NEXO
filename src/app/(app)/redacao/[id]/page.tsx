'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError, fmtDate, useApi, uuid } from '@/lib/api';
import { Badge, Button, Card, ErrorState, Loading, PageHeader, Select, Textarea } from '@/components/ui';
import { FeedbackButton } from '@/components/app-shell';
import { useToast } from '@/components/toast';

interface CompEval { competency: number; score: number; justification: string; citations: string[]; strengths: string[]; improvements: string[] }
interface Version { id: string; version: number; kind: string; body: string; target_competency: number | null; submitted_at: string; eval_kind: string | null; total: number | null; zeroed: boolean | null; zero_reason: string | null;
  result: ({ competencies?: CompEval[]; overall_feedback?: string; recommendations?: string[] } & { improved?: string; justification?: string; next_steps?: string[]; estimated_score?: number | null; original?: string }) | null }
interface Essay { id: string; status: string; theme_title: string | null; custom_theme_title: string | null; versions: Version[] }
const NAMES = ['Domínio da escrita formal', 'Compreensão da proposta e estrutura', 'Seleção e organização de argumentos', 'Mecanismos linguísticos (coesão)', 'Proposta de intervenção'];

function Rewrite({ essayId, onDone }: { essayId: string; onDone: () => void }) {
  const [competency, setCompetency] = useState(3);
  const [original, setOriginal] = useState('');
  const [rewritten, setRewritten] = useState('');
  const [key, setKey] = useState(uuid);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Reescrita direcionada</h2>
      <p className="text-sm text-muted">Reescreva um trecho focando uma competência. Usa a franquia de reescritas; a avaliação parcial não é uma nota completa.</p>
      <Select label="Competência" value={competency} onChange={(e) => setCompetency(Number(e.target.value))}>{NAMES.map((n, i) => <option key={i} value={i + 1}>C{i + 1} — {n}</option>)}</Select>
      <Textarea label="Trecho original (copie da versão avaliada)" rows={3} value={original} onChange={(e) => setOriginal(e.target.value)} />
      <Textarea label="Trecho reescrito" rows={4} value={rewritten} onChange={(e) => setRewritten(e.target.value)} />
      <Button loading={busy} disabled={original.trim().length < 10 || rewritten.trim().length < 10} onClick={async () => {
        setBusy(true);
        try { await api(`/api/essays/${essayId}/rewrite`, { body: { competency, original, rewritten, idempotencyKey: key } }); setKey(uuid()); setOriginal(''); setRewritten(''); onDone(); }
        catch (e) { toast('error', e instanceof ApiError ? e.message : 'Falha.'); } finally { setBusy(false); }
      }}>Avaliar reescrita</Button>
    </Card>
  );
}

/** Resultado (6.1/6.2): nota estimada por competência com trechos do próprio texto e recomendações. */
export default function EssayResult() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, loading, reload } = useApi<Essay>(`/api/essays/${id}`);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;
  const full = [...data.versions].reverse().find((v) => v.eval_kind === 'full');
  const partials = data.versions.filter((v) => v.eval_kind === 'partial');
  return (
    <div className="space-y-4">
      <PageHeader title={data.theme_title ?? data.custom_theme_title ?? 'Redação'} description="Nota estimada por IA a partir da cartilha oficial — não é avaliação oficial do Inep."
        actions={<Button variant="secondary" onClick={() => router.push(`/redacao/escrever/${id}`)}>Reescrita integral</Button>} />
      {!full ? <Card><p>Esta redação ainda não tem correção completa válida. <Link href={`/redacao/escrever/${id}`} className="text-primary">Abrir editor</Link></p></Card> : (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="text-sm text-muted">Versão {full.version} · {fmtDate(full.submitted_at)}</div><div className="text-4xl font-bold tabular-nums">{full.total}<span className="text-lg text-muted">/1000</span></div></div>
            {full.zeroed && <Badge tone="danger">Zerada: {full.zero_reason}</Badge>}
            <FeedbackButton entityType="essay_version" entityId={full.id} label="Correção inadequada?" defaultKind="evaluation_issue" />
          </Card>
          {full.result?.overall_feedback && <Card><p>{full.result.overall_feedback}</p></Card>}
          <div className="space-y-3">
            {full.result?.competencies?.map((c) => (
              <details key={c.competency} className="rounded-xl border border-border bg-surface p-4" open={c.competency === 1}>
                <summary className="flex cursor-pointer items-center justify-between font-semibold"><span>C{c.competency} — {NAMES[c.competency - 1]}</span><Badge tone="primary">{c.score}</Badge></summary>
                <p className="mt-2 text-sm">{c.justification}</p>
                {c.citations.length > 0 && <div className="mt-2 space-y-1">{c.citations.map((q, i) => <blockquote key={i} className="border-l-4 border-primary/50 pl-3 text-sm italic text-muted">“{q}”</blockquote>)}</div>}
                {c.strengths.length > 0 && <div className="mt-2 text-sm"><span className="font-medium">Acertos: </span>{c.strengths.join('; ')}</div>}
                {c.improvements.length > 0 && <div className="mt-1 text-sm"><span className="font-medium">Melhorias: </span>{c.improvements.join('; ')}</div>}
              </details>
            ))}
          </div>
          {full.result?.recommendations && <Card><h2 className="mb-1 font-semibold">Recomendações</h2><ul className="list-disc pl-5 text-sm">{full.result.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul></Card>}
          <details className="rounded-xl border border-border bg-surface p-4"><summary className="cursor-pointer font-semibold">Texto avaliado</summary><p className="mt-2 whitespace-pre-wrap font-serif">{full.body}</p></details>
          <Rewrite essayId={id} onDone={reload} />
        </>
      )}
      {partials.length > 0 && (
        <Card><h2 className="mb-2 font-semibold">Reescritas avaliadas</h2>
          <ul className="space-y-3">{partials.map((p) => (
            <li key={p.id} className="rounded-lg bg-surface-2 p-3 text-sm">
              <div className="mb-1 flex gap-2"><Badge>C{p.target_competency}</Badge><Badge tone={p.result?.improved === 'yes' ? 'success' : 'neutral'}>{{ yes: 'Melhorou', partially: 'Melhorou parcialmente', no: 'Sem melhora' }[p.result?.improved ?? 'no']}</Badge></div>
              <p className="whitespace-pre-wrap">{p.body}</p><p className="mt-1 text-muted">{p.result?.justification}</p>
            </li>
          ))}</ul>
        </Card>
      )}
    </div>
  );
}
