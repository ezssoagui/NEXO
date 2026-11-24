import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import type { Attempt, CpeStepId, ErrorCategory, Question } from '../types';
import { useStore } from '../store/useStore';
import { ERROR_CATEGORIES, skillById } from '../data/skills';
import { usesCpe, usesErrorForm } from '../engine/correctionRules';
import { lessonById } from '../data/lessons';
import { tasksForSkill } from '../data/explainTasks';
import { cpeMastered } from '../engine/difficulties';
import { checkElimination, checkProof, readCommand, splitSentences, ELIMINATION_TYPES } from '../engine/cpe';
import { Choice, Rich, cx } from './ui';

/**
 * CORREÇÃO (a IA só é acessível daqui em diante).
 *  - acerto: confirmação breve;
 *  - erro em Linguagens/Humanas, média ou difícil: método CPE; fácil: resolução direta;
 *  - erro em Matemática/Natureza: formulário opcional de causa e resolução.
 */
export default function Correction({ q, attempt, onNext, nextLabel = 'Continuar' }: { q: Question; attempt: Attempt; onNext?: () => void; nextLabel?: string }) {
  const mark = useStore((s) => s.markCorrected);
  const cpe = usesCpe(q, attempt.correct) && attempt.chosen !== '—'; const form = usesErrorForm(q, attempt.correct);
  const [cpeDone, setCpeDone] = useState(!cpe || !!attempt.corrected); const [formDone, setFormDone] = useState(!form || !!attempt.selfCategory || !!attempt.corrected);
  const finishCpe = () => { setCpeDone(true); mark(attempt.id); }; const finishForm = () => { setFormDone(true); mark(attempt.id); };
  const ready = cpeDone && formDone;
  return (
    <div className="mt-6 border-t border-ink-200 pt-6 dark:border-ink-800">
      <p className={cx('flex items-center gap-2 text-sm font-semibold', attempt.correct ? 'text-emerald-700 dark:text-emerald-300' : 'text-ink-900 dark:text-white')} role="status">{attempt.correct ? <><Check size={16} /> Resposta correta</> : <><X size={16} className="text-red-500" /> {attempt.chosen === '—' ? 'Não resolvida' : `Você marcou ${attempt.chosen}`}</>}</p>
      {attempt.correct && attempt.confidence === 'chute' && <p className="muted mt-1 text-xs">Acerto por chute: registrado, mas não conta como demonstração.</p>}
      {cpe && !cpeDone && <CpeFlow q={q} attempt={attempt} onDone={finishCpe} />}
      {!cpe && form && !formDone && <ErrorForm attemptId={attempt.id} onDone={finishForm} />}
      {ready && <Resolution q={q} attempt={attempt} open={!attempt.correct} />}
      {ready && onNext && <button className="btn-primary mt-6" onClick={onNext}>{nextLabel} <ArrowRight size={16} /></button>}
    </div>
  );
}

/** Formulário opcional (Matemática e Natureza). A autoclassificação é uma evidência, não um veredito. */
export function ErrorForm({ attemptId, onDone }: { attemptId: string; onDone: () => void }) {
  const classify = useStore((s) => s.classifyError); const pick = (c: ErrorCategory) => { classify(attemptId, c); onDone(); };
  return (
    <div className="mt-4" role="group" aria-label="Por que você errou esta questão?">
      <p className="text-sm font-medium">Por que você errou esta questão? <span className="muted font-normal">(opcional)</span></p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{ERROR_CATEGORIES.map((c) => <Choice key={c.id} role="button" onClick={() => pick(c.id)}><span className="font-medium">{c.label}</span>{c.hint && <span className="muted block text-xs">{c.hint}</span>}</Choice>)}</div>
      <button className="btn-quiet mt-2 text-xs" onClick={onDone}>Pular</button>
    </div>
  );
}

const STEP: Record<CpeStepId, { title: string; ask: string }> = {
  comando: { title: 'Comando', ask: 'O que exatamente a questão pede? Responda com suas palavras.' },
  prova: { title: 'Prova', ask: 'Qual frase do texto sustenta a resposta? Clique nela.' },
  eliminacao: { title: 'Eliminação', ask: 'Por que a alternativa que você marcou não atende à questão?' },
};
/** CPE: Comando → Prova → Eliminação. Etapas já demonstradas podem ser ignoradas. */
export function CpeFlow({ q, attempt, onDone }: { q: Question; attempt: Attempt; onDone: () => void }) {
  const attempts = useStore((s) => s.attempts); const save = useStore((s) => s.recordCpe);
  const mastered = cpeMastered(attempts.filter((a) => a.id !== attempt.id));
  const order: CpeStepId[] = ['comando', 'prova', 'eliminacao'];
  const [i, setI] = useState(0); const step = order[i];
  const [text, setText] = useState(''); const [fb, setFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const cpe = q.cpe!; const ex = cpe.excesso.find((e) => e.letter === attempt.chosen);
  const set = (r: 'demonstrada' | 'dificuldade' | 'pulada') => save(attempt.id, { [step]: r });
  const next = () => { setFb(null); setText(''); if (i + 1 >= order.length) onDone(); else setI(i + 1); };
  const skip = () => { if (!fb) set('pulada'); next(); };
  const answer = (ok: boolean, msg: string) => { set(ok ? 'demonstrada' : 'dificuldade'); setFb({ ok, msg }); };
  return (
    <div className="mt-4">
      <ol className="flex gap-4 text-xs" aria-label="Etapas do CPE">{order.map((s, k) => <li key={s} aria-current={k === i ? 'step' : undefined} className={cx('border-b-2 pb-1', k === i ? 'border-brand-600 font-semibold text-ink-900 dark:text-white' : k < i ? 'border-emerald-500 text-ink-500' : 'border-transparent text-ink-400')}>{STEP[s].title}</li>)}</ol>
      <p className="mt-4 text-sm font-medium">{STEP[step].ask}</p>
      {mastered.includes(step) && !fb && <p className="muted mt-1 text-xs">Você já demonstrou esta etapa em correções recentes. <button className="link" onClick={skip}>Ignorar etapa</button></p>}
      {step === 'comando' && !fb && <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); const ok = readCommand(q, text); answer(ok, ok ? `Boa leitura. ${cpe.comando}` : `O comando pede: ${cpe.comando.charAt(0).toLowerCase()}${cpe.comando.slice(1)}`); }}><label className="sr-only" htmlFor="cpe-c">Comando</label><input id="cpe-c" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="A questão pede…" /><button className="btn-primary shrink-0" disabled={text.trim().length < 6}>Verificar</button></form>}
      {step === 'prova' && !fb && <div className="mt-3 space-y-1.5">{splitSentences(q.context ?? q.statement).map((s) => <button key={s} className="block w-full rounded-lg border border-ink-200 px-3 py-2 text-left text-sm leading-relaxed hover:border-brand-400 dark:border-ink-700" onClick={() => { const ok = checkProof(q, s); answer(ok, ok ? 'Isso: essa é a evidência decisiva.' : `A evidência decisiva é: “${cpe.prova.replace(/^"|"$/g, '')}”`); }}>{s}</button>)}</div>}
      {step === 'eliminacao' && !fb && <div className="mt-3"><p className="muted mb-2 text-sm">{attempt.chosen}) {q.alternatives!.find((a) => a.letter === attempt.chosen)?.text}</p><div className="grid gap-2 sm:grid-cols-2">{ELIMINATION_TYPES.map((t) => <Choice key={t.id} role="button" onClick={() => { const ok = checkElimination(q, attempt.chosen, t.id); answer(ok, ok ? `Exato. ${ex?.motivo ?? ''}` : `${ex ? `${ex.tipo}: ${ex.motivo}` : q.alternatives!.find((a) => a.letter === attempt.chosen)?.analysis}`); }}><span className="font-medium">{t.id}</span><span className="muted block text-xs">{t.hint}</span></Choice>)}</div></div>}
      {fb && <div className={cx('mt-3 rounded-lg border px-3 py-2.5 text-sm', fb.ok ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10' : 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10')}><Rich text={fb.msg} /></div>}
      <div className="mt-4 flex gap-2">{fb ? <button className="btn-primary btn-sm" onClick={next}>{i + 1 >= order.length ? 'Ver resolução' : 'Próxima etapa'}</button> : <button className="btn-quiet text-xs" onClick={skip}>Pular etapa</button>}{!fb && <button className="btn-quiet text-xs" onClick={onDone}>Ir para a resolução</button>}</div>
    </div>
  );
}

/** Resolução completa, análise das alternativas e caminhos de aprendizagem. */
export function Resolution({ q, attempt, open }: { q: Question; attempt: Attempt; open: boolean }) {
  const add = useStore((s) => s.addCard); const notify = useStore((s) => s.notify); const [show, setShow] = useState(open); const [alts, setAlts] = useState(false);
  const right = q.alternatives!.find((a) => a.correct)!; const mine = q.alternatives!.find((a) => a.letter === attempt.chosen);
  const lesson = q.lessonId ? lessonById(q.lessonId) : undefined;
  if (!show) return <button className="link mt-3 text-sm" onClick={() => setShow(true)}>Ver resolução</button>;
  return (
    <div className="mt-4 space-y-4 text-sm leading-relaxed">
      {mine && !mine.correct && <p><strong className="font-semibold text-ink-900 dark:text-white">Sua alternativa ({mine.letter}).</strong> {mine.analysis}</p>}
      <p><strong className="font-semibold text-ink-900 dark:text-white">Resposta: {right.letter}.</strong> {q.explanation}</p>
      <p className="muted"><strong className="font-medium">Caminho rápido:</strong> {q.fastMethod}</p>
      {alts ? <ul className="space-y-1.5">{q.alternatives!.map((a) => <li key={a.letter}><strong>{a.letter}.</strong> {a.analysis}</li>)}</ul> : <button className="link text-xs" onClick={() => setAlts(true)}>Analisar todas as alternativas</button>}
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-ink-100 pt-4 text-xs dark:border-ink-800">
        {lesson && <Link className="link" to={`/aulas/${lesson.id}`}>Aula: {lesson.title}</Link>}
        {tasksForSkill(q.skillId).length > 0 && <Link className="link" to={`/explicar/${q.skillId}`}>Explicar este conceito</Link>}
        <Link className="link" to={`/gemea/${q.skillId}?de=${q.id}`}>Questão gêmea</Link>
        <Link className="link" to={`/professor?q=${q.id}&a=${attempt.id}`}>Perguntar ao professor de IA</Link>
        <button className="link" onClick={() => { add({ id: `q-${q.id}`, subject: q.subject, topic: q.topic, skillId: q.skillId, front: q.flashcard.front, back: q.flashcard.back, kind: 'personalizado' }); notify('Flashcard adicionado às suas revisões.'); }}>Criar flashcard</button>
        <Link className="link" to={`/conteudos/habilidade/${q.skillId}`}>{skillById(q.skillId)?.name}</Link>
      </div>
    </div>
  );
}
