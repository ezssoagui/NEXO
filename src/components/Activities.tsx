import { useState } from 'react';
import { Check, X } from 'lucide-react';
import type { CardRating, Flashcard } from '../types';
import type { Comparison } from '../data/comparisons';
import { lessonById } from '../data/lessons';
import { skillById } from '../data/skills';
import { CONCEPTS } from '../engine/concepts';
import { preview, RATING_LABEL } from '../engine/fsrs';
import { useStore } from '../store/useStore';
import { Badge, Choice, Rich, cx } from './ui';

/** Texto de referência de uma habilidade (aula, conceito ou aviso honesto de ausência). */
export function conceptText(skillId: string): string | null {
  const l = skillById(skillId)?.lessonId ? lessonById(skillById(skillId)!.lessonId!) : undefined;
  return l ? `${l.micro}\n\n${l.explanation.slice(0, 2).join('\n\n')}` : CONCEPTS[skillId]?.summary.intermediario ?? null;
}

/** RECUPERAÇÃO ATIVA: escrever o que lembra antes de reler. */
export function RecallCard({ skillId, onDone, doneLabel = 'Continuar' }: { skillId: string; onDone?: () => void; doneLabel?: string }) {
  const [text, setText] = useState(''); const [show, setShow] = useState(false); const ref = conceptText(skillId);
  return (
    <div>
      <Badge tone="brand">Recordar sem consultar</Badge>
      <h2 className="mt-3 text-lg font-semibold">{skillById(skillId)?.name}</h2>
      <p className="muted mt-1 text-sm">Escreva o que lembra: ideias, relações, um exemplo. Depois compare e complete.</p>
      <textarea aria-label="O que você lembra" className="input mt-4" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
      {show && (ref ? <div className="mt-4 rounded-lg border border-ink-200 p-4 text-sm dark:border-ink-700"><Rich text={ref} /></div> : <p className="muted mt-4 text-sm">Ainda não há texto de referência cadastrado para esta habilidade.</p>)}
      <div className="mt-4 flex gap-2">{!show && <button className="btn-ghost" onClick={() => setShow(true)}>Comparar</button>}{onDone && <button className="btn-primary" onClick={onDone}>{doneLabel}</button>}</div>
    </div>
  );
}

/** COMPARAÇÃO ENTRE CONCEITOS: classificar situações e depois ver o quadro. */
export function CompareCard({ c, onDone, doneLabel = 'Continuar' }: { c: Comparison; onDone?: () => void; doneLabel?: string }) {
  const [ans, setAns] = useState<Record<number, 'a' | 'b' | 'ambos'>>({}); const all = Object.keys(ans).length === c.items.length;
  return (
    <div>
      <Badge tone="brand">Comparar conceitos</Badge>
      <h2 className="mt-3 text-lg font-semibold">{c.a} × {c.b}</h2><p className="muted mt-1 text-sm">{c.intro}</p>
      <ol className="mt-5 space-y-5">{c.items.map((it, i) => { const r = ans[i]; const ok = r === it.answer; return (
        <li key={i}><p className="text-sm font-medium">{it.text}</p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">{(['a', 'b', 'ambos'] as const).map((k) => <Choice key={k} disabled={!!r} active={r === k} onClick={() => setAns((p) => ({ ...p, [i]: k }))}>{k === 'a' ? c.a : k === 'b' ? c.b : 'Ambos'}</Choice>)}</div>
          {r && <p className={cx('mt-2 flex items-start gap-1.5 text-sm', ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300')}>{ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <X size={15} className="mt-0.5 shrink-0" />}{it.why}</p>}
        </li>); })}</ol>
      {all && <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[420px] text-sm"><thead><tr className="muted border-b border-ink-200 text-left text-xs dark:border-ink-800"><th className="py-2 font-medium"></th><th className="py-2 font-medium">{c.a}</th><th className="py-2 font-medium">{c.b}</th></tr></thead><tbody>{c.rows.map((r) => <tr key={r.label} className="border-b border-ink-100 dark:border-ink-800"><td className="muted py-2 pr-4">{r.label}</td><td className="py-2 pr-4">{r.a}</td><td className="py-2">{r.b}</td></tr>)}</tbody></table></div>}
      {onDone && <button className="btn-primary mt-6" disabled={!all} onClick={onDone}>{doneLabel}</button>}
    </div>
  );
}

/** Flashcards com FSRS experimental. */
export function CardDeck({ cards, onDone }: { cards: Flashcard[]; onDone?: () => void }) {
  const rate = useStore((s) => s.rateCard); const states = useStore((s) => s.cardStates); const target = useStore((s) => s.params.retencaoAlvoFsrs);
  const [queue, setQueue] = useState(cards); const [flip, setFlip] = useState(false); const [done, setDone] = useState(0);
  const c = queue[0];
  if (!c) return <div className="text-center"><p className="font-medium">{done ? `${done} cartão(ões) revisado(s).` : 'Nenhum cartão para revisar agora.'}</p>{onDone && <button className="btn-primary mt-4" onClick={onDone}>Continuar</button>}</div>;
  const go = (g: CardRating) => { rate(c.id, g); setFlip(false); setDone(done + 1); setQueue(g === 1 && queue.filter((x) => x.id === c.id).length < 2 ? [...queue.slice(1), c] : queue.slice(1)); };
  return (
    <div className="text-center">
      <div className="muted text-xs">{queue.length} restante(s) · {c.topic} · {{ curricular: 'curricular', personalizado: 'personalizado', conceitual: 'conceitual' }[c.kind]}</div>
      <p className="mx-auto mt-8 max-w-lg text-lg font-medium">{c.front}</p>
      {flip ? <><hr className="mx-auto my-6 w-16 border-ink-200 dark:border-ink-700" /><p className="mx-auto max-w-lg">{c.back}</p>
        <div className="mx-auto mt-8 grid max-w-md grid-cols-4 gap-2">{preview(states[c.id], Date.now(), target).map(({ g, label }) => <button key={g} className="btn-ghost flex-col !gap-0 !px-1" onClick={() => go(g)}><span>{RATING_LABEL[g]}</span><span className="muted text-[11px] font-normal">{label}</span></button>)}</div></>
        : <button className="btn-primary mt-8" onClick={() => setFlip(true)}>Mostrar resposta</button>}
    </div>
  );
}

/** Microaula, aula, exemplo resolvido ou explicação de conceito dentro da sessão. */
export function TeachCard({ kind, skillId, lessonId, onDone }: { kind: 'aula' | 'microaula' | 'exemplo' | 'conceito'; skillId: string; lessonId?: string; onDone: () => void }) {
  const l = lessonId ? lessonById(lessonId) : undefined; const [ans, setAns] = useState<number | null>(null);
  const check = l?.checks[0]; const needCheck = !!check && kind !== 'exemplo';
  if (!l) { const m = CONCEPTS[skillId]; return <div><Badge tone="brand">Explicação</Badge><h2 className="mt-3 text-lg font-semibold">{skillById(skillId)?.name}</h2>{m ? <div className="mt-3"><Rich text={`${m.summary.basico}\n\n${m.summary.intermediario}`} /></div> : <p className="muted mt-3 text-sm">A aula desta habilidade ainda não foi cadastrada. Siga para a prática: a resolução de cada questão traz a explicação.</p>}<button className="btn-primary mt-5" onClick={onDone}>Continuar</button></div>; }
  return (
    <div>
      <Badge tone="brand">{{ aula: 'Aula direcionada', microaula: 'Microaula', exemplo: 'Exemplo resolvido', conceito: 'Explicação' }[kind]}</Badge>
      <h2 className="mt-3 text-lg font-semibold">{l.title}</h2>
      {kind === 'exemplo' ? <div className="mt-3 text-sm"><p className="font-medium">{l.solved.problem}</p><ol className="mt-3 list-decimal space-y-1.5 pl-5">{l.solved.steps.map((s) => <li key={s}>{s}</li>)}</ol></div>
        : <div className="mt-3 space-y-3 text-[15px] leading-relaxed"><Rich text={l.micro} />{kind === 'aula' && l.explanation.map((p) => <p key={p}>{p}</p>)}{l.visual.length > 0 && <dl className="grid gap-x-6 gap-y-2 border-y border-ink-100 py-3 text-sm dark:border-ink-800 sm:grid-cols-3">{l.visual.map((v) => <div key={v.label}><dt className="muted text-xs">{v.label}</dt><dd className="font-medium">{v.value}</dd></div>)}</dl>}{kind === 'aula' && <p className="text-sm"><strong className="font-medium">Erro frequente:</strong> {l.mistakes[0]}</p>}</div>}
      {needCheck && <div className="mt-5"><p className="text-sm font-medium">{check.q}</p><div className="mt-2 flex flex-wrap gap-2">{check.options.map((o, i) => <Choice key={o} disabled={ans !== null} active={ans === i} onClick={() => setAns(i)}>{o}</Choice>)}</div>{ans !== null && <p className={cx('mt-2 text-sm', ans === check.answer ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300')}>{check.feedback}</p>}</div>}
      <button className="btn-primary mt-6" onClick={onDone}>Continuar</button>
    </div>
  );
}
