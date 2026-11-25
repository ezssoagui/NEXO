import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import type { Attempt, SessionRecord, SessionStep } from '../types';
import { useStore } from '../store/useStore';
import { useAllCards, useDomains } from '../store/selectors';
import { comparisonById } from '../data/comparisons';
import { explainTaskById } from '../data/explainTasks';
import { essaySkillById } from '../data/essaySkills';
import { DIM_LABEL, DIM_STATUS_LABEL, skillName } from '../engine/domain';
import { TYPE_LABEL } from '../engine/recommender';
import { nextUnseen, unseenFor } from '../engine/strategy';
import { chooseLevel, isNone, selectTwin, TWIN_LEVEL_LABEL } from '../engine/twins';
import { isDue } from '../engine/fsrs';
import QuestionPlayer from '../components/QuestionPlayer';
import ExplainPlayer from '../components/ExplainPlayer';
import { CardDeck, CompareCard, RecallCard, TeachCard } from '../components/Activities';
import { EssayStep } from '../components/EssaySteps';
import { Badge, Empty, Progress, StateBadge, cx, dimDot } from '../components/ui';
import type { Dimension } from '../types';

/** Sessão personalizada: cada etapa pode ser pulada; a sessão pode ser interrompida e retomada. */
export default function Sessao() {
  const { id = '' } = useParams(); const nav = useNavigate(); const s = useStore((x) => x.sessions.find((y) => y.id === id)); const advance = useStore((x) => x.advanceSession); const abandon = useStore((x) => x.abandonSession);
  if (!s) return <Empty title="Sessão não encontrada" action={<Link className="btn-primary" to="/percurso">Ver percurso</Link>} />;
  if (s.status === 'concluida') return <Finished s={s} />;
  const step = s.steps[s.idx]; const next = (outcome: SessionRecord['log'][number]['outcome'] = 'feita', ref?: string) => advance(s.id, outcome, ref);
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8"><p className="text-xs font-medium text-brand-700 dark:text-brand-300">{TYPE_LABEL[s.type]}</p><h1 className="mt-1 text-xl font-semibold">{s.title}</h1>
        <Progress value={s.idx / s.steps.length} className="mt-4" label="Progresso da sessão" />
        <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">{s.steps.map((x, i) => <li key={i} aria-current={i === s.idx ? 'step' : undefined} className={cx('flex items-center gap-1', i === s.idx ? 'font-medium text-ink-900 dark:text-white' : 'text-ink-400')}>{i < s.idx && <Check size={12} />}{x.title}</li>)}</ol>
      </div>
      <div key={`${s.id}-${s.idx}`} className="animate-fadeUp"><StepView s={s} step={step} next={next} /></div>
      <div className="mt-10 flex gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">{step.kind !== 'consolidacao' && <button className="btn-quiet text-xs" onClick={() => next('pulada')}>Pular etapa</button>}<button className="btn-quiet text-xs" onClick={() => nav('/percurso')}>Sair e continuar depois</button><button className="btn-quiet text-xs" onClick={() => { abandon(s.id); nav('/percurso'); }}>Encerrar</button></div>
    </div>
  );
}
type Next = (o?: SessionRecord['log'][number]['outcome'], ref?: string) => void;

function StepView({ s, step, next }: { s: SessionRecord; step: SessionStep; next: Next }) {
  const sk = step.skillId!; const cards = useAllCards(); const states = useStore((x) => x.cardStates); const seeLesson = useStore((x) => x.seeLesson);
  const deck = useMemo(() => { const rel = cards.filter((c) => s.skillIds.includes(c.skillId) && (!states[c.id] || isDue(states[c.id]))); const due = cards.filter((c) => isDue(states[c.id])); return [...new Set([...rel, ...due])].slice(0, step.count ?? 6); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  switch (step.kind) {
    case 'aula': case 'microaula': case 'exemplo': case 'conceito': return <TeachCard kind={step.kind} skillId={sk} lessonId={step.ref} onDone={() => { if (step.ref) seeLesson(step.ref); next(); }} />;
    case 'recordacao': return <RecallCard skillId={sk} onDone={() => next()} />;
    case 'comparacao': { const c = comparisonById(step.ref!); return c ? <CompareCard c={c} onDone={() => next()} /> : <Skip next={next} />; }
    case 'explicacao': { const t = explainTaskById(step.ref!); return t ? <ExplainPlayer task={t} context="sessao" onDone={(r) => next(r === 'demonstrada' ? 'acerto' : 'feita', t.id)} /> : <Skip next={next} />; }
    case 'flashcards': return <CardDeck cards={deck} onDone={() => next()} />;
    case 'verificacao': return <Check1 skillId={sk} s={s} next={next} />;
    case 'gemea': case 'inedita': case 'exercicio': return <Series step={step} next={next} />;
    case 'consolidacao': return <Consolidation s={s} next={next} />;
    default: { const es = essaySkillById(step.ref!); return es ? <EssayStep kind={step.kind} skill={es} onDone={(ok) => next(ok ? 'acerto' : 'feita', es.id)} /> : <Skip next={next} />; }
  }
}
const Skip = ({ next, text }: { next: Next; text?: string }) => <Empty title="Etapa indisponível" text={text ?? 'O material desta etapa não está mais disponível.'} action={<button className="btn-primary" onClick={() => next('pulada')}>Continuar</button>} />;

/** Verificação inicial: se o estudante já sabe, pula a aula. */
function Check1({ skillId, s, next }: { skillId: string; s: SessionRecord; next: Next }) {
  const goto = useStore((x) => x.gotoSessionStep); const q = useMemo(() => nextUnseen(skillId, useStore.getState().attempts), [skillId]);
  if (!q) return <Skip next={next} />;
  const done = (a: Attempt) => {
    next(a.correct ? 'acerto' : 'erro', q.id);
    if (a.correct && a.confidence !== 'chute') { const after = s.steps.findIndex((x, i) => i > s.idx && !['aula', 'microaula', 'conceito', 'exemplo'].includes(x.kind)); if (after > s.idx + 1) goto(s.id, after); }
  };
  return <><p className="muted mb-4 text-sm">Antes da aula, uma questão para ver o que você já sabe. Se acertar com segurança, a explicação é dispensada.</p><QuestionPlayer q={q} mode="sessao" onDone={done} /></>;
}

/** Uma ou mais questões inéditas (gêmeas ou de integração). */
function Series({ step, next }: { step: SessionStep; next: Next }) {
  const [n, setN] = useState(0); const total = step.count ?? 1; const twin = step.kind === 'gemea';
  const pick = useMemo(() => {
    const st = useStore.getState();
    if (twin) { const t = selectTwin(step.skillId!, chooseLevel(step.skillId!, st.attempts), st.attempts); if (isNone(t)) return null; if (t.kind === 'gerada') st.addGenerated({ q: t.q, validation: [], status: 'aprovada', request: 'Sessão', ts: Date.now() }); return t; }
    const q = unseenFor(step.skillId!, st.attempts, { integrates: step.ref === 'integra' })[0] ?? nextUnseen(step.skillId!, st.attempts); return q ? { q, level: undefined, note: '' } : null;
  }, [n, step, twin]); // eslint-disable-line react-hooks/exhaustive-deps -- n escolhe a próxima questão
  if (!pick) return <Skip next={next} text="Não há, no momento, questão inédita e confiável. A comprovação fica para a revisão." />;
  return <><div className="mb-4 flex flex-wrap items-center gap-2"><Badge tone="brand">{twin ? 'Questão gêmea' : step.ref === 'integra' ? 'Integração' : 'Questão inédita'}</Badge>{twin && pick.level && <Badge>{TWIN_LEVEL_LABEL[pick.level]}</Badge>}{total > 1 && <span className="muted text-xs">{n + 1} de {total}</span>}</div><QuestionPlayer key={pick.q.id} q={pick.q} mode="sessao" isTwin={twin} twinLevel={pick.level} onDone={(a) => (n + 1 < total ? setN(n + 1) : next(a.correct ? 'acerto' : 'erro', pick.q.id))} /></>;
}

function Consolidation({ s, next }: { s: SessionRecord; next: Next }) {
  const domains = useDomains(); const reviews = useStore((x) => x.skillReviews);
  return <div><Badge tone="brand">Consolidação</Badge><h2 className="mt-3 text-lg font-semibold">Como ficou</h2><ul className="mt-4 space-y-6">{s.skillIds.map((id) => { const d = domains.get(id)!; const r = reviews[id]; return <li key={id}><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{skillName(id)}</span><StateBadge state={d.state} /></div><div className="mt-2 grid gap-1.5 sm:grid-cols-2">{(Object.keys(DIM_LABEL) as Dimension[]).map((k) => <span key={k} className="muted flex items-center gap-2 text-xs"><span className={cx('h-2 w-2 rounded-full', dimDot(d.dims[k].status))} />{DIM_LABEL[k]}: {DIM_STATUS_LABEL[d.dims[k].status].toLowerCase()}</span>)}</div>{r && <p className="muted mt-2 text-xs">{r.due <= Date.now() ? 'Revisão disponível' : `Próxima revisão em ${Math.ceil((r.due - Date.now()) / 86400000)} dia(s)`}</p>}</li>; })}</ul><button className="btn-primary mt-8" onClick={() => next()}>Concluir sessão</button></div>;
}
function Finished({ s }: { s: SessionRecord }) {
  const ok = s.log.filter((l) => l.outcome === 'acerto').length; const skipped = s.log.filter((l) => l.outcome === 'pulada').length;
  return <div className="mx-auto max-w-xl pt-8"><Empty title="Sessão concluída" text={`${s.title}. ${s.log.length - skipped} etapa(s) feita(s)${skipped ? `, ${skipped} pulada(s)` : ''}${ok ? `, ${ok} comprovação(ões)` : ''}.`} action={<><Link className="btn-primary" to="/inicio">Início</Link>{s.skillIds[0] && <Link className="btn-ghost" to={`/conteudos/habilidade/${s.skillIds[0]}`}>Ver evidências</Link>}</>} /></div>;
}
