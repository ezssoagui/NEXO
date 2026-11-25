import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { Attempt, AttemptMode, Confidence, Question } from '../types';
import { isCorrect, useStore } from '../store/useStore';
import { disciplineOf } from '../data/curriculum';
import Correction from './Correction';
import { Badge, cx } from './ui';

const CONF: { id: Confidence; label: string }[] = [{ id: 'certeza', label: 'Tenho certeza' }, { id: 'duvida', label: 'Tenho dúvida' }, { id: 'chute', label: 'Chutei' }];
export interface Answer { chosen: string; confidence: Confidence; timeSec: number; justification?: string }

/**
 * RESOLUÇÃO INDEPENDENTE: sem dicas, sem IA e sem correção até o envio.
 * Reutilizada no estudo adaptativo, em baterias, simulados, diagnóstico e sessões.
 */
export function QuestionForm({ q, initial, submitLabel = 'Responder', onSubmit, extra }: { q: Question; initial?: Answer; submitLabel?: string; onSubmit: (a: Answer) => void; extra?: React.ReactNode }) {
  const ask = useStore((s) => s.settings.askConfidence); const showTimer = useStore((s) => s.settings.showTimer); const setOpen = useStore((s) => s.setOpenQuestion);
  const [choice, setChoice] = useState(initial?.chosen ?? ''); const [conf, setConf] = useState<Confidence | ''>(initial && initial.confidence !== 'nao_informada' ? initial.confidence : '');
  const [reason, setReason] = useState(''); const [showReason, setShowReason] = useState(false); const [sec, setSec] = useState(0);
  const start = useRef(Date.now());
  useEffect(() => { setOpen(q.id); return () => setOpen(null); }, [q.id, setOpen]);
  useEffect(() => { if (!showTimer) return; const t = setInterval(() => setSec((s) => s + 1), 1000); return () => clearInterval(t); }, [showTimer]);
  const send = (c: string, k: Confidence) => onSubmit({ chosen: c, confidence: k, timeSec: Math.round((Date.now() - start.current) / 1000) + (initial?.timeSec ?? 0), justification: reason.trim() || undefined });
  return (
    <div>
      <QuestionHead q={q} right={showTimer ? <span className="muted font-mono text-xs">{Math.floor(sec / 60)}:{String(sec % 60).padStart(2, '0')}</span> : undefined} />
      <fieldset className="mt-5 space-y-2"><legend className="sr-only">Alternativas</legend>
        {q.alternatives!.map((a) => (
          <label key={a.letter} className={cx('flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-[15px] transition-colors focus-within:ring-2 focus-within:ring-brand-500', choice === a.letter ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/15' : 'border-ink-200 hover:border-ink-300 dark:border-ink-700')}>
            <input type="radio" name={`alt-${q.id}`} value={a.letter} checked={choice === a.letter} onChange={() => setChoice(a.letter)} className="sr-only" />
            <span className={cx('w-5 shrink-0 text-sm font-semibold', choice === a.letter ? 'text-brand-700 dark:text-brand-300' : 'text-ink-400')}>{a.letter}</span><span className="leading-relaxed">{a.text}</span>
          </label>
        ))}
      </fieldset>
      {ask && <div className="mt-5 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Confiança (opcional)"><span className="muted mr-1 text-xs">Confiança (opcional)</span>{CONF.map((c) => <button key={c.id} type="button" role="radio" aria-checked={conf === c.id} onClick={() => setConf(conf === c.id ? '' : c.id)} className={cx('rounded-full border px-3 py-1 text-xs transition-colors', conf === c.id ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200' : 'border-ink-200 text-ink-600 hover:border-ink-300 dark:border-ink-700 dark:text-ink-300')}>{c.label}</button>)}</div>}
      {showReason && <div className="mt-4"><label className="label" htmlFor={`j-${q.id}`}>Como você pensou? <span className="muted font-normal">(opcional)</span></label><textarea id={`j-${q.id}`} className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={!choice} onClick={() => send(choice, conf || 'nao_informada')}>{submitLabel}</button>
        {extra}
        {!showReason && <button className="btn-quiet text-xs" onClick={() => setShowReason(true)}>Registrar raciocínio</button>}
        <button className="btn-quiet text-xs" onClick={() => send('—', 'nao_consegui')}>Não consegui resolver</button>
      </div>
    </div>
  );
}

export function QuestionHead({ q, right }: { q: Question; right?: React.ReactNode }) {
  const [open, setOpen] = useState(false); const { report, notify } = useStore.getState();
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="muted">{disciplineOf(q.skillId)} · {q.topic} · {q.difficulty}</span>
        <Badge title={q.source === 'gerada_ia_demo' ? 'Gabarito recalculado automaticamente. Sem revisão humana.' : 'Questão original do protótipo. Ainda sem revisão pedagógica humana.'}>{q.source === 'gerada_ia_demo' ? 'Modelo paramétrico, não revisada' : 'Demonstrativa, não revisada'}</Badge>
        <span className="ml-auto flex items-center gap-3">{right}<button className="muted hover:underline" onClick={() => setOpen(!open)}>Relatar erro</button></span>
      </div>
      {open && <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); const r = String(new FormData(e.currentTarget).get('r') ?? '').trim(); if (r) { report(q.id, r); notify('Relato registrado.'); } setOpen(false); }}><label className="sr-only" htmlFor="rep">O que parece errado?</label><input id="rep" name="r" className="input" placeholder="O que parece errado?" /><button className="btn-ghost btn-sm">Enviar</button></form>}
      {q.context && <p className="mb-4 whitespace-pre-line leading-relaxed text-ink-700 dark:text-ink-300">{q.context}</p>}
      <p className="font-medium leading-relaxed text-ink-900 dark:text-white">{q.statement}</p>
    </>
  );
}

/** Estudo com correção logo após cada resposta. */
export default function QuestionPlayer({ q, mode = 'adaptativo', isTwin, twinLevel, onDone, onAnswered, doneLabel }: { q: Question; mode?: AttemptMode; isTwin?: boolean; twinLevel?: 1 | 2 | 3; onDone?: (a: Attempt) => void; onAnswered?: (a: Attempt) => void; doneLabel?: string }) {
  const record = useStore((s) => s.recordAttempt); const [attemptId, setAttemptId] = useState<string | null>(null);
  const attempt = useStore((s) => s.attempts.find((a) => a.id === attemptId));
  useEffect(() => { setAttemptId(null); }, [q.id]);
  if (!attempt) return (
    <QuestionForm key={q.id} q={q} onSubmit={(ans) => {
      const ok = ans.chosen !== '—' && isCorrect(q, ans.chosen); const alt = q.alternatives?.find((a) => a.letter === ans.chosen);
      const a = record({ qid: q.id, chosen: ans.chosen, correct: ok, confidence: ans.confidence, ts: Date.now(), mode, isTwin, twinLevel, timeSec: ans.timeSec, justification: ans.justification, errorType: ok ? undefined : alt?.errorType }, q);
      setAttemptId(a.id); onAnswered?.(a);
    }} />
  );
  return <div className="animate-fadeUp"><AnsweredQuestion q={q} chosen={attempt.chosen} hideKey={!attempt.correct && !attempt.corrected && !!q.cpe} /><Correction key={attempt.id} q={q} attempt={attempt} onNext={onDone ? () => onDone(attempt) : undefined} nextLabel={doneLabel} /></div>;
}

/** Questão já respondida, só leitura. `hideKey` mantém o gabarito oculto durante o CPE. */
export function AnsweredQuestion({ q, chosen, hideKey }: { q: Question; chosen: string; hideKey?: boolean }) {
  return (
    <div>
      <QuestionHead q={q} />
      <ul className="mt-5 space-y-2">{q.alternatives!.map((a) => { const right = a.correct && !hideKey; const mine = a.letter === chosen; return (
        <li key={a.letter} className={cx('flex items-start gap-3 rounded-lg border px-3 py-2.5 text-[15px]', right ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : mine && !a.correct ? 'border-red-300 bg-red-50 dark:border-red-500/50 dark:bg-red-500/10' : mine ? 'border-emerald-400' : 'border-ink-200 text-ink-500 dark:border-ink-800')}>
          <span className="w-5 shrink-0 text-sm font-semibold">{a.letter}</span><span className="flex-1 leading-relaxed">{a.text}</span>
          {right && <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-label="Correta" />}{mine && !a.correct && <XCircle size={18} className="mt-0.5 shrink-0 text-red-500" aria-label="Sua resposta" />}
        </li>); })}</ul>
    </div>
  );
}
