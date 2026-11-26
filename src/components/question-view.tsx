'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Columns2, Rows2, XCircle, ZoomIn } from 'lucide-react';
import { Markdown } from './markdown';
import { Badge, Modal, SyntheticBadge, cn } from './ui';
import { AREA_NAMES, DIFFICULTY_NAMES } from '@/lib/api';

export interface QuestionPayload {
  id: string;
  area_code?: string;
  year?: number | null;
  application?: string | null;
  statement_md: string;
  difficulty?: string | null;
  is_synthetic?: boolean;
  subtopic?: string | null;
  alternatives: { letter: string; body_md: string }[];
  assets?: { id: string; kind: string; storage_key: string; alt_text: string }[];
  origin?: string;
}

export interface Correction { correctAlternative: string | null; annulled?: boolean; solution?: string | null; isCorrect?: boolean | null }

/**
 * Resolução de questão (10.6): enunciado + alternativas verticais ou lado a lado (desktop),
 * vertical no celular; seleção e eliminação visual; ampliação de imagens; teclado (A–E).
 * Nenhuma pista/gabarito/IA antes do envio (2.4/7.7): a correção só aparece quando recebida.
 */
export function QuestionView({
  q, selected, eliminated, onSelect, onToggleEliminate, correction, disabled, layout: initialLayout = 'vertical',
}: {
  q: QuestionPayload;
  selected: string | null;
  eliminated: string[];
  onSelect: (l: string) => void;
  onToggleEliminate: (l: string) => void;
  correction?: Correction | null;
  disabled?: boolean;
  layout?: 'vertical' | 'split';
}) {
  const [layout, setLayout] = useState(initialLayout);
  const [zoom, setZoom] = useState<string | null>(null);
  useEffect(() => {
    if (disabled || correction) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
      const l = e.key.toUpperCase();
      if ('ABCDE'.includes(l) && l.length === 1 && q.alternatives.some((a) => a.letter === l)) onSelect(l);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, disabled, correction, onSelect]);

  const statement = (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        {q.area_code && <Badge>{AREA_NAMES[q.area_code] ?? q.area_code}</Badge>}
        {q.year && <Badge>ENEM {q.year}{q.application && q.application !== 'regular' ? ` · ${q.application.toUpperCase()}` : ''}</Badge>}
        {q.difficulty && <Badge>{DIFFICULTY_NAMES[q.difficulty]}</Badge>}
        {q.origin === 'nexo_twin' && <Badge tone="primary">Questão autoral NEXO (não oficial)</Badge>}
        <SyntheticBadge show={q.is_synthetic} />
      </div>
      <Markdown text={q.statement_md} className="text-[1.02rem]" />
      {q.assets?.filter((a) => a.kind === 'image').map((a) => (
        <button key={a.id} onClick={() => setZoom(a.storage_key)} className="group relative mt-3 block" aria-label={`Ampliar imagem: ${a.alt_text}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.storage_key} alt={a.alt_text} className="max-h-80 rounded-lg border border-border" />
          <ZoomIn className="absolute right-2 top-2 size-5 rounded bg-surface/80 p-0.5 opacity-70 group-hover:opacity-100" />
        </button>
      ))}
    </div>
  );

  const alternatives = (
    <div role="radiogroup" aria-label="Alternativas" className="space-y-2">
      {q.alternatives.map((a) => {
        const isSel = selected === a.letter;
        const isElim = eliminated.includes(a.letter);
        const isRight = correction && correction.correctAlternative === a.letter;
        const isWrongSel = correction && isSel && !isRight;
        return (
          <div key={a.letter} className="flex items-stretch gap-2">
            <button
              role="radio"
              aria-checked={isSel}
              disabled={disabled || Boolean(correction)}
              onClick={() => onSelect(a.letter)}
              className={cn('flex flex-1 items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                isSel ? 'border-primary bg-primary-soft/50' : 'border-border bg-surface hover:bg-surface-2',
                isElim && !correction && 'opacity-50 line-through',
                isRight && 'border-success bg-success-soft/60', isWrongSel && 'border-danger bg-danger-soft/60')}
            >
              <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold', isSel ? 'border-primary bg-primary text-on-primary' : 'border-border')}>{a.letter}</span>
              <Markdown text={a.body_md} className="flex-1 [&_p]:my-0" />
              {isRight && <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Alternativa correta" />}
              {isWrongSel && <XCircle className="size-5 shrink-0 text-danger" aria-label="Sua resposta" />}
            </button>
            {!correction && !disabled && (
              <button onClick={() => onToggleEliminate(a.letter)} aria-pressed={isElim} title={isElim ? 'Restaurar alternativa' : 'Eliminar alternativa'}
                aria-label={`${isElim ? 'Restaurar' : 'Eliminar'} alternativa ${a.letter}`} className="w-9 shrink-0 rounded-lg border border-border text-muted hover:bg-surface-2">
                <XCircle className="mx-auto size-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <div className="mb-2 hidden justify-end md:flex">
        <button onClick={() => setLayout(layout === 'vertical' ? 'split' : 'vertical')} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2"
          aria-label={layout === 'vertical' ? 'Mostrar lado a lado' : 'Mostrar na vertical'}>
          {layout === 'vertical' ? <Columns2 className="size-4" /> : <Rows2 className="size-4" />} {layout === 'vertical' ? 'Lado a lado' : 'Vertical'}
        </button>
      </div>
      <div className={cn(layout === 'split' ? 'md:grid md:grid-cols-2 md:gap-6' : 'space-y-5')}>
        {statement}
        <div className={cn(layout === 'split' ? 'mt-5 md:mt-0' : '')}>{alternatives}</div>
      </div>
      {correction && (
        <div className="mt-5 rounded-xl border border-border bg-surface-2 p-4">
          {correction.annulled ? <p className="font-medium">Questão anulada oficialmente — não conta como erro.</p> : (
            <p className="font-medium">{correction.isCorrect ? 'Resposta correta.' : `Resposta incorreta. Alternativa correta: ${correction.correctAlternative ?? '—'}.`}</p>
          )}
          {correction.solution ? <div className="mt-2"><div className="text-sm font-semibold">Resolução comentada</div><Markdown text={correction.solution} /></div>
            : <p className="mt-2 text-sm text-muted">Resolução comentada ainda não validada para esta questão.</p>}
        </div>
      )}
      <Modal open={Boolean(zoom)} onClose={() => setZoom(null)} title="Imagem ampliada" wide>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {zoom && <img src={zoom} alt="" className="mx-auto max-h-[70vh]" />}
      </Modal>
    </div>
  );
}

export function useQuestionState() {
  const [selected, setSelected] = useState<string | null>(null);
  const [eliminated, setEliminated] = useState<string[]>([]);
  return {
    selected, eliminated, setSelected, setEliminated,
    toggleEliminate: (l: string) => setEliminated((xs) => (xs.includes(l) ? xs.filter((x) => x !== l) : [...xs, l])),
    reset: () => { setSelected(null); setEliminated([]); },
  };
}
