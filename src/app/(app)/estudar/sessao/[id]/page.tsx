'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ListOrdered, Pause, Play, SkipForward, Trash2, X } from 'lucide-react';
import { api, ApiError, CATEGORY_NAMES, useApi } from '@/lib/api';
import { Badge, Button, Card, ErrorState, Loading, Progress } from '@/components/ui';
import { QuestionView, useQuestionState, type QuestionPayload, type Correction } from '@/components/question-view';
import { ConceptActivity, FlashcardReviewer, LessonReader } from '@/components/study';
import { useToast } from '@/components/toast';

interface Activity { id: string; position: number; activity_type: string; ref_type: string; ref_id: string | null; status: string; title: string | null; result: { meta?: { count?: number } } | null }
interface Session { id: string; status: string; category: string; focus: string; subtopic_id: string; subtopic_name: string; plan: { shortfall?: { note: string | null }; targetQuestions?: number }; activities: Activity[] }

const LABEL: Record<string, string> = { lesson: 'Teoria', question: 'Questão', concept_activity: 'Explicação ativa', flashcards: 'Flashcards', summary: 'Resumo' };

function SessionQuestion({ session, act, onDone }: { session: Session; act: Activity; onDone: () => void }) {
  const [q, setQ] = useState<QuestionPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const st = useQuestionState();
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [busy, setBusy] = useState(false);
  const [started] = useState(() => Date.now());
  const toast = useToast();
  // Componente montado com key={act.id}: estado novo a cada atividade, sem reset manual.
  useEffect(() => {
    const url = act.ref_type === 'twin' ? `/api/twins/${act.ref_id}` : `/api/questions/${act.ref_id}?context=session:${session.id}`;
    api<QuestionPayload>(url).then(setQ).catch((e) => setErr((e as Error).message));
  }, [act.ref_type, act.ref_id, session.id]);
  if (err) return <ErrorState message={err} />;
  if (!q) return <Loading />;
  return (
    <div>
      <QuestionView q={q} selected={st.selected} eliminated={st.eliminated} onSelect={st.setSelected} onToggleEliminate={st.toggleEliminate} correction={correction} />
      <div className="mt-4 flex justify-end gap-2">
        {!correction ? (
          <Button loading={busy} disabled={!st.selected} onClick={async () => {
            setBusy(true);
            try {
              const r = await api<{ isCorrect: boolean | null; correctAlternative: string | null; solution: string | null; annulled?: boolean }>(
                `/api/sessions/${session.id}/activities/${act.position}`, { body: { selected: st.selected, eliminated: st.eliminated, timeSpentMs: Date.now() - started } });
              setCorrection({ correctAlternative: r.correctAlternative, isCorrect: r.isCorrect, solution: r.solution, annulled: r.annulled });
            } catch (e) { toast('error', (e as Error).message); } finally { setBusy(false); }
          }}>Confirmar resposta</Button>
        ) : <Button onClick={onDone}>Próxima atividade</Button>}
      </div>
    </div>
  );
}

/** Interface da sessão (10.5): uma atividade por vez, menu recolhido, progresso discreto, pausa/retomada. */
export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: s, error, loading, reload, setData } = useApi<Session>(`/api/sessions/${id}`);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);

  const action = useCallback(async (a: 'start' | 'resume' | 'pause' | 'abandon') => {
    setBusy(true);
    try { setData(await api<Session>(`/api/sessions/${id}`, { body: { action: a } })); if (a === 'abandon') router.push('/inicio'); }
    catch (e) { toast('error', e instanceof ApiError ? e.message : 'Falha.'); } finally { setBusy(false); }
  }, [id, router, setData, toast]);

  if (loading && !s) return <Loading />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!s) return null;
  const pending = s.activities.filter((a) => a.status === 'pending');
  const done = s.activities.length - pending.length;
  const act = s.activities.find((a) => a.position === current) ?? pending[0];

  const complete = async (position: number, outcome: 'completed' | 'skipped', result?: Record<string, unknown>) => {
    try { setData(await api<Session>(`/api/sessions/${id}/activities/${position}`, { body: { outcome, result } })); setCurrent(null); }
    catch (e) { toast('error', (e as Error).message); }
  };

  if (s.status === 'planned') {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between"><Link href="/inicio" className="text-sm text-muted">← Início</Link><Badge tone="primary">{CATEGORY_NAMES[s.category]}</Badge></div>
        <h1 className="text-2xl font-semibold">{s.subtopic_name}</h1>
        <p className="text-muted">Composição planejada para você. Ajuste antes de começar; depois do início, a sessão não muda automaticamente.</p>
        {s.plan.shortfall?.note && <p className="rounded-lg bg-surface-2 p-3 text-sm">{s.plan.shortfall.note}</p>}
        <ol className="space-y-2">
          {s.activities.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
              <span>{a.position}. {LABEL[a.activity_type]}{a.title && a.activity_type !== 'question' ? ` — ${a.title}` : ''}</span>
              {s.activities.length > 1 && <button aria-label="Remover atividade" className="rounded p-1 text-muted hover:bg-surface-2" onClick={async () => {
                try { setData(await api<Session>(`/api/sessions/${id}/activities/${a.position}`, { method: 'DELETE' })); } catch (e) { toast('error', (e as Error).message); }
              }}><Trash2 className="size-4" /></button>}
            </li>
          ))}
        </ol>
        <div className="flex gap-2"><Button loading={busy} onClick={() => action('start')}><Play className="size-4" /> Começar</Button><Button variant="ghost" onClick={() => action('abandon')}>Descartar</Button></div>
      </div>
    );
  }

  if (s.status === 'completed' || s.status === 'abandoned' || !act) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <CheckCircle2 className="mx-auto mb-2 size-10 text-success" />
        <h1 className="text-xl font-semibold">Sessão concluída</h1>
        <p className="mt-1 text-muted">Seus resultados alimentam as próximas recomendações.</p>
        <Link href="/inicio" className="mt-4 inline-flex h-10 items-center rounded-lg bg-primary px-4 font-medium text-on-primary">Voltar ao início</Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Sequência da sessão" className="rounded-lg p-2 hover:bg-surface-2"><ListOrdered className="size-5" /></button>
        <div className="flex-1"><div className="mb-1 flex justify-between text-xs text-muted"><span className="truncate">{s.subtopic_name}</span><span>{done}/{s.activities.length}</span></div><Progress value={(done / s.activities.length) * 100} label="Progresso da sessão" /></div>
        {s.status === 'paused'
          ? <Button size="sm" onClick={() => action('resume')} loading={busy}><Play className="size-4" /> Retomar</Button>
          : <Button size="sm" variant="secondary" onClick={() => action('pause')} loading={busy}><Pause className="size-4" /> Pausar</Button>}
        <button onClick={() => router.push('/inicio')} aria-label="Sair (a sessão fica salva)" className="rounded-lg p-2 hover:bg-surface-2"><X className="size-5" /></button>
      </div>
      {menu && (
        <ol className="rounded-xl border border-border bg-surface p-2">
          {s.activities.map((a) => (
            <li key={a.id}><button disabled={a.status !== 'pending'} onClick={() => { setCurrent(a.position); setMenu(false); }}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2 disabled:opacity-60">
              <span>{a.position}. {LABEL[a.activity_type]}</span>{a.status !== 'pending' && <Badge tone={a.status === 'completed' ? 'success' : 'neutral'}>{a.status === 'completed' ? 'feita' : 'pulada'}</Badge>}
            </button></li>
          ))}
        </ol>
      )}
      {s.status === 'paused' ? <Card className="text-center text-muted">Sessão pausada. Retome quando quiser — nada se perde.</Card> : (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between"><Badge>{LABEL[act.activity_type]}</Badge>
            {act.activity_type !== 'question' && <button className="inline-flex items-center gap-1 text-xs text-muted" onClick={() => complete(act.position, 'skipped')}><SkipForward className="size-4" /> Pular</button>}
          </div>
          {act.activity_type === 'question' && <SessionQuestion key={act.id} session={s} act={act} onDone={() => { void reload(); setCurrent(null); }} />}
          {(act.activity_type === 'lesson' || act.activity_type === 'summary') && act.ref_id && <LessonReader key={act.id} lessonId={act.ref_id} onCompleted={() => complete(act.position, 'completed')} />}
          {act.activity_type === 'concept_activity' && act.ref_id && (
            <div><ConceptActivity key={act.id} activityId={act.ref_id} sessionActivityId={act.id} onEvaluated={() => undefined} />
              <div className="mt-4 flex justify-end"><Button variant="secondary" onClick={() => complete(act.position, 'completed')}>Continuar</Button></div></div>
          )}
          {act.activity_type === 'flashcards' && <FlashcardReviewer key={act.id} query={`subtopicId=${s.subtopic_id}`} max={act.result?.meta?.count ?? 20} onFinished={(n) => complete(act.position, 'completed', { reviewed: n })} />}
        </Card>
      )}
    </div>
  );
}
