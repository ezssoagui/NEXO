import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, CheckCircle2, XCircle, Clock, ArrowRight, RotateCcw } from 'lucide-react';
import type { Attempt, Confidence, Question, XPEvent } from '../types';
import { useStore } from '../store/useStore';
import { skillById } from '../data/skills';
import { skillMastery, MASTERY_LABEL, MASTERY_COLOR } from '../engine/mastery';
import { decide, HINT_LIMIT, type PedagogicalDecision } from '../engine/learning';
import type { DiagnosisInput } from '../engine/diagnosis';
import { startCycle } from '../engine/cycle';
import { toHypothesis } from '../engine/intervention';
import { classifyEvidence } from '../engine/evidence';
const toHyp = (d: PedagogicalDecision) => toHypothesis(d, 'erro_conceitual');
import type { TwinLevel } from '../engine/twins';
import AfterAnswer from './AfterAnswer';
import { Badge, Modal, cx } from './ui';

export type PlayerMode = 'tutoria' | 'pratica' | 'simulado' | 'diagnostico' | 'sessao' | 'gemea';
const CONF: { id: Confidence; label: string }[] = [
  { id: 'certeza', label: 'Tenho certeza' }, { id: 'duvida', label: 'Tenho dúvida' }, { id: 'chute', label: 'Chutei' }, { id: 'nao_consegui', label: 'Não consegui resolver' },
];

export default function QuestionPlayer({ q, mode = 'tutoria', isTwin, onDone, onTwin, compact, cycleId, twinLevel, free }: { q: Question; mode?: PlayerMode; isTwin?: boolean; onDone?: (a: Attempt) => void; onTwin?: (level: TwinLevel) => void; compact?: boolean; cycleId?: string; twinLevel?: number; free?: boolean }) {
  const { recordAttempt, notify, settings, report, attempts, upsertCycle, updateAttempt } = useStore();
  const [choice, setChoice] = useState<string>('');
  const [justification, setJustification] = useState('');
  const [confidence, setConfidence] = useState<Confidence | ''>('');
  const [hints, setHints] = useState(0);
  const [phase, setPhase] = useState<'answer' | 'retry' | 'feedback'>('answer');
  const [first, setFirst] = useState<{ attempt: Attempt; xp: XPEvent[]; before: string } | null>(null);
  const [dec, setDec] = useState<PedagogicalDecision | null>(null);
  const [resp, setResp] = useState<{ input: DiagnosisInput; history: typeof attempts } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [retryWrong, setRetryWrong] = useState<string | null>(null);
  const [timer, setTimer] = useState(settings.timer);
  const [sec, setSec] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const start = useRef(Date.now());
  useEffect(() => { setChoice(''); setJustification(''); setConfidence(''); setHints(0); setPhase('answer'); setFirst(null); setDec(null); setResp(null); setRevealed(false); setRetryWrong(null); setSec(0); start.current = Date.now(); }, [q.id]);
  useEffect(() => { if (!timer || phase === 'feedback') return; const t = setInterval(() => setSec((s) => s + 1), 1000); return () => clearInterval(t); }, [timer, phase]);

  const noFeedback = mode === 'simulado' || mode === 'diagnostico';
  const correctAlt = q.alternatives?.find((a) => a.correct);
  const isCorrect = (c: string) => q.type === 'aberta' ? Math.abs(+c.replace(',', '.') - q.openAnswer!.value) <= (q.openAnswer!.tolerance ?? 1e-6) : !!q.alternatives?.find((a) => a.letter === c)?.correct;
  const errorFor = (c: string) => { if (q.type === 'aberta') return q.openAnswer!.wrongMap?.find((w) => Math.abs(w.value - +c.replace(',', '.')) < 1e-6); const a = q.alternatives?.find((x) => x.letter === c); return a ? { errorType: a.errorType, tutorPrompt: a.tutorPrompt } : undefined; };

  const skillState = useMemo(() => skillMastery(attempts, q.skillId).state, [attempts, q.skillId]);
  // Confiança opcional; no modo adaptativo fica oculta em habilidades já dominadas de forma consistente.
  const askConfidence = settings.confidencePrompt === 'sempre' || (settings.confidencePrompt === 'adaptativo' && skillState !== 'consistente');
  const hintLimit = noFeedback ? 0 : HINT_LIMIT[settings.autonomy];

  function submit() {
    if (!choice && confidence !== 'nao_consegui') return notify('Escolha uma resposta ou marque "Não consegui resolver".');
    const conf: Confidence = confidence || 'nao_informada';
    const ok = choice ? isCorrect(choice) : false;
    const timeSec = Math.round((Date.now() - start.current) / 1000);
    const input: DiagnosisInput = { correct: ok, confidence: conf, hintsUsed: hints, justification, chosen: choice || '—', timeSec };
    // NEXO Learning Engine: decisão pedagógica estruturada a partir da resposta, da justificativa e do histórico.
    const d = decide({ q, response: input, history: attempts });
    const err = ok ? undefined : d.diagnosis.errorType ?? (choice ? errorFor(choice)?.errorType : 'lacuna_conceitual');
    let cid = cycleId;
    if (!cid && !isTwin && !noFeedback && !free && d.situation !== 'A' && (d.situation !== 'B' || d.review.needed && d.diagnosis.outcome !== 'acerto_duvida')) { const c = startCycle(q.id, q.skillId, toHyp(d)); upsertCycle(c); cid = c.id; }
    const ev = classifyEvidence(q, { correct: ok, confidence: conf, hintsUsed: hints, justification, errorType: err });
    const res = recordAttempt({ qid: q.id, chosen: choice || '—', correct: ok, confidence: conf, errorType: err, justification, hintsUsed: hints, ts: Date.now(), mode: isTwin ? 'gemea' : mode, isTwin, isNovel: isTwin || q.source === 'gerada_ia_demo', timeSec, evidence: ev, situation: d.situation, cause: d.diagnosis.cause, intervention: d.intervention, cycleId: cid, free }, q, { twinLevel });
    setFirst({ ...res, before: '' }); setDec(d); setResp({ input, history: attempts });
    if (noFeedback) { onDone?.(res.attempt); return; }
    setPhase('feedback');
    const gained = res.xp.reduce((s, e) => s + e.amount, 0);
    if (gained > 0) notify(`+${gained} XP — ${res.xp.find((e) => e.amount)?.reason}`);
  }

  const masteryNow = useMemo(() => skillMastery(attempts, q.skillId), [attempts, q.skillId]);
  const sourceBadge = q.source === 'gerada_ia_demo' ? <Badge tone="violet">Gerada por IA — não é de prova anterior</Badge> : <Badge tone="navy">Autoral NEXO (revisada) · {q.style}</Badge>;
  const sk = skillById(q.skillId);

  return (
    <div className={cx('space-y-4', compact && 'text-[15px]')}>
      <div className="card !p-5 sm:!p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {sourceBadge}<Badge>{q.subject}</Badge><Badge>{q.topic}</Badge>
          <Badge tone={q.difficulty === 'Difícil' ? 'red' : q.difficulty === 'Média' ? 'amber' : 'mint'}>{q.difficulty}</Badge>
          {isTwin && <Badge tone="sky">Questão gêmea</Badge>}
          <span className="ml-auto flex items-center gap-2">
            <button onClick={() => setTimer(!timer)} className={cx('btn-ghost btn-sm', timer && '!border-mint-500')} aria-pressed={timer}><Clock size={14} />{timer ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : 'Cronômetro'}</button>
          </span>
        </div>
        <p className="muted mb-2 text-xs">Habilidade: {sk?.name}{sk?.subtopic ? ` · ${sk.subtopic}` : ''}{sk?.prerequisites?.length ? ` · pré-requisito: ${sk.prerequisites.map((p) => skillById(p)?.name).join(', ')}` : ''}{q.integrates?.length ? ` · integra: ${q.integrates.map((p) => skillById(p)?.name).join(', ')}` : ''}</p>
        {q.context && <div className="mb-4 whitespace-pre-line rounded-xl bg-slate-50 p-4 leading-relaxed text-slate-700 dark:bg-navy-950 dark:text-slate-300">{q.context}</div>}
        <p className="mb-4 font-medium leading-relaxed text-navy-900 dark:text-white">{q.statement}</p>

        {q.type === 'objetiva' ? (
          <fieldset className="space-y-2" disabled={phase === 'feedback'}>
            <legend className="sr-only">Alternativas</legend>
            {q.alternatives!.map((a) => {
              const show = phase === 'feedback' && (revealed || mode === 'pratica' || !!first?.attempt.correct);
              const state = show && a.correct ? 'right' : phase === 'feedback' && first?.attempt.chosen === a.letter && !a.correct ? 'wrong' : phase === 'retry' && (first?.attempt.chosen === a.letter || retryWrong === a.letter) ? 'tried' : '';
              return (
                <label key={a.letter} className={cx('flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition', choice === a.letter && phase !== 'feedback' ? 'border-mint-500 bg-mint-50 dark:bg-mint-500/10' : 'border-slate-200 hover:border-slate-300 dark:border-navy-700', state === 'right' && '!border-mint-500 !bg-mint-50 dark:!bg-mint-500/10', state === 'wrong' && '!border-red-400 !bg-red-50 dark:!bg-red-500/10', state === 'tried' && 'opacity-50')}>
                  <input type="radio" name={`alt-${q.id}`} value={a.letter} checked={choice === a.letter} onChange={() => setChoice(a.letter)} className="sr-only" />
                  <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold', choice === a.letter ? 'bg-mint-500 text-navy-950' : 'bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300')}>{a.letter}</span>
                  <span className="pt-0.5 leading-relaxed">{a.text}</span>
                  {state === 'right' && <CheckCircle2 className="ml-auto shrink-0 text-mint-600" size={20} aria-label="Correta" />}
                  {state === 'wrong' && <XCircle className="ml-auto shrink-0 text-red-500" size={20} aria-label="Sua resposta" />}
                </label>
              );
            })}
          </fieldset>
        ) : (
          <div className="max-w-xs"><label htmlFor={`open-${q.id}`} className="label">Sua resposta {q.openAnswer?.unit && `(${q.openAnswer.unit})`}</label><input id={`open-${q.id}`} className="input" inputMode="decimal" value={choice} onChange={(e) => setChoice(e.target.value)} disabled={phase === 'feedback'} /></div>
        )}

        {phase !== 'feedback' && (
          <>
            <div className="mt-4"><label htmlFor={`just-${q.id}`} className="label">Justifique seu raciocínio {q.type === 'aberta' ? '(obrigatório em olimpíadas)' : '(opcional, recomendado)'}</label>
              <textarea id={`just-${q.id}`} rows={2} className="input" placeholder={q.cpe ? 'Use o C-P-E: qual é o comando? qual trecho prova? por que as outras falham?' : 'Qual grandeza/conceito você usou e por quê?'} value={justification} onChange={(e) => setJustification(e.target.value)} />
            </div>
            {askConfidence && <div className="mt-4"><div className="label">Grau de confiança <span className="muted font-normal">(opcional)</span></div>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Grau de confiança">
                {CONF.map((c) => <button key={c.id} role="radio" aria-checked={confidence === c.id} onClick={() => setConfidence(confidence === c.id ? '' : c.id)} className={cx('rounded-full border px-3 py-1.5 text-xs font-medium transition', confidence === c.id ? 'border-navy-800 bg-navy-800 text-white dark:border-mint-400 dark:bg-mint-500 dark:text-navy-950' : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-navy-600 dark:text-slate-300')}>{c.label}</button>)}
              </div>
            </div>}
            {!askConfidence && <button className="mt-3 text-xs text-slate-500 underline" onClick={() => setConfidence('nao_consegui')}>Não consegui resolver</button>}
            {hints > 0 && <div className="mt-4 space-y-2">{q.hints.slice(0, hints).map((h, i) => <div key={i} className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"><Lightbulb size={16} className="mt-0.5 shrink-0" /><span><strong>{['Dica conceitual', 'Caminho', 'Resolução detalhada'][i]}:</strong> {h}</span></div>)}</div>}
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={submit}>Responder <ArrowRight size={16} /></button>
              {!noFeedback && hints < Math.min(3, hintLimit) && <button className="btn-ghost" onClick={() => setHints(hints + 1)}><Lightbulb size={16} /> {['Dica conceitual', 'Indicar caminho', 'Resolução detalhada'][hints]}</button>}
            </div>
          </>
        )}
      </div>

      {phase === 'feedback' && first && dec && resp && <AfterAnswer key={first.attempt.id} q={q} attempt={first.attempt} decision={dec} response={resp.input} history={resp.history} xp={first.xp} mode={mode === 'pratica' ? 'pratica' : isTwin ? 'gemea' : mode === 'sessao' ? 'sessao' : 'tutoria'} isTwin={isTwin} twinLevel={twinLevel} cycleId={first.attempt.cycleId} onNext={onDone ? () => onDone(first.attempt) : undefined} onTwin={onTwin} onReport={() => setReportOpen(true)} onRevealed={() => setRevealed(true)}
        onDecision={(nd, extra) => { setDec(nd); setResp({ ...resp, input: { ...resp.input, ...extra } }); updateAttempt(first.attempt.id, { cause: nd.diagnosis.cause, situation: nd.situation, intervention: nd.intervention, reclassified: !!extra.studentReport, justification: extra.justification ?? first.attempt.justification }); }} />}

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Denunciar erro nesta questão">
        <form onSubmit={(e) => { e.preventDefault(); const r = (new FormData(e.currentTarget).get('r') as string) || 'Sem descrição'; report(q.id, r); setReportOpen(false); notify('Obrigado! O relato entra na fila de revisão editorial.'); }}>
          <label className="label" htmlFor="r">O que parece errado?</label><textarea id="r" name="r" rows={3} className="input" placeholder="Ex.: a alternativa C também poderia estar correta porque..." />
          <button className="btn-primary mt-3">Enviar relato</button>
        </form>
      </Modal>
    </div>
  );
}

export { RotateCcw };
