'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, useApi } from '@/lib/api';
import { Badge, Button, Card, ErrorState, Loading, Textarea } from '@/components/ui';
import { QuestionView, type QuestionPayload } from '@/components/question-view';
import { useToast } from '@/components/toast';

interface Cpe { attemptId: string; questionId: string; selected: string | null; steps: { step: string }[]; reference: { comando?: string; prova?: string; eliminacao?: Record<string, string> } | null }
const STEPS = [
  { key: 'comando', title: 'Comando', help: 'O que exatamente a questão pede? Reescreva o comando com suas palavras.' },
  { key: 'prova', title: 'Prova', help: 'Qual trecho do texto/contexto comprova a resposta correta?' },
  { key: 'eliminacao', title: 'Eliminação', help: 'Por que cada alternativa incorreta deve ser descartada?' },
] as const;

/** Método CPE (2.6) sem IA: reflexão guiada; referência exibida somente após cada etapa respondida. */
export default function CpePage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { data, error, loading, setData } = useApi<Cpe>(`/api/attempts/${attemptId}/cpe`);
  const [q, setQ] = useState<QuestionPayload | null>(null);
  const [text, setText] = useState('');
  const [elims, setElims] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (data?.questionId) api<QuestionPayload>(`/api/questions/${data.questionId}`).then(setQ).catch(() => undefined);
  }, [data?.questionId]);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;
  const done = new Set(data.steps.map((s) => s.step));
  const current = STEPS.find((s) => !done.has(s.key));
  const submit = async (self: 'correct' | 'partial' | 'incorrect') => {
    if (!current) return;
    setBusy(true);
    try {
      setData(await api<Cpe>(`/api/attempts/${attemptId}/cpe`, { body: { step: current.key, text: text || undefined, eliminations: current.key === 'eliminacao' ? elims : undefined, selfAssessment: self } }));
      setText('');
    } catch (e) { toast('error', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/questoes" className="text-sm text-muted">← Questões</Link>
      <h1 className="text-2xl font-semibold">Método CPE</h1>
      <p className="text-muted">Etapas opcionais; o erro continua registrado e esta análise pode gerar evidência de compreensão.</p>
      {q && <Card className="p-5"><QuestionView q={q} selected={data.selected} eliminated={[]} onSelect={() => undefined} onToggleEliminate={() => undefined} disabled /></Card>}
      {STEPS.map((s) => (
        <Card key={s.key} className={done.has(s.key) ? 'bg-surface-2' : ''}>
          <div className="mb-2 flex items-center gap-2"><Badge tone={done.has(s.key) ? 'success' : 'primary'}>{s.title}</Badge>{done.has(s.key) && <span className="text-xs text-muted">respondida</span>}</div>
          {done.has(s.key) && data.reference && (
            <div className="text-sm"><span className="font-medium">Referência: </span>
              {s.key === 'eliminacao' ? <ul className="list-disc pl-5">{Object.entries(data.reference.eliminacao ?? {}).map(([k, v]) => <li key={k}>{k}) {v}</li>)}</ul> : data.reference[s.key]}
            </div>
          )}
          {current?.key === s.key && (
            <div className="space-y-3">
              <p className="text-sm">{s.help}</p>
              {s.key === 'eliminacao' ? (
                <div className="space-y-2">{q?.alternatives.map((a) => (
                  <label key={a.letter} className="flex items-center gap-2 text-sm"><span className="w-6 font-semibold">{a.letter})</span>
                    <input className="h-9 flex-1 rounded-lg border border-border bg-surface px-2" value={elims[a.letter] ?? ''} onChange={(e) => setElims({ ...elims, [a.letter]: e.target.value })} placeholder="Motivo (deixe vazio na correta)" /></label>
                ))}</div>
              ) : <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} aria-label={s.title} />}
              <p className="text-xs text-muted">Depois de responder, compare com a referência e avalie você mesmo:</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" loading={busy} onClick={() => submit('correct')}>Acertei</Button>
                <Button size="sm" variant="secondary" loading={busy} onClick={() => submit('partial')}>Parcialmente</Button>
                <Button size="sm" variant="secondary" loading={busy} onClick={() => submit('incorrect')}>Errei</Button>
              </div>
            </div>
          )}
        </Card>
      ))}
      {!current && <Card className="text-center"><p className="font-medium">CPE concluído.</p><Link href="/inicio" className="text-sm text-primary">Voltar ao início</Link></Card>}
    </div>
  );
}
