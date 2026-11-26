'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError, useApi, uuid } from '@/lib/api';
import { Markdown } from '@/components/markdown';
import { Badge, Button, Card, ErrorState, Loading, Textarea } from '@/components/ui';
import { useToast } from '@/components/toast';

interface Evaluation { score: number; justification: string; citations: string[]; improvements: string[] }
const RUBRIC = ['Insuficiente', 'Parcial', 'Adequado', 'Excelente'];

/** Exercício discursivo isolado (6.5): avaliação após envio, franquia própria. */
export default function ExercisePage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useApi<{ items: { id: string; competency: number; kind: string; prompt_md: string }[] }>('/api/essays/exercises');
  const [text, setText] = useState('');
  const [key] = useState(uuid);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error.message} />;
  const ex = data?.items.find((e) => e.id === id);
  if (!ex) return <ErrorState message="Exercício não encontrado." />;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/redacao" className="text-sm text-muted">← Redação</Link>
      <Badge tone="primary">Competência {ex.competency}</Badge>
      <Markdown text={ex.prompt_md} className="text-lg" />
      {!result ? (
        <>
          <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} maxLength={6000} aria-label="Sua resposta" />
          <Button loading={busy} disabled={text.trim().length < 10} onClick={async () => {
            setBusy(true);
            try { const r = await api<{ evaluation: Evaluation }>(`/api/essays/exercises/${id}`, { body: { response: text, idempotencyKey: key } }); setResult(r.evaluation); }
            catch (e) { toast('error', e instanceof ApiError ? e.message : 'Falha.'); } finally { setBusy(false); }
          }}>Enviar para avaliação</Button>
        </>
      ) : (
        <Card className="space-y-2 bg-surface-2">
          <div className="text-lg font-semibold">{result.score} — {RUBRIC[result.score]}</div>
          <p>{result.justification}</p>
          {result.citations.map((c, i) => <blockquote key={i} className="border-l-4 border-primary/50 pl-3 text-sm italic">“{c}”</blockquote>)}
          <ul className="list-disc pl-5 text-sm">{result.improvements.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </Card>
      )}
    </div>
  );
}
