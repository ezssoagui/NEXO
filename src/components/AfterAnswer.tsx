import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Zap, Plus, Target, Bot, Sparkles, Flag, ArrowRight, Clock, PauseCircle, StopCircle, HelpCircle, ShieldCheck, Lightbulb, BookOpen, ListOrdered, GitBranch, Repeat, Scale } from 'lucide-react';
import type { Attempt, ErrorCause, InterventionCode, Question, XPEvent } from '../types';
import { useStore } from '../store/useStore';
import { CAUSE_LABELS, ERROR_LABELS, INTERVENTION_LABELS, skillById } from '../data/skills';
import { lessonById, LESSONS } from '../data/lessons';
import { startCpe, answerCpe, revealCpe, type CpeState } from '../engine/cpe';
import { startSocratic, answerSocratic, revealSocratic, type SocraticState } from '../engine/socratic';
import { conceptsFor, readJustification } from '../engine/concepts';
import { chooseLevel, TWIN_LEVEL_LABEL, type TwinLevel } from '../engine/twins';
import { finishTeaching, interrupt, postpone, reclassifyCycle } from '../engine/cycle';
import { redecide, HINT_LIMIT, type PedagogicalDecision } from '../engine/learning';
import { MASTERY_LABEL } from '../engine/mastery';
import { AI } from '../services/ai';
import MiniChat, { type ChatMsg } from './MiniChat';
import { Badge, Rich, cx } from './ui';
import type { DiagnosisInput } from '../engine/diagnosis';

const ENGINE = 'NEXO Learning Engine (regras curadas e auditáveis) — não é um modelo de IA';
type Outcome = 'compreendeu' | 'interrompeu' | 'adiou' | 'revelou_resposta' | 'reclassificou';
const confLabel = (c: number) => (c >= 0.75 ? 'alta' : c >= 0.5 ? 'média' : 'baixa');
const SOURCE: Record<string, string> = { resposta: 'Resposta', alternativa: 'Alternativa escolhida', justificativa: 'Justificativa', confianca: 'Confiança', historico: 'Histórico', tempo: 'Tempo', pre_requisito: 'Pré-requisito', revisao: 'Revisões anteriores', aluno: 'Relato do aluno', ia: 'IA (interpretação)' };

export interface AfterProps {
  q: Question; attempt: Attempt; decision: PedagogicalDecision; response: DiagnosisInput; history: Attempt[]; xp: XPEvent[];
  mode: 'tutoria' | 'pratica' | 'sessao' | 'gemea'; isTwin?: boolean; twinLevel?: number; cycleId?: string;
  onNext?: () => void; onTwin?: (level: TwinLevel) => void; onReport: () => void; onDecision: (d: PedagogicalDecision, extra: Partial<DiagnosisInput>) => void; onRevealed?: () => void;
}

export default function AfterAnswer(p: AfterProps) {
  const { q, attempt, decision: dec, mode } = p;
  const { addCard, notify, cycles, upsertCycle, logIntervention, skillReviews, settings } = useStore();
  const [view, setView] = useState<'intervencao' | 'correcao'>(mode === 'pratica' ? 'correcao' : 'intervencao');
  const [code, setCode] = useState<InterventionCode>(dec.intervention);
  const [cpe, setCpe] = useState(dec.cpe);
  const [taught, setTaught] = useState(dec.intervention === 'nenhuma');
  const [closed, setClosed] = useState<null | 'adiou' | 'interrompeu'>(null);
  const [asked, setAsked] = useState(false);
  useEffect(() => { setCode(dec.intervention); setCpe(dec.cpe); setTaught(dec.intervention === 'nenhuma'); }, [dec]);
  const cycle = cycles.find((c) => c.id === p.cycleId) ?? cycles.filter((c) => c.skillId === q.skillId).sort((a, b) => b.updatedAt - a.updatedAt).find((c) => c.status === 'ativo' || c.status === 'adiado');
  const d = dec.diagnosis;
  const log = (o?: Outcome) => { const e = { ts: Date.now(), qid: q.id, skillId: q.skillId, situation: dec.situation, hypothesis: dec.difficulty, confidence: d.confidence, intervention: INTERVENTION_LABELS[code].label, cause: d.cause, code, outcome: o, engine: ENGINE }; logIntervention(e); if (o) AI.logIntervention(e); };
  useEffect(() => { log(); }, [dec.intervention, dec.difficulty]); // eslint-disable-line
  const done = (o: 'compreendeu' | 'revelou_resposta') => { setTaught(true); p.onRevealed?.(); log(o); if (cycle && cycle.stage !== 'consolidacao') upsertCycle(finishTeaching(cycle, o)); };
  const report = (cause: ErrorCause, justification?: string) => {
    setAsked(true);
    const extra = { studentReport: justification ? undefined : cause, justification: justification ?? p.response.justification };
    const nd = redecide({ q, response: p.response, history: p.history }, extra);
    if (cycle) upsertCycle(reclassifyCycle(cycle, nd.situation)); log('reclassificou'); p.onDecision(nd, extra);
    // Regras locais inconclusivas + IA real conectada: a IA interpreta a justificativa (como evidência, não como decisão final).
    if (justification && nd.diagnosis.cause === 'indeterminada') AI.interpretJustification({ statement: q.statement, chosen: attempt.chosen, correct: q.alternatives?.find((a) => a.correct)?.letter, justification }).then((sug) => { if (sug) { const nd2 = redecide({ q, response: p.response, history: p.history }, { ...extra, aiSuggestion: sug }); p.onDecision(nd2, { ...extra, aiSuggestion: sug }); } });
  };
  const level = chooseLevel(dec.situation, cycle?.twinAttempts);
  const correct = attempt.correct; const fragile = correct && dec.situation === 'B';
  const twinOk = p.isTwin && correct && attempt.confidence !== 'chute';
  const reviewDays = skillReviews[q.skillId]?.interval;
  const ind = dec.mastery.indicatorsAfter;

  return (
    <div className="card animate-fadeUp space-y-4 !p-5 sm:!p-6">
      <div className={cx('flex flex-wrap items-center gap-3 rounded-xl p-3', correct && !fragile ? 'bg-mint-50 dark:bg-mint-500/10' : fragile ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-red-50 dark:bg-red-500/10')}>
        {correct ? <CheckCircle2 className="text-mint-600" /> : <XCircle className="text-red-500" />}
        <div className="min-w-0 flex-1">
          <div className="font-bold text-navy-900 dark:text-white">{correct ? (fragile ? dec.difficulty : 'Correto') : dec.difficulty}</div>
          <div className="text-xs text-slate-600 dark:text-slate-400">{p.xp.filter((e) => e.amount).map((e) => `+${e.amount} XP (${e.reason})`).join(' · ') || 'sem XP nesta etapa'}</div>
        </div>
        <div className="text-right text-xs"><div className="muted">Radar de domínio</div><div className="font-semibold">{MASTERY_LABEL[dec.mastery.before]} → {MASTERY_LABEL[dec.mastery.after]}</div><div className="muted">{ind.secure} seguro(s) · {ind.novelCorrect} inédita(s) · {ind.wrong} erro(s)</div></div>
      </div>
      {p.isTwin && <div className={cx('flex items-start gap-2 rounded-xl p-3 text-sm', twinOk ? 'bg-mint-50 text-mint-900 dark:bg-mint-500/10 dark:text-mint-100' : 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100')}>
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        {twinOk ? <span><strong>Aprendizado comprovado em questão inédita</strong>{p.twinLevel ? ` (${TWIN_LEVEL_LABEL[p.twinLevel as TwinLevel]})` : ''}. A habilidade volta para revisão{reviewDays ? ` em ${reviewDays} dia(s)` : ''}.</span>
          : <span>A comprovação ainda não foi atingida. Isso é informação útil, não fracasso: vamos ver o que faltou.</span>}
      </div>}

      {mode !== 'pratica' && (
        <div role="tablist" className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs dark:bg-navy-950">
          {(['intervencao', 'correcao'] as const).map((v) => <button key={v} role="tab" aria-selected={view === v} onClick={() => { setView(v); if (v === 'correcao') p.onRevealed?.(); }} className={cx('flex-1 rounded-md px-3 py-1.5 font-semibold', view === v ? 'bg-white shadow-sm dark:bg-navy-700' : 'text-slate-500')}>{v === 'intervencao' ? (code === 'nenhuma' ? 'Resumo' : 'Intervenção') : 'Correção completa'}</button>)}
        </div>
      )}

      {view === 'correcao' ? <FullCorrection q={q} attempt={attempt} reasons={[]} onAddCard={() => { addCard({ id: `qc-${q.id}`, subject: q.subject, topic: q.topic, skillId: q.skillId, front: q.flashcard.front, back: q.flashcard.back, origin: 'questao' }); notify('Flashcard adicionado ao seu baralho.'); }} /> : closed ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-navy-950">{closed === 'adiou' ? 'Intervenção adiada. Ela aparece em “Ciclos de domínio” no seu painel quando quiser retomar.' : 'Tutoria interrompida. Sem problema: a habilidade foi agendada para revisão e você pode voltar quando quiser.'}</div>
      ) : (
        <>
          <DecisionPanel dec={dec} code={code} />
          {d.needsJustification && !correct && !asked ? <JustifyPanel onSubmit={(t) => report('indeterminada', t)} onPick={(c) => report(c)} onSkip={() => { setAsked(true); setCode('A'); log(); }} provisional={d.provisional} /> : (
            <>
              {code === 'nenhuma' && <SituationA q={q} advanced={dec.mastery.after === 'consistente'} />}
              {code === 'E' && correct && <SituationB q={q} reason={d.evidence.find((e) => e.source === 'confianca' || e.source === 'justificativa')?.text ?? ''} verify={dec.review.needed} onDone={() => done('compreendeu')} />}
              {code === 'B' && cpe && !correct && <CpePanel q={q} attempt={attempt} onDone={done} />}
              {code === 'B' && (!cpe || correct) && <SocraticPanel q={q} attempt={attempt} onDone={done} />}
              {code === 'C' && <MicroLesson q={q} onDone={done} />}
              {code === 'D' && <StructuredLesson q={q} onDone={done} />}
              {code === 'E' && !correct && <StepPanel q={q} attempt={attempt} cause={d.cause} onDone={done} />}
              {code === 'F' && <ReconstructPanel q={q} attempt={attempt} cause={d.cause} onDone={done} />}
              {code === 'A' && <ProgressiveHints q={q} attempt={attempt} limit={HINT_LIMIT[settings.autonomy] + (settings.autonomy === 'mais_apoio' ? 0 : 0)} onDone={done} />}
              {code === 'G' && <PrereqPanel q={q} prerequisite={d.prerequisite} onConfirmed={() => done('compreendeu')} onRefuted={() => { setCode('B'); setCpe(false); log(); }} />}
            </>
          )}

          {!taught && code !== 'nenhuma' && dec.options.length > 0 && !(d.needsJustification && !correct && !asked) && (
            <div className="flex flex-wrap items-center gap-2 text-xs"><span className="muted">Prefere outra abordagem?</span>{dec.options.filter((o) => o !== code).map((o) => <button key={o} className="btn-ghost btn-sm" onClick={() => { setCode(o); setCpe(o === 'B' && dec.cpe); log(); }}>{INTERVENTION_LABELS[o].label}</button>)}</div>
          )}

          {taught && !correct && !p.isTwin && p.onTwin && dec.next.kind === 'praticar' && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-mint-300 bg-mint-50/60 p-4 dark:border-mint-500/30 dark:bg-mint-500/5">
              <Target size={18} className="text-mint-700" />
              <div className="min-w-0 flex-1 text-sm"><div className="font-semibold">Prática direcionada</div><div className="muted text-xs">Uma questão inédita do mesmo conceito · {TWIN_LEVEL_LABEL[level]}</div></div>
              <button className="btn-primary btn-sm" onClick={() => p.onTwin!(level)}>Fazer agora</button>
              <button className="btn-ghost btn-sm" onClick={() => { if (cycle) upsertCycle(postpone(cycle)); notify('Verificação agendada para a sua próxima revisão.'); p.onNext?.(); }}><Clock size={14} /> Depois</button>
            </div>
          )}
          {(taught || correct) && dec.next.kind !== 'praticar' && dec.next.kind !== 'avancar' && dec.next.to && (
            <Link to={dec.next.to} className="flex items-center gap-3 rounded-xl border border-sky-300 bg-sky-50/60 p-4 text-sm dark:border-sky-500/30 dark:bg-sky-500/5"><GitBranch size={18} className="text-sky-700" /><div className="flex-1"><div className="font-semibold">{dec.next.label}</div><div className="muted text-xs">{dec.next.reason}</div></div><ArrowRight size={16} /></Link>
          )}
          {p.isTwin && twinOk && p.onTwin && (p.twinLevel ?? 1) < 3 && <button className="btn-ghost btn-sm" onClick={() => p.onTwin!(Math.min(3, (p.twinLevel ?? 1) + 1) as TwinLevel)}><Sparkles size={14} /> Opcional: {TWIN_LEVEL_LABEL[Math.min(3, (p.twinLevel ?? 1) + 1) as TwinLevel].toLowerCase()}</button>}
          {p.isTwin && !correct && taught && p.onTwin && <button className="btn-primary btn-sm" onClick={() => p.onTwin!(level)}><Target size={14} /> Nova verificação · {TWIN_LEVEL_LABEL[level]}</button>}

          {!correct && !taught && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs dark:border-navy-800">
              {(!d.needsJustification || asked) && <><label htmlFor={`rc-${attempt.id}`} className="muted">Não foi isso?</label>
                <select id={`rc-${attempt.id}`} className="input !w-auto !py-1 text-xs" value="" onChange={(e) => e.target.value && report(e.target.value as ErrorCause)}>
                  <option value="">Corrigir a causa…</option>
                  {(['conceitual', 'interpretacao', 'confusao_alternativas', 'calculo', 'formula', 'unidade', 'atencao', 'esquecimento', 'lacuna_prerequisito'] as ErrorCause[]).filter((c) => c !== d.cause).map((c) => <option key={c} value={c}>{CAUSE_LABELS[c].label}</option>)}
                </select></>}
              <button className="btn-ghost btn-sm ml-auto" onClick={() => { p.onRevealed?.(); setClosed('adiou'); log('adiou'); if (cycle) upsertCycle(postpone(cycle)); }}><PauseCircle size={14} /> Adiar</button>
              <button className="btn-ghost btn-sm" onClick={() => { p.onRevealed?.(); setClosed('interrompeu'); log('interrompeu'); if (cycle) upsertCycle(interrupt(cycle)); }}><StopCircle size={14} /> Interromper</button>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {p.onNext && (taught || correct || closed) && <button className="btn-dark" onClick={p.onNext}>Continuar <ArrowRight size={16} /></button>}
        <Link className="btn-ghost btn-sm" to={`/tutor?q=${q.id}&a=${attempt.id}`}><Bot size={14} /> Abrir na IA Tutora</Link>
        <button className="muted ml-auto inline-flex items-center gap-1 text-xs hover:underline" onClick={p.onReport}><Flag size={12} /> Denunciar erro</button>
      </div>
    </div>
  );
}

/** Decisão pedagógica auditável: dificuldade, evidências, confiança, intervenção e motivo, próxima atividade e revisão. */
function DecisionPanel({ dec, code }: { dec: PedagogicalDecision; code: InterventionCode }) {
  const d = dec.diagnosis;
  return (
    <details className="rounded-xl border border-slate-200 p-3 text-xs dark:border-navy-700">
      <summary className="cursor-pointer font-semibold"><Scale size={12} className="mr-1 inline" />Decisão pedagógica · {INTERVENTION_LABELS[code].label} · confiança do diagnóstico {confLabel(d.confidence)}</summary>
      <dl className="mt-2 grid gap-2 sm:grid-cols-2">
        <div><dt className="muted">Dificuldade identificada</dt><dd className="font-medium">{dec.difficulty}</dd></div>
        <div><dt className="muted">Intervenção e motivo</dt><dd>{dec.interventionReason}</dd></div>
        <div className="sm:col-span-2"><dt className="muted">Evidências usadas</dt><dd><ul className="mt-1 space-y-0.5">{d.evidence.map((e, i) => <li key={i}><Badge>{SOURCE[e.source]}</Badge> {e.text}</li>)}</ul></dd></div>
        <div><dt className="muted">Próxima atividade</dt><dd>{dec.next.label}: {dec.next.reason}</dd></div>
        <div><dt className="muted">Revisão futura</dt><dd>{dec.review.needed ? `Sim${dec.review.inDays ? `, em ~${dec.review.inDays} dia(s)` : ''}. ` : 'Intervalo adaptativo normal. '}{dec.review.reason}</dd></div>
        {d.alternatives.length > 0 && <div className="sm:col-span-2"><dt className="muted">Outras hipóteses consideradas</dt><dd>{d.alternatives.map((c) => CAUSE_LABELS[c].label).join(', ')}</dd></div>}
      </dl>
    </details>
  );
}

/** Causa indeterminada: pede uma justificativa curta (ou uma escolha rápida) em vez de presumir. */
function JustifyPanel({ onSubmit, onPick, onSkip, provisional }: { onSubmit: (t: string) => void; onPick: (c: ErrorCause) => void; onSkip: () => void; provisional?: ErrorCause }) {
  const [t, setT] = useState('');
  return (
    <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-500/30 dark:bg-sky-500/10">
      <div className="flex items-center gap-2 text-sm font-semibold"><HelpCircle size={16} /> Ainda não dá para saber o que causou o erro. Em uma frase: como você pensou?</div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (t.trim()) onSubmit(t.trim()); }}><label className="sr-only" htmlFor="just-short">Justificativa curta</label><input id="just-short" className="input" placeholder="Ex.: achei que a corrente não mudava…" value={t} onChange={(e) => setT(e.target.value)} /><button className="btn-primary btn-sm" disabled={!t.trim()}>Enviar</button></form>
      <div className="flex flex-wrap gap-2">{([['atencao', 'Li rápido ou me distraí'], ['conceitual', 'Não sabia o conceito'], ['calculo', 'Errei uma conta'], ['confusao_alternativas', 'Fiquei entre duas alternativas'], ['interpretacao', 'Entendi a pergunta de outro jeito'], ['esquecimento', 'Já sabia, mas esqueci']] as [ErrorCause, string][]).map(([c, l]) => <button key={c} className="btn-ghost btn-sm" onClick={() => onPick(c)}>{l}</button>)}</div>
      <button className="muted text-xs underline" onClick={onSkip}>Pular{provisional ? ` (seguir com dicas graduais; hipótese provisória: ${CAUSE_LABELS[provisional].label.toLowerCase()})` : ''}</button>
    </div>
  );
}

/** C — Microaula: explicação curta do conceito + pergunta rápida de verificação (recuperação ativa). */
function MicroLesson({ q, onDone }: { q: Question; onDone: (o: 'compreendeu' | 'revelou_resposta') => void }) {
  const l = LESSONS.find((x) => x.skillIds.includes(q.skillId)); const check = l?.checks[0];
  const [ans, setAns] = useState<number | null>(null);
  const map = conceptsFor(q.skillId, q);
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 font-semibold"><Badge tone="sky">Microaula</Badge> {l?.title ?? skillById(q.skillId)?.name}</div>
      <div className="rounded-xl bg-navy-50 p-4 leading-relaxed dark:bg-navy-800"><Rich text={l ? `${l.micro}

${l.explanation[0]}` : map.summary.intermediario} />{l?.visual && <div className="mt-2 flex flex-wrap gap-2">{l.visual.map((v) => <Badge key={v.label} tone="navy">{v.label}: {v.value}</Badge>)}</div>}</div>
      {check ? <div><div className="font-medium">Verifique: {check.q}</div><div className="mt-2 flex flex-wrap gap-2">{check.options.map((o, i) => <button key={o} disabled={ans !== null} onClick={() => { setAns(i); if (i === check.answer) onDone('compreendeu'); }} className={cx('rounded-xl border px-3 py-2', ans === null ? 'border-slate-300 hover:border-mint-500 dark:border-navy-600' : i === check.answer ? 'border-mint-500 bg-mint-50 dark:bg-mint-500/10' : i === ans ? 'border-red-400 bg-red-50 dark:bg-red-500/10' : 'opacity-50')}>{o}</button>)}</div>{ans !== null && <p className="mt-2 text-xs">{check.feedback}{ans !== check.answer && <button className="ml-2 underline" onClick={() => onDone('revelou_resposta')}>Seguir mesmo assim</button>}</p>}</div>
        : <button className="btn-ghost btn-sm" onClick={() => onDone('compreendeu')}>Entendi</button>}
    </div>
  );
}

/** D — Aula estruturada: fundamentos, exemplo resolvido, aplicação e exercícios (abre a aula completa). */
function StructuredLesson({ q, onDone }: { q: Question; onDone: (o: 'compreendeu' | 'revelou_resposta') => void }) {
  const l = q.lessonId ? lessonById(q.lessonId) : LESSONS.find((x) => x.skillIds.includes(q.skillId));
  if (!l) return <MicroLesson q={q} onDone={onDone} />;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 font-semibold"><Badge tone="violet">Aula estruturada</Badge> {l.title} · {l.minutes} min</div>
      <p>Essa dificuldade já apareceu outras vezes. Uma aula com fundamentos, exemplo resolvido e exercícios tende a ajudar mais do que novas perguntas.</p>
      <ol className="list-decimal space-y-1 pl-5 text-xs"><li>Fundamentos: {l.micro}</li><li>Exemplo resolvido: {l.solved.problem}</li><li>Aplicações: {l.examUse[0]}</li><li>Exercícios: {l.exerciseIds.join(', ')}</li></ol>
      <div className="flex flex-wrap gap-2"><Link className="btn-primary btn-sm" to={`/aulas/${l.id}`} onClick={() => onDone('compreendeu')}><BookOpen size={14} /> Abrir aula</Link><button className="btn-ghost btn-sm" onClick={() => onDone('revelou_resposta')}>Agora não</button></div>
    </div>
  );
}

/** A — Dica progressiva: pistas graduais (limitadas pela autonomia escolhida) com nova tentativa a cada pista. */
function ProgressiveHints({ q, attempt, limit, onDone }: { q: Question; attempt: Attempt; limit: number; onDone: (o: 'compreendeu' | 'revelou_resposta') => void }) {
  const [n, setN] = useState(1); const [ok, setOk] = useState(false);
  const shown = q.hints.slice(0, Math.min(n, 2));
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 font-semibold"><Badge tone="amber">Dica progressiva</Badge> Tente de novo com uma pista</div>
      {shown.map((h, i) => <div key={i} className="flex gap-2 rounded-xl bg-amber-50 p-3 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"><Lightbulb size={16} className="mt-0.5 shrink-0" />{h}</div>)}
      {!ok ? <><RetryInline q={q} attemptId={attempt.id} exclude={[attempt.chosen]} onCorrect={() => { setOk(true); onDone('compreendeu'); }} onWrong={() => undefined} />
        <div className="flex flex-wrap gap-2">{n < Math.min(limit, 2) && <button className="btn-ghost btn-sm" onClick={() => setN(n + 1)}>Outra pista</button>}<button className="btn-ghost btn-sm" onClick={() => onDone('revelou_resposta')}>Quero a explicação direta</button></div></>
        : <p className="flex items-center gap-2 font-semibold text-mint-700 dark:text-mint-400"><CheckCircle2 size={16} /> Isso. Você recuperou o raciocínio com {n} pista(s).</p>}
    </div>
  );
}

/** F — Reconstrução do procedimento, etapa por etapa, destacando a etapa provável do erro. */
function ReconstructPanel({ q, attempt, cause, onDone }: { q: Question; attempt: Attempt; cause?: ErrorCause; onDone: (o: 'compreendeu' | 'revelou_resposta') => void }) {
  const steps = ['Identificar os dados e o que é pedido', 'Escolher a relação (fórmula) adequada', 'Converter unidades e substituir os valores', 'Calcular', 'Conferir a unidade e o sentido do resultado'];
  const flagged = cause === 'formula' ? 1 : cause === 'unidade' ? 2 : cause === 'calculo' ? 3 : 1;
  const [at, setAt] = useState(0); const [ok, setOk] = useState(false);
  const tip = q.alternatives?.find((a) => a.letter === attempt.chosen)?.tutorPrompt ?? q.hints[1];
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 font-semibold"><Badge tone="amber">Reconstrução do procedimento</Badge><ListOrdered size={14} /></div>
      <ol className="space-y-2">{steps.map((s, i) => <li key={s} className={cx('rounded-xl border p-3', i === flagged ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-200 dark:border-navy-700', i > at && 'opacity-50')}>
        <div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy-800 text-[11px] text-white">{i + 1}</span><span className="font-medium">{s}</span>{i === flagged && <Badge tone="amber">etapa provável do erro</Badge>}</div>
        {i === at && i < flagged && <button className="btn-ghost btn-sm mt-2" onClick={() => setAt(i + 1)}>Esta etapa está certa</button>}
        {i === flagged && at >= flagged && !ok && <div className="mt-2 space-y-2"><p className="text-sky-900 dark:text-sky-100"><Bot size={14} className="mr-1 inline" />{tip}</p><p className="font-medium">Refaça a partir daqui: qual alternativa agora?</p><RetryInline q={q} attemptId={attempt.id} exclude={[attempt.chosen]} onCorrect={() => { setOk(true); setAt(steps.length); onDone('compreendeu'); }} onWrong={() => undefined} /></div>}
      </li>)}</ol>
      {ok ? <p className="flex items-center gap-2 font-semibold text-mint-700 dark:text-mint-400"><CheckCircle2 size={16} /> Procedimento reconstruído.</p> : <button className="btn-ghost btn-sm" onClick={() => onDone('revelou_resposta')}>Ver a resolução completa</button>}
    </div>
  );
}

/** G — Revisão de pré-requisitos: verifica o conhecimento anterior antes de presumir a dependência. */
function PrereqPanel({ q, prerequisite, onConfirmed, onRefuted }: { q: Question; prerequisite?: string; onConfirmed: () => void; onRefuted: () => void }) {
  const pre = prerequisite ?? skillById(q.skillId)?.prerequisites?.[0];
  const l = LESSONS.find((x) => pre && x.skillIds.includes(pre)); const check = l?.checks[0];
  const [ans, setAns] = useState<number | null>(null);
  const { addRetry } = useStore();
  if (!pre) return null;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 font-semibold"><Badge tone="red">Revisão de pré-requisito</Badge> {skillById(pre)?.name}</div>
      <p>Esta questão depende de <strong>{skillById(pre)?.name}</strong>. Antes de presumir que esse é o problema, uma verificação rápida:</p>
      {check && <div><div className="font-medium">{check.q}</div><div className="mt-2 flex flex-wrap gap-2">{check.options.map((o, i) => <button key={o} disabled={ans !== null} onClick={() => setAns(i)} className={cx('rounded-xl border px-3 py-2', ans === null ? 'border-slate-300 hover:border-mint-500 dark:border-navy-600' : i === check.answer ? 'border-mint-500 bg-mint-50 dark:bg-mint-500/10' : i === ans ? 'border-red-400 bg-red-50 dark:bg-red-500/10' : 'opacity-50')}>{o}</button>)}</div></div>}
      {ans !== null && check && (ans === check.answer
        ? <div className="rounded-xl bg-mint-50 p-3 dark:bg-mint-500/10">Você domina esse pré-requisito — a dependência não se confirmou. <button className="btn-ghost btn-sm ml-2" onClick={onRefuted}>Investigar a questão original</button></div>
        : <div className="rounded-xl bg-red-50 p-3 dark:bg-red-500/10">{check.feedback} A dependência se confirmou. <Link className="btn-primary btn-sm ml-2" to={`/aulas/${l!.id}`} onClick={onConfirmed}><Repeat size={14} /> Revisar {skillById(pre)?.name}</Link></div>)}
      {!check && <Link className="btn-primary btn-sm" to={l ? `/aulas/${l.id}` : `/questoes?skill=${pre}`} onClick={onConfirmed}>Revisar {skillById(pre)?.name}</Link>}
    </div>
  );
}

function SituationA({ q, advanced }: { q: Question; advanced?: boolean }) {
  if (advanced) return <p className="muted text-sm">Domínio consistente: sem explicação extra.</p>;
  return <p className="text-sm text-slate-700 dark:text-slate-300"><Zap size={14} className="mr-1 inline text-mint-600" />{q.fastMethod}</p>;
}

function SituationB({ q, reason, verify, onDone }: { q: Question; reason: string; verify: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const c = q.alternatives?.find((a) => a.correct);
  return (
    <div className="space-y-3 text-sm">
      <p>{reason} {verify ? 'Uma verificação com questão inédita foi agendada para a sua revisão.' : ''}</p>
      {!open ? <button className="btn-ghost btn-sm" onClick={() => { setOpen(true); onDone(); }}><Lightbulb size={14} /> Explicação breve (opcional)</button>
        : <div className="rounded-xl bg-navy-50 p-3 dark:bg-navy-800"><strong>Por que {c?.letter ?? q.openAnswer?.value}:</strong> {c?.analysis ?? q.explanation}<div className="mt-1"><strong>Caminho mais rápido:</strong> {q.fastMethod}</div></div>}
    </div>
  );
}

function CpePanel({ q, attempt, onDone }: { q: Question; attempt: Attempt; onDone: (o: 'compreendeu' | 'revelou_resposta') => void }) {
  const first = useMemo(() => startCpe(q, attempt.chosen, attempt.justification), [q.id]); // eslint-disable-line
  const [st, setSt] = useState<CpeState>(first.state);
  const [msgs, setMsgs] = useState<ChatMsg[]>([{ role: 'tutor', text: first.text, tag: first.tag }]);
  const finished = st.step === 'fim';
  const send = (t: string) => { const r = answerCpe(q, st, t); setSt(r.state); setMsgs((m) => [...m, { role: 'user', text: t }, { role: 'tutor', text: r.text, tag: r.tag }]); if (r.state.step === 'fim') onDone('compreendeu'); };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold"><Badge tone="violet">C–P–E</Badge> Vamos entender como você leu a questão</div>
      <MiniChat msgs={msgs} onSend={send} disabled={finished} engine={ENGINE} />
      {!finished && <div className="flex flex-wrap gap-2"><button className="btn-ghost btn-sm" onClick={() => send('entendi')}>Entendi</button><button className="btn-ghost btn-sm" onClick={() => { setSt({ ...st, step: 'fim' }); setMsgs((m) => [...m, { role: 'tutor', text: revealCpe(q) }]); onDone('revelou_resposta'); }}>Mostrar explicação</button></div>}
    </div>
  );
}

function SocraticPanel({ q, attempt, onDone }: { q: Question; attempt: Attempt; onDone: (o: 'compreendeu' | 'revelou_resposta') => void }) {
  const [useLesson, setUseLesson] = useState(false);
  const first = useMemo(() => startSocratic(q.skillId, q, readJustification(q.skillId, attempt.justification ?? '').shown), [q.id]); // eslint-disable-line
  const opener = attempt.correct ? '' : (q.alternatives?.find((a) => a.letter === attempt.chosen)?.tutorPrompt ?? q.openAnswer?.wrongMap?.find((w) => String(w.value) === attempt.chosen)?.tutorPrompt);
  const [st, setSt] = useState<SocraticState>(first.state);
  const [msgs, setMsgs] = useState<ChatMsg[]>([...(opener ? [{ role: 'tutor' as const, text: opener }] : []), { role: 'tutor', text: first.text }]);
  const send = (t: string) => { const r = answerSocratic(st, t, q); setSt(r.state); setMsgs((m) => [...m, { role: 'user', text: t }, { role: 'tutor', text: r.text }]); if (r.done) onDone(r.state.explained.length === 0 ? 'compreendeu' : 'compreendeu'); };
  if (useLesson && q.lessonId) return (
    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
      <p>Esta dificuldade já apareceu outras vezes. Uma microaula curta tende a ajudar mais do que novas perguntas.</p>
      <div className="flex flex-wrap gap-2"><Link className="btn-primary btn-sm" to={`/aulas/${q.lessonId}`} onClick={() => onDone('revelou_resposta')}><BookOpen size={14} /> Abrir microaula</Link><button className="btn-ghost btn-sm" onClick={() => setUseLesson(false)}>Prefiro perguntas</button></div>
    </div>
  );
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold"><Badge tone="sky">Tutor socrático</Badge> Vamos achar o que faltou no raciocínio</div>
      <MiniChat msgs={msgs} onSend={send} disabled={st.done} engine={ENGINE} />
      {!st.done && <div className="flex flex-wrap gap-2"><button className="btn-ghost btn-sm" onClick={() => send('não sei')}>Não sei</button><button className="btn-ghost btn-sm" onClick={() => { const r = revealSocratic(st, q); setSt(r.state); setMsgs((m) => [...m, { role: 'tutor', text: r.text }]); onDone('revelou_resposta'); }}>Quero a resposta direta</button></div>}
    </div>
  );
}

function RetryInline({ q, attemptId, exclude, onCorrect, onWrong }: { q: Question; attemptId: string; exclude: string[]; onCorrect: () => void; onWrong: (l: string) => void }) {
  const [tried, setTried] = useState<string[]>(exclude);
  const addRetry = useStore((s) => s.addRetry); // registra também as respostas dadas durante a correção
  if (q.type === 'aberta') return null;
  return <div className="grid gap-1.5 sm:grid-cols-2">{q.alternatives!.map((a) => <button key={a.letter} disabled={tried.includes(a.letter)} onClick={() => { addRetry(attemptId, a.letter, !!a.correct); if (a.correct) onCorrect(); else { setTried([...tried, a.letter]); onWrong(a.letter); } }} className={cx('rounded-lg border px-3 py-2 text-left text-sm', tried.includes(a.letter) ? 'opacity-40' : 'border-slate-200 hover:border-mint-500 dark:border-navy-700')}><strong>{a.letter})</strong> {a.text}</button>)}</div>;
}

function StepPanel({ q, attempt, cause, onDone }: { q: Question; attempt: Attempt; cause?: ErrorCause; onDone: (o: 'compreendeu' | 'revelou_resposta') => void }) {
  const [msg, setMsg] = useState(q.alternatives?.find((a) => a.letter === attempt.chosen)?.tutorPrompt ?? q.openAnswer?.wrongMap?.find((w) => String(w.value) === attempt.chosen.replace(',', '.'))?.tutorPrompt ?? q.hints[1]);
  const [ok, setOk] = useState(false); const [show, setShow] = useState(false);
  const stepLabel = cause === 'atencao' ? 'leitura do enunciado' : cause === 'calculo' ? 'cálculo (o procedimento estava certo)' : 'procedimento';
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2"><Badge tone="amber">Etapa provável: {stepLabel}</Badge>{attempt.errorType && <span className="muted text-xs">{ERROR_LABELS[attempt.errorType].tip}</span>}</div>
      <p className="rounded-xl bg-sky-50 p-3 text-sky-900 dark:bg-sky-500/10 dark:text-sky-100"><Bot size={14} className="mr-1 inline" />{msg}</p>
      {!ok ? <><p className="font-medium">Corrija você mesmo(a): qual alternativa agora?</p><RetryInline q={q} attemptId={attempt.id} exclude={[attempt.chosen]} onCorrect={() => { setOk(true); onDone('compreendeu'); }} onWrong={(l) => setMsg(q.alternatives!.find((a) => a.letter === l)?.tutorPrompt ?? q.hints[2])} />
        <button className="btn-ghost btn-sm" onClick={() => { setShow(true); onDone('revelou_resposta'); }}>Mostrar resolução</button></>
        : <p className="flex items-center gap-2 font-semibold text-mint-700 dark:text-mint-400"><CheckCircle2 size={16} /> Você corrigiu a etapa. Não é preciso refazer toda a teoria.</p>}
      {show && <div className="rounded-xl bg-navy-50 p-3 dark:bg-navy-800"><Rich text={`${q.explanation}\n\n**Método rápido:** ${q.fastMethod}`} /></div>}
    </div>
  );
}

function AttentionPanel({ q, attempt, onDone }: { q: Question; attempt: Attempt; onDone: (o: 'compreendeu' | 'revelou_resposta') => void }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="space-y-3 text-sm">
      <p>Releia com calma o comando: <strong>“{q.statement}”</strong></p>
      {!ok ? <RetryInline q={q} attemptId={attempt.id} exclude={[attempt.chosen]} onCorrect={() => { setOk(true); onDone('compreendeu'); }} onWrong={() => undefined} />
        : <p className="flex items-center gap-2 font-semibold text-mint-700 dark:text-mint-400"><CheckCircle2 size={16} /> Isso. Dica rápida: antes de marcar, confira se a alternativa responde exatamente ao que foi pedido.</p>}
    </div>
  );
}

/** Correção completa em 9 partes (preservada da versão anterior; acessível a qualquer momento). */
export function FullCorrection({ q, attempt, reasons, onAddCard }: { q: Question; attempt: Attempt; reasons: string[]; onAddCard: () => void }) {
  const correct = q.alternatives?.find((a) => a.correct); const chosen = q.alternatives?.find((a) => a.letter === attempt.chosen); const ok = attempt.correct;
  const S = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => <section className="border-t border-slate-100 pt-3 dark:border-navy-800"><h3 className="mb-1.5 flex items-center gap-2 text-sm font-bold"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-navy-800 text-[11px] text-white">{n}</span>{title}</h3><div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{children}</div></section>;
  return (
    <div className="space-y-3">
      <details className="text-xs text-slate-500"><summary className="cursor-pointer">Regras do Radar de Domínio</summary><ul className="mt-2 list-disc space-y-1 pl-5">{reasons.map((r) => <li key={r}>{r}</li>)}</ul></details>
      <S n={1} title="Gabarito">{q.type === 'objetiva' ? <>Alternativa <strong>{correct?.letter}</strong>: {correct?.text}</> : <>Resposta: <strong>{q.openAnswer!.value} {q.openAnswer!.unit}</strong></>}</S>
      <S n={2} title="Sua resposta × gabarito">Você respondeu <strong>{attempt.chosen}</strong>{chosen && ` (${chosen.text})`}. {ok ? 'Coincide com o gabarito.' : 'Não coincide.'}{attempt.justification ? <> Justificativa: <em>“{attempt.justification}”</em></> : ''}</S>
      <S n={3} title="Raciocínio">{!ok ? <>{chosen?.tutorPrompt}{attempt.errorType && <> <Badge tone="red">{ERROR_LABELS[attempt.errorType].label}</Badge></>}</> : 'Seu raciocínio levou à resposta correta.'}</S>
      <S n={4} title="Explicação conceitual">{q.explanation}</S>
      {q.alternatives && <S n={5} title="Análise de cada alternativa"><ul className="space-y-1.5">{q.alternatives.map((a) => <li key={a.letter} className="flex gap-2"><span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold', a.correct ? 'bg-mint-500 text-navy-950' : 'bg-slate-200 dark:bg-navy-700')}>{a.letter}</span><span>{a.analysis}</span></li>)}</ul></S>}
      {q.cpe && <S n={6} title="Método C–P–E"><Rich text={revealCpe(q)} /></S>}
      <S n={q.cpe ? 7 : 6} title="Método mais eficiente"><span className="inline-flex gap-2"><Zap size={16} className="mt-0.5 shrink-0 text-mint-600" />{q.fastMethod}</span></S>
      <S n={q.cpe ? 8 : 7} title="Flashcard sugerido"><div className="flex flex-wrap items-center gap-3"><div className="flex-1 rounded-xl border border-dashed border-slate-300 p-3 dark:border-navy-600"><div className="font-medium">{q.flashcard.front}</div><div className="muted mt-1">{q.flashcard.back}</div></div><button className="btn-ghost btn-sm" onClick={onAddCard}><Plus size={14} /> Adicionar</button></div></S>
      {q.lessonId && <S n={q.cpe ? 9 : 8} title="Para aprofundar"><Link className="btn-ghost btn-sm" to={`/aulas/${q.lessonId}`}><Sparkles size={14} /> Microaula do conteúdo</Link></S>}
    </div>
  );
}
