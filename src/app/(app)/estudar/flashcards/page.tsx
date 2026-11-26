'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, useApi } from '@/lib/api';
import { Button, Card, Empty, Input, Loading, PageHeader, SyntheticBadge, Textarea } from '@/components/ui';
import { FlashcardReviewer } from '@/components/study';
import { useToast } from '@/components/toast';

interface Deck { id: string; title: string; kind: string; personal: boolean; subtopic: string | null; cards: number; due: number; is_synthetic: boolean }

function Flashcards() {
  const deck = useSearchParams().get('deck');
  const [active, setActive] = useState<string | null>(deck ? `deckId=${deck}` : null);
  const { data, loading, reload } = useApi<{ decks: Deck[] }>('/api/flashcards/decks');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const toast = useToast();
  if (active) return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => { setActive(null); void reload(); }}>← Baralhos</Button>
      <FlashcardReviewer query={active} onFinished={() => undefined} />
    </div>
  );
  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold">Revisão do dia</h2><p className="text-sm text-muted">Cartões vencidos de todos os baralhos, priorizados pelo FSRS.</p></div>
        <Button onClick={() => setActive('all=1')}>Revisar agora</Button>
      </Card>
      <section>
        <h2 className="mb-2 font-semibold">Baralhos</h2>
        {loading ? <Loading /> : !data?.decks.length ? <Empty title="Nenhum baralho disponível" /> : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.decks.map((d) => (
              <li key={d.id}><button onClick={() => setActive(`deckId=${d.id}`)} className="w-full rounded-lg border border-border bg-surface p-3 text-left hover:bg-surface-2">
                <div className="font-medium">{d.title}<SyntheticBadge show={d.is_synthetic} /></div>
                <div className="text-xs text-muted">{d.cards} cartões · {d.due} para revisar{d.personal ? ' · pessoal' : ''}</div>
              </button></li>
            ))}
          </ul>
        )}
      </section>
      <Card className="space-y-3">
        <h2 className="font-semibold">Criar cartão próprio</h2>
        <Input label="Frente" value={front} onChange={(e) => setFront(e.target.value)} maxLength={2000} />
        <Textarea label="Verso" rows={3} value={back} onChange={(e) => setBack(e.target.value)} maxLength={4000} />
        <Button disabled={!front.trim() || !back.trim()} onClick={async () => {
          try { await api('/api/flashcards/cards', { body: { front, back, deckTitle: 'Meus cartões' } }); setFront(''); setBack(''); toast('success', 'Cartão criado.'); void reload(); }
          catch (e) { toast('error', (e as Error).message); }
        }}>Adicionar</Button>
      </Card>
    </div>
  );
}

export default function FlashcardsPage() {
  return <div><PageHeader title="Flashcards" description="Recuperação ativa com repetição espaçada (FSRS): Errei, Difícil, Bom ou Fácil." /><Suspense><Flashcards /></Suspense></div>;
}
