'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, useApi } from '@/lib/api';
import { Badge, Button, Card, ErrorState, Loading, cn } from '@/components/ui';
import { QuestionView, type QuestionPayload } from '@/components/question-view';
import { useToast } from '@/components/toast';

interface ListItem { position: number; question_id: string; selected_alternative: string | null; correctAlternative?: string | null; solution?: string | null; annulled?: boolean }
interface List { id: string; mode: string; status: string; items: ListItem[] }

/** Lista/bateria: correção somente ao final (2.4/5.3). */
export default function ListPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, setData } = useApi<List>(`/api/lists/${id}`);
  const [pos, setPos] = useState(1);
  const [loaded, setLoaded] = useState<{ id: string; q: QuestionPayload | null; err: string | null } | null>(null);
  const [eliminated, setEliminated] = useState<Record<number, string[]>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const item = data?.items.find((i) => i.position === pos);
  const qid = item?.question_id;
  useEffect(() => {
    if (!qid) return;
    api<QuestionPayload>(`/api/questions/${qid}?context=list:${id}`).then((q) => setLoaded({ id: qid, q, err: null }), (e) => setLoaded({ id: qid, q: null, err: (e as Error).message }));
  }, [qid, id]);
  const q = loaded && loaded.id === qid ? loaded.q : null;
  const qErr = loaded && loaded.id === qid ? loaded.err : null;
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error.message} />;
  if (!data || !item) return null;
  const finished = data.status === 'finished';
  const select = async (l: string) => {
    setData({ ...data, items: data.items.map((i) => (i.position === pos ? { ...i, selected_alternative: l } : i)) });
    try { await api(`/api/lists/${id}`, { method: 'PUT', body: { position: pos, selected: l, eliminated: eliminated[pos] ?? [] } }); } catch (e) { toast('error', (e as Error).message); }
  };
  const correct = finished ? data.items.filter((i) => i.selected_alternative && i.selected_alternative === i.correctAlternative).length : 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><Link href="/questoes" className="text-sm text-muted">← Questões</Link>
        {finished ? <Badge tone="success">Corrigida: {correct}/{data.items.filter((i) => !i.annulled).length}</Badge> : <Badge>{data.items.filter((i) => i.selected_alternative).length}/{data.items.length} respondidas</Badge>}</div>
      <nav aria-label="Questões da lista" className="flex flex-wrap gap-1">
        {data.items.map((i) => (
          <button key={i.position} onClick={() => setPos(i.position)} aria-current={i.position === pos}
            className={cn('size-9 rounded-lg border text-sm', i.position === pos ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface',
              finished && i.selected_alternative && (i.selected_alternative === i.correctAlternative ? 'border-success' : 'border-danger'),
              !finished && i.selected_alternative && i.position !== pos && 'bg-primary-soft')}>{i.position}</button>
        ))}
      </nav>
      <Card className="p-5">
        {qErr ? <ErrorState message={qErr} /> : !q ? <Loading /> : (
          <QuestionView q={q} selected={item.selected_alternative} eliminated={eliminated[pos] ?? []} onSelect={select}
            onToggleEliminate={(l) => setEliminated({ ...eliminated, [pos]: (eliminated[pos] ?? []).includes(l) ? (eliminated[pos] ?? []).filter((x) => x !== l) : [...(eliminated[pos] ?? []), l] })}
            correction={finished ? { correctAlternative: item.correctAlternative ?? null, isCorrect: item.selected_alternative === item.correctAlternative, solution: item.solution, annulled: item.annulled } : null}
            disabled={finished} />
        )}
      </Card>
      <div className="flex justify-between">
        <Button variant="secondary" disabled={pos <= 1} onClick={() => setPos(pos - 1)}>Anterior</Button>
        {pos < data.items.length ? <Button variant="secondary" onClick={() => setPos(pos + 1)}>Próxima</Button>
          : !finished && <Button loading={busy} onClick={async () => {
            if (data.items.some((i) => !i.selected_alternative) && !confirm('Há questões sem resposta. Encerrar mesmo assim? (questões em branco não contam como erro)')) return;
            setBusy(true);
            try { setData(await api<List>(`/api/lists/${id}`, { method: 'POST' })); setPos(1); } catch (e) { toast('error', (e as Error).message); } finally { setBusy(false); }
          }}>Encerrar e corrigir</Button>}
      </div>
    </div>
  );
}
