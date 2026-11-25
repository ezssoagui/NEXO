import { useEffect, useState } from 'react';
import type { ExplainResult, Explanation } from '../types';
import type { ExplainTask } from '../data/explainTasks';
import { useStore } from '../store/useStore';
import { AI } from '../services/ai';
import { CRITERION_LABEL, LEVEL_LABEL, RESULT_LABEL } from '../engine/explain';
import { Badge, Choice, DemoTag, cx } from './ui';

const TONE: Record<ExplainResult, 'green' | 'amber' | 'red' | 'slate'> = { demonstrada: 'green', parcial: 'amber', nao_demonstrada: 'red', inconclusiva: 'slate' };

/** EXPLICAÇÃO ATIVA: resposta escrita, sem IA nem referência antes do envio. */
export default function ExplainPlayer({ task, context = 'livre', onDone, doneLabel = 'Continuar' }: { task: ExplainTask; context?: Explanation['context']; onDone?: (r: ExplainResult) => void; doneLabel?: string }) {
  const record = useStore((s) => s.recordExplanation); const selfCheck = useStore((s) => s.selfCheckExplanation); const setOpen = useStore((s) => s.setOpenQuestion);
  const past = useStore((s) => s.explanations);
  // Depois de ver a referência, nova tentativa no mesmo dia é assistida: não comprova.
  const [assisted, setAssisted] = useState(() => past.some((x) => x.taskId === task.id && Date.now() - x.ts < 86400000));
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [rec, setRec] = useState<(Explanation & { missing: string[]; found: string[]; fallback?: string }) | null>(null);
  useEffect(() => { if (rec) { setOpen(null); return; } setOpen(`x:${task.id}`); return () => setOpen(null); }, [rec, task.id, setOpen]);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  async function submit() {
    setBusy(true); const r = await AI.explain(task, text, { assisted });
    const saved = record({ taskId: task.id, skillId: task.skillId, level: task.level, text, ts: Date.now(), result: r.data.result, criteria: r.data.criteria, assisted: assisted || undefined, engine: r.engine, demo: r.demo, context });
    setRec({ ...saved, missing: r.data.missing, found: r.data.found, fallback: r.fallbackReason }); setBusy(false);
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2"><Badge tone="brand">Explicação ativa</Badge><Badge>{LEVEL_LABEL[task.level]}</Badge>{assisted && !rec && <Badge tone="amber">Nova tentativa: não conta como comprovação</Badge>}</div>
      <h2 className="text-lg font-semibold leading-snug">{task.prompt}</h2>
      {!rec ? (
        <>
          <label className="sr-only" htmlFor={`ex-${task.id}`}>Sua explicação</label>
          <textarea id={`ex-${task.id}`} className="input mt-4 text-[15px] leading-relaxed" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Explique com suas palavras, em frases completas." />
          <div className="mt-3 flex items-center gap-3"><button className="btn-primary" disabled={busy || words < 5} onClick={submit}>{busy ? 'Avaliando…' : 'Enviar explicação'}</button><span className="muted text-xs">{words} palavras</span></div>
        </>
      ) : (
        <div className="mt-4 animate-fadeUp space-y-5">
          <blockquote className="border-l-2 border-ink-200 pl-4 text-sm leading-relaxed text-ink-600 dark:border-ink-700 dark:text-ink-300">{rec.text}</blockquote>
          <div className="flex flex-wrap items-center gap-2"><Badge tone={TONE[rec.result]}>{RESULT_LABEL[rec.result]}</Badge>{rec.demo && <DemoTag title={rec.fallback}>Avaliação simulada por regras</DemoTag>}{rec.assisted && <Badge tone="amber">Assistida</Badge>}</div>
          <ul className="space-y-2">{rec.criteria.map((c) => <li key={c.id} className="flex gap-3 text-sm"><span className="mt-1.5 flex shrink-0 gap-1" aria-label={`${c.score} de 2`}>{[1, 2].map((k) => <span key={k} className={cx('h-2 w-2 rounded-full', c.score >= k ? 'bg-brand-500' : 'bg-ink-200 dark:bg-ink-700')} />)}</span><span><strong className="font-medium">{CRITERION_LABEL[c.id]}.</strong> <span className="muted">{c.note}</span></span></li>)}</ul>
          {rec.missing.length > 0 && <p className="text-sm"><strong className="font-medium">Para completar:</strong> <span className="muted">{rec.missing.join('; ').toLowerCase()}.</span></p>}
          <div><div className="muted mb-1 text-xs">Uma explicação possível</div><p className="text-sm leading-relaxed">{task.reference}</p></div>
          {rec.demo && <div><p className="text-sm font-medium">Comparando com a referência, sua explicação estava:</p><div className="mt-2 flex flex-wrap gap-2" role="radiogroup">{([['completa', 'Completa'], ['parcial', 'Incompleta'], ['equivocada', 'Equivocada']] as const).map(([k, l]) => <Choice key={k} active={past.find((x) => x.id === rec.id)?.selfCheck === k} onClick={() => selfCheck(rec.id, k)}>{l}</Choice>)}</div><p className="muted mt-2 text-xs">Sua avaliação fica registrada, mas não substitui a comprovação autônoma.</p></div>}
          <div className="flex gap-2">{onDone && <button className="btn-primary" onClick={() => onDone(rec.result)}>{doneLabel}</button>}<button className="btn-ghost" onClick={() => { setRec(null); setText(''); setAssisted(true); }}>Reescrever</button></div>
        </div>
      )}
    </div>
  );
}
