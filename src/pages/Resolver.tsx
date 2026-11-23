import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Info, AlertTriangle } from 'lucide-react';
import { getQuestion, useStore } from '../store/useStore';
import { QUESTIONS } from '../data/questions';
import QuestionPlayer from '../components/QuestionPlayer';
import { Empty, Tabs, Badge } from '../components/ui';
import { chooseLevel, isNone, selectTwin, TWIN_LEVEL_LABEL, type TwinLevel, type TwinPick } from '../engine/twins';
import { resume, startCycle } from '../engine/cycle';
import { classifyResponse } from '../engine/intervention';
import type { Question } from '../types';

export default function Resolver() {
  const { id = '' } = useParams(); const [sp, setSp] = useSearchParams(); const nav = useNavigate();
  const { attempts, addGenerated, cycles, upsertCycle } = useStore();
  const base = getQuestion(id);
  const [mode, setMode] = useState<'tutoria' | 'pratica'>('tutoria');
  const [twin, setTwin] = useState<(TwinPick & { cycleId: string; origin: Question }) | null>(null);
  const [noTwin, setNoTwin] = useState<string | null>(null);
  const wantTwin = sp.get('gemea') === '1';

  /** Comprovação: escolhe questão inédita do mesmo conceito no nível indicado, dentro do ciclo de domínio. */
  const makeTwin = (origin: Question, level?: TwinLevel) => {
    setNoTwin(null);
    const st = useStore.getState();
    let cycle = st.cycles.filter((c) => c.skillId === origin.skillId && c.status !== 'concluido').sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!cycle) {
      const last = [...st.attempts].reverse().find((a) => a.skillId === origin.skillId);
      const h = last ? classifyResponse(origin, { correct: last.correct, confidence: last.confidence, hintsUsed: last.hintsUsed, justification: last.justification, chosen: last.chosen }, []) : classifyResponse(origin, { correct: false, confidence: 'nao_consegui', hintsUsed: 0, chosen: '—' }, []);
      cycle = { ...startCycle(origin.id, origin.skillId, h), stage: 'comprovacao' };
      upsertCycle(cycle);
    } else if (cycle.status !== 'ativo') { cycle = resume(cycle); upsertCycle(cycle); }
    const lv = level ?? chooseLevel(cycle.situation, cycle.twinAttempts);
    const pick = selectTwin(origin, lv, st.attempts);
    if (isNone(pick)) { setTwin(null); setNoTwin(pick.reason); return; }
    if (pick.kind === 'gerada') addGenerated({ q: pick.q, validation: [{ check: 'Validação automática', ok: true, detail: 'Aprovada no validador do gerador (sem revisão humana).' }], status: 'aprovada', request: `Gêmea de ${origin.id}`, ts: Date.now() });
    setTwin({ ...pick, cycleId: cycle.id, origin });
  };
  useEffect(() => { setTwin(null); setNoTwin(null); if (wantTwin && base) makeTwin(base); /* eslint-disable-next-line */ }, [id, wantTwin]);

  const idx = QUESTIONS.findIndex((q) => q.id === id);
  const next = idx >= 0 ? QUESTIONS[(idx + 1) % QUESTIONS.length] : QUESTIONS[0];
  if (!base) return <Empty title="Questão não encontrada" action={<Link className="btn-primary" to="/questoes">Voltar ao banco</Link>} />;
  const shown = twin?.q ?? base;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="btn-ghost btn-sm" onClick={() => nav('/questoes')}><ArrowLeft size={14} /> Banco</button>
        <div className="ml-auto"><Tabs tabs={[{ id: 'tutoria', label: 'Modo tutoria' }, { id: 'pratica', label: 'Modo prática' }]} value={mode} onChange={setMode} /></div>
      </div>
      <p className="muted -mt-3 mb-4 flex items-start gap-2 text-xs"><Info size={14} className="mt-0.5 shrink-0" />{mode === 'tutoria' ? 'Tutoria: depois de responder, a NEXO escolhe a intervenção adequada — às vezes nenhuma. Acertou com segurança? Siga em frente.' : 'Prática: correção completa logo após responder.'}</p>
      {noTwin && <div className="mb-4 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{noTwin} <button className="underline" onClick={() => { setNoTwin(null); setSp({}); }}>Voltar à questão</button></span></div>}
      {twin && <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100"><Badge tone="sky">Comprovação · {TWIN_LEVEL_LABEL[twin.level]}</Badge> <Badge tone={twin.reviewed ? 'mint' : 'violet'}>{twin.reviewed ? 'Questão revisada' : 'Gerada e validada automaticamente'}</Badge><p className="mt-1">{twin.note} Mesmo conceito de {twin.origin.id}, em outra situação — para verificar transferência, não memorização.</p></div>}
      <QuestionPlayer key={shown.id} q={shown} mode={mode} isTwin={!!twin} cycleId={twin?.cycleId} twinLevel={twin?.level}
        onTwin={(lv) => makeTwin(twin?.origin ?? base, lv)} />
      <div className="mt-6 flex justify-between">
        <Link className="btn-ghost" to="/questoes">Ver banco</Link>
        <Link className="btn-dark" to={`/questoes/${next.id}`}>Próxima questão <ArrowRight size={16} /></Link>
      </div>
    </div>
  );
}
