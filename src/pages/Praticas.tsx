import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { skillById } from '../data/skills';
import { comparisonById } from '../data/comparisons';
import { tasksForSkill, explainTaskById } from '../data/explainTasks';
import { useStore } from '../store/useStore';
import { useDomains } from '../store/selectors';
import { levelFor } from '../engine/domain';
import { LEVEL_LABEL, pickTask } from '../engine/explain';
import { chooseLevel, isNone, selectTwin, TWIN_LEVEL_LABEL } from '../engine/twins';
import ExplainPlayer from '../components/ExplainPlayer';
import { CompareCard, RecallCard } from '../components/Activities';
import QuestionPlayer from '../components/QuestionPlayer';
import { Badge, Card, Empty } from '../components/ui';

const Back = ({ skillId }: { skillId: string }) => <Link to={`/conteudos/habilidade/${skillId}`} className="muted mb-5 inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft size={14} /> {skillById(skillId)?.name}</Link>;

export function Explicar() {
  const { skillId = '' } = useParams(); const nav = useNavigate(); const domains = useDomains(); const [manual, setManual] = useState<string | null>(null);
  const d = domains.get(skillId); const initial = useMemo(() => (d ? pickTask(skillId, levelFor(d), useStore.getState().explanations)?.id : undefined), [skillId]); // eslint-disable-line react-hooks/exhaustive-deps
  const tasks = tasksForSkill(skillId); const task = explainTaskById(manual ?? initial ?? '');
  if (!task) return <div className="mx-auto max-w-2xl"><Back skillId={skillId} /><p className="muted mb-4 text-sm">Ainda não há atividade com rubrica para esta habilidade. Você pode recordar livremente; isso não gera comprovação.</p><Card><RecallCard skillId={skillId} onDone={() => nav(-1)} /></Card></div>;
  return (
    <div className="mx-auto max-w-2xl"><Back skillId={skillId} />
      {tasks.length > 1 && <div className="mb-5 flex flex-wrap items-center gap-2 text-xs"><span className="muted">Outro nível:</span>{tasks.filter((t) => t.id !== task.id).map((t) => <button key={t.id} className="link" onClick={() => setManual(t.id)}>{LEVEL_LABEL[t.level]}</button>)}</div>}
      <ExplainPlayer key={task.id} task={task} onDone={() => nav(`/conteudos/habilidade/${skillId}`)} doneLabel="Concluir" />
    </div>
  );
}
export function Comparar() {
  const { id = '' } = useParams(); const nav = useNavigate(); const c = comparisonById(id);
  if (!c) return <Empty title="Atividade não encontrada" action={<Link className="btn-primary" to="/conteudos?aba=explicacao">Ver atividades</Link>} />;
  return <div className="mx-auto max-w-2xl"><Back skillId={c.skillIds[0]} /><CompareCard c={c} doneLabel="Concluir" onDone={() => nav(-1)} /></div>;
}
export function Gemea() {
  const { skillId = '' } = useParams(); const [sp] = useSearchParams(); const nav = useNavigate(); const [n, setN] = useState(0);
  const pick = useMemo(() => { const st = useStore.getState(); const t = selectTwin(skillId, chooseLevel(skillId, st.attempts), st.attempts, { originId: sp.get('de') ?? undefined }); if (!isNone(t) && t.kind === 'gerada') st.addGenerated({ q: t.q, validation: [], status: 'aprovada', request: 'Gêmea', ts: Date.now() }); return t; }, [skillId, n]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mx-auto max-w-2xl"><Back skillId={skillId} />
      {isNone(pick) ? <Empty title="Sem questão gêmea confiável agora" text={pick.reason} action={<Link className="btn-ghost" to={`/explicar/${skillId}`}>Explicar o conceito</Link>} /> : <>
        <div className="mb-4 flex flex-wrap items-center gap-2"><Badge tone="brand">Questão gêmea</Badge><Badge>{TWIN_LEVEL_LABEL[pick.level]}</Badge><span className="muted text-xs">{pick.note}</span></div>
        <QuestionPlayer key={pick.q.id} q={pick.q} isTwin twinLevel={pick.level} onDone={(a) => (a.correct ? nav(`/conteudos/habilidade/${skillId}`) : setN(n + 1))} doneLabel="Continuar" />
      </>}
    </div>
  );
}
