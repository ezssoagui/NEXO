'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { api, ApiError, useApi, uuid } from '@/lib/api';
import { Markdown } from './markdown';
import { Badge, Button, Card, Empty, ErrorState, Loading, SyntheticBadge, Textarea } from './ui';
import { useToast } from './toast';
import { FeedbackButton } from './app-shell';

interface Lesson { id: string; title: string; kind: string; subtopic_name: string; is_synthetic: boolean; estimated_minutes: number | null; blocks: { position: number; block_type: string; body_md: string }[] }
const KIND: Record<string, string> = { lesson: 'Aula', microlesson: 'Microaula', summary: 'Resumo', worked_example: 'Exemplo resolvido', visual: 'Representação visual' };

/** Leitura de aula: registra leitura, nunca evidência de domínio (5.1/8.6). */
export function LessonReader({ lessonId, onCompleted }: { lessonId: string; onCompleted?: () => void }) {
  const { data, error, loading, reload } = useApi<Lesson>(`/api/lessons/${lessonId}`);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error.message} onRetry={error.code === 'plan_required' ? undefined : reload} />;
  if (!data) return null;
  return (
    <article>
      <div className="mb-2 flex flex-wrap items-center gap-2"><Badge>{KIND[data.kind] ?? data.kind}</Badge>{data.estimated_minutes && <span className="text-xs text-muted">~{data.estimated_minutes} min</span>}<SyntheticBadge show={data.is_synthetic} /></div>
      <h2 className="text-xl font-semibold">{data.title}</h2>
      <p className="mb-4 text-sm text-muted">{data.subtopic_name}</p>
      <div className="space-y-3">
        {data.blocks.map((b) => (
          <div key={b.position} className={b.block_type === 'key_point' || b.block_type === 'summary_point' ? 'rounded-lg border-l-4 border-primary bg-surface-2 p-3' : b.block_type === 'example' ? 'rounded-lg border border-border p-3' : ''}>
            {b.block_type === 'example' && <div className="mb-1 text-xs font-semibold uppercase text-muted">Exemplo</div>}
            <Markdown text={b.body_md} />
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <Button loading={busy} disabled={done} onClick={async () => {
          setBusy(true);
          try { await api(`/api/lessons/${lessonId}`, { method: 'POST' }); setDone(true); onCompleted?.(); }
          catch (e) { toast('error', (e as Error).message); } finally { setBusy(false); }
        }}>{done ? <><CheckCircle2 className="size-4" /> Concluída</> : 'Marcar como estudada'}</Button>
        <FeedbackButton entityType="lesson" entityId={lessonId} label="Reportar problema" defaultKind="question_error" />
      </div>
    </article>
  );
}

interface ConceptResult { id: string; score: number | null; status: string; reference_answer_md: string; feedback: { justification: string; correct_points: string[]; missing_points: string[]; misconceptions: string[]; feedback: string } | null }
const RUBRIC = ['Insuficiente', 'Parcial', 'Adequada', 'Profunda'];

/** Explicação ativa (2.5/7.4): resposta própria sem pistas; avaliação somente após envio. */
export function ConceptActivity({ activityId, sessionActivityId, onEvaluated }: { activityId: string; sessionActivityId?: string; onEvaluated?: () => void }) {
  const { data, error, loading } = useApi<{ id: string; kind: string; prompt_md: string; skill_name: string; is_synthetic: boolean }>(`/api/concept/${activityId}`);
  const [text, setText] = useState('');
  const [key] = useState(uuid);
  const [result, setResult] = useState<ConceptResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Badge tone="primary">Explicação ativa</Badge><span className="text-xs text-muted">{data.skill_name}</span><SyntheticBadge show={data.is_synthetic} /></div>
      <Markdown text={data.prompt_md} className="text-lg" />
      {!result ? (
        <>
          <Textarea label="Sua explicação (com suas palavras)" rows={7} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
          <p className="text-xs text-muted">Avaliamos a compreensão do conteúdo, não o estilo. Nenhuma ajuda é exibida antes do envio.</p>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <Button loading={busy} disabled={text.trim().length < 10} onClick={async () => {
            setBusy(true); setErr(null);
            try {
              const r = await api<ConceptResult>(`/api/concept/${activityId}`, { body: { response: text, idempotencyKey: key, sessionActivityId } });
              setResult(r); onEvaluated?.();
            } catch (e) { setErr(e instanceof ApiError ? e.message : 'Falha ao enviar.'); } finally { setBusy(false); }
          }}>Enviar para avaliação</Button>
        </>
      ) : (
        <Card className="space-y-3 bg-surface-2">
          <div className="text-lg font-semibold">Avaliação: {result.score} — {RUBRIC[result.score ?? 0]}</div>
          {result.feedback && (
            <>
              <p>{result.feedback.feedback}</p>
              {result.feedback.correct_points.length > 0 && <div><div className="text-sm font-semibold">Pontos corretos</div><ul className="list-disc pl-5 text-sm">{result.feedback.correct_points.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
              {result.feedback.missing_points.length > 0 && <div><div className="text-sm font-semibold">O que faltou</div><ul className="list-disc pl-5 text-sm">{result.feedback.missing_points.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
              {result.feedback.misconceptions.length > 0 && <div><div className="text-sm font-semibold">Concepções a revisar</div><ul className="list-disc pl-5 text-sm">{result.feedback.misconceptions.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
            </>
          )}
          <details><summary className="cursor-pointer text-sm font-medium">Resposta de referência</summary><Markdown text={result.reference_answer_md} /></details>
          <FeedbackButton entityType="concept_response" entityId={result.id} label="Avaliação inadequada?" defaultKind="evaluation_issue" />
        </Card>
      )}
    </div>
  );
}

interface CardItem { id: string; front_md: string; back_md: string; deck_title: string; is_new: boolean }

/** Revisão FSRS com Errei/Difícil/Bom/Fácil (5.6/15.7). */
export function FlashcardReviewer({ query, max = 20, onFinished }: { query: string; max?: number; onFinished?: (reviewed: number) => void }) {
  const [cards, setCards] = useState<CardItem[] | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => {
    api<{ cards: CardItem[] }>(`/api/flashcards/due?${query}&limit=${max}`).then((r) => setCards(r.cards)).catch((e) => setError((e as Error).message));
  }, [query, max]);
  if (error) return <ErrorState message={error} />;
  if (!cards) return <Loading />;
  if (cards.length === 0 || i >= cards.length) {
    return (
      <Empty title={reviewed ? `Revisão concluída: ${reviewed} cartão(ões).` : 'Nenhum cartão para revisar agora.'}>
        {onFinished && <Button size="sm" onClick={() => onFinished(reviewed)}>Continuar</Button>}
      </Empty>
    );
  }
  const c = cards[i]!;
  const rate = async (rating: 'again' | 'hard' | 'good' | 'easy') => {
    try {
      await api('/api/flashcards/review', { body: { cardId: c.id, rating, idempotencyKey: uuid() } });
      setReviewed((n) => n + 1); setFlipped(false); setI((n) => n + 1);
      if (i + 1 >= cards.length) onFinished?.(reviewed + 1);
    } catch (e) { toast('error', (e as Error).message); }
  };
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-2 flex justify-between text-xs text-muted"><span>{c.deck_title}</span><span>{i + 1} / {cards.length}</span></div>
      <button onClick={() => setFlipped(true)} className="flex min-h-48 w-full flex-col justify-center rounded-xl border border-border bg-surface p-6 text-left" aria-label={flipped ? 'Resposta' : 'Mostrar resposta'}>
        <Markdown text={c.front_md} className="text-lg" />
        {flipped && <div className="mt-4 border-t border-border pt-4"><Markdown text={c.back_md} /></div>}
        {!flipped && <span className="mt-4 text-sm text-muted">Tente lembrar antes de ver a resposta. Toque para revelar.</span>}
      </button>
      {flipped && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          <Button variant="secondary" onClick={() => rate('again')}>Errei</Button>
          <Button variant="secondary" onClick={() => rate('hard')}>Difícil</Button>
          <Button variant="secondary" onClick={() => rate('good')}>Bom</Button>
          <Button variant="secondary" onClick={() => rate('easy')}>Fácil</Button>
        </div>
      )}
    </div>
  );
}
