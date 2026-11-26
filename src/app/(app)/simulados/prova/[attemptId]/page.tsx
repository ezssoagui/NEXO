'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bookmark, Pause, Play, Timer } from 'lucide-react';
import { api, useApi } from '@/lib/api';
import { Button, Card, ErrorState, Loading, cn } from '@/components/ui';
import { QuestionView, type QuestionPayload } from '@/components/question-view';
import { useToast } from '@/components/toast';

interface Attempt { id: string; title: string; kind: string; status: string; timer_mode: string; remainingSeconds: number | null; answers: { position: number; question_id: string; selected_alternative: string | null; marked_for_review: boolean }[] }

function fmt(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Cronômetro inicializado pelo servidor; contagem local apenas para exibição (o servidor valida o tempo). */
function Countdown({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (remaining === 0) onExpire();
  }, [remaining, onExpire]);
  return <span className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-sm', remaining < 300 ? 'bg-danger-soft text-danger' : 'bg-surface-2')} aria-live="off"><Timer className="size-4" />{fmt(remaining)}</span>;
}

/** Prova sem IA, pistas ou gabarito (5.9/7.7); navegação livre; marcação temporária para revisão. */
export default function ExamRunner() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data, error, loading, setData, reload } = useApi<Attempt>(`/api/exam-attempts/${attemptId}`);
  const [pos, setPos] = useState(1);
  const [loaded, setLoaded] = useState<{ id: string; q: QuestionPayload } | null>(null);
  const [elim, setElim] = useState<Record<number, string[]>>({});
  const [busy, setBusy] = useState(false);
  const ans = data?.answers.find((a) => a.position === pos);
  const qid = ans?.question_id;
  useEffect(() => { if (data?.status === 'finished') router.replace(`/simulados/resultado/${attemptId}`); }, [data?.status, attemptId, router]);
  useEffect(() => {
    if (!qid) return;
    api<QuestionPayload>(`/api/questions/${qid}?context=exam:${attemptId}`).then((q) => setLoaded({ id: qid, q }), (e) => toast('error', (e as Error).message));
  }, [qid, attemptId, toast]);
  const q = loaded && loaded.id === qid ? loaded.q : null;

  async function save(body: Record<string, unknown>) {
    try {
      const r = await api<{ ok?: boolean; status?: string }>(`/api/exam-attempts/${attemptId}`, { method: 'PUT', body: { position: pos, ...body } });
      if (r.status === 'finished') router.replace(`/simulados/resultado/${attemptId}`);
    } catch (e) { toast('error', (e as Error).message); }
  }
  async function finish(auto = false) {
    if (!auto && !confirm('Encerrar o simulado? Depois disso você verá a correção.')) return;
    setBusy(true);
    try { await api(`/api/exam-attempts/${attemptId}`, { body: { action: 'finish' } }); router.replace(`/simulados/resultado/${attemptId}`); }
    catch (e) { toast('error', (e as Error).message); setBusy(false); }
  }
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data || !ans) return null;
  const answered = data.answers.filter((a) => a.selected_alternative).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">{data.title} · {answered}/{data.answers.length}</div>
        <div className="flex items-center gap-2">
          {data.remainingSeconds !== null && data.status === 'in_progress' && <Countdown key={data.remainingSeconds} seconds={data.remainingSeconds} onExpire={() => finish(true)} />}
          {data.timer_mode === 'none' && (data.status === 'paused'
            ? <Button size="sm" onClick={async () => setData(await api<Attempt>(`/api/exam-attempts/${attemptId}`, { body: { action: 'resume' } }))}><Play className="size-4" /> Retomar</Button>
            : <Button size="sm" variant="secondary" onClick={async () => { setData(await api<Attempt>(`/api/exam-attempts/${attemptId}`, { body: { action: 'pause' } })); router.push('/simulados'); }}><Pause className="size-4" /> Pausar e sair</Button>)}
          <Button size="sm" variant="danger" loading={busy} onClick={() => finish()}>Encerrar</Button>
        </div>
      </div>
      <details className="rounded-xl border border-border bg-surface p-3" open>
        <summary className="cursor-pointer text-sm font-medium">Navegação</summary>
        <div className="mt-2 flex flex-wrap gap-1">
          {data.answers.map((a) => (
            <button key={a.position} onClick={() => setPos(a.position)} aria-current={a.position === pos} aria-label={`Questão ${a.position}${a.selected_alternative ? ', respondida' : ''}${a.marked_for_review ? ', marcada' : ''}`}
              className={cn('relative size-8 rounded border text-xs', a.position === pos ? 'border-primary bg-primary text-on-primary' : a.selected_alternative ? 'border-border bg-primary-soft' : 'border-border bg-surface')}>
              {a.position}{a.marked_for_review && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-award" />}
            </button>
          ))}
        </div>
      </details>
      {data.status === 'paused' ? <Card className="text-center text-muted">Simulado pausado.</Card> : (
        <Card className="p-5">
          {!q ? <Loading /> : (
            <QuestionView q={q} selected={ans.selected_alternative} eliminated={elim[pos] ?? []}
              onSelect={(l) => { setData({ ...data, answers: data.answers.map((a) => (a.position === pos ? { ...a, selected_alternative: l } : a)) }); void save({ selected: l }); }}
              onToggleEliminate={(l) => { const cur = elim[pos] ?? []; const next = cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]; setElim({ ...elim, [pos]: next }); void save({ eliminated: next }); }} />
          )}
          <div className="mt-4 flex justify-between">
            <Button variant="secondary" disabled={pos <= 1} onClick={() => setPos(pos - 1)}>Anterior</Button>
            <Button variant="ghost" onClick={() => { const m = !ans.marked_for_review; setData({ ...data, answers: data.answers.map((a) => (a.position === pos ? { ...a, marked_for_review: m } : a)) }); void save({ marked: m }); }}>
              <Bookmark className={cn('size-4', ans.marked_for_review && 'fill-award text-award')} /> {ans.marked_for_review ? 'Desmarcar' : 'Marcar para revisar'}
            </Button>
            <Button variant="secondary" disabled={pos >= data.answers.length} onClick={() => setPos(pos + 1)}>Próxima</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
