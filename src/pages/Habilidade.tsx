import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { placeOf } from '../data/curriculum';
import { prerequisitesOf, skillById } from '../data/skills';
import { matrixSkill } from '../data/matrix';
import { tasksForSkill } from '../data/explainTasks';
import { comparisonsForSkill } from '../data/comparisons';
import { lessonById } from '../data/lessons';
import { QUESTIONS } from '../data/questions';
import { useDomains } from '../store/selectors';
import { useStore } from '../store/useStore';
import { DIM_LABEL, DIM_STATUS_LABEL } from '../engine/domain';
import { compose } from '../engine/recommender';
import { exerciseLoad, incidenceNote, nextUnseen } from '../engine/strategy';
import { RecallCard } from '../components/Activities';
import { Card, Empty, PageHeader, StateBadge, cx, dimDot } from '../components/ui';
import type { Dimension } from '../types';

export default function Habilidade() {
  const { id = '' } = useParams(); const [sp, setSp] = useSearchParams(); const nav = useNavigate(); const sk = skillById(id); const domains = useDomains();
  const attempts = useStore((s) => s.attempts); const explanations = useStore((s) => s.explanations); const review = useStore((s) => s.skillReviews[id]); const start = useStore((s) => s.startSession);
  if (!sk) return <Empty title="Habilidade não encontrada" action={<Link className="btn-primary" to="/conteudos">Ver currículo</Link>} />;
  const d = domains.get(id)!; const place = placeOf(id); const load = exerciseLoad(id, attempts); const q = nextUnseen(id, attempts); const lesson = sk.lessonId ? lessonById(sk.lessonId) : undefined; const cmp = comparisonsForSkill(id)[0];
  const type = d.state === 'nao_avaliado' ? 'aprendizagem' as const : d.state === 'em_aprendizagem' ? (d.dims.resolucao.status === 'demonstrada' ? 'comprovacao' as const : 'recuperacao' as const) : 'aprofundamento' as const;
  const session = () => { const steps = compose(type, [id], domains, { attempts, explanations }); nav(`/sessao/${start({ key: `${type}:${id}`, type, title: sk.name, question: sk.name, reason: 'Sessão iniciada por você.', audit: ['Iniciada pelo estudante na página da habilidade.'], skillIds: [id], steps, minutes: steps.reduce((s, x) => s + x.minutes, 0), priority: 0 })}`); };
  const total = QUESTIONS.filter((x) => x.skillId === id).length;
  return (
    <div>
      {place && <Link to={`/conteudos/${place.block.id}`} className="muted mb-4 inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft size={14} /> {place.block.disciplineName} · {place.block.name} · {place.content.name}</Link>}
      <PageHeader title={sk.name}><StateBadge state={d.state} /></PageHeader>
      {d.regressed && <p className="-mt-4 mb-6 text-sm text-amber-800 dark:text-amber-300">Você já demonstrou um domínio maior. As evidências recentes pedem retomada.</p>}
      {sp.get('recordar') && <Card className="mb-8"><RecallCard skillId={id} doneLabel="Concluir" onDone={() => setSp({})} /></Card>}
      <section aria-label="Dimensões do domínio" className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{(Object.keys(DIM_LABEL) as Dimension[]).map((k) => <div key={k} className="flex gap-3"><span className={cx('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', dimDot(d.dims[k].status))} aria-hidden /><div><p className="text-sm font-medium">{DIM_LABEL[k]} <span className="muted font-normal">· {DIM_STATUS_LABEL[d.dims[k].status]}</span></p><p className="muted text-xs">{d.dims[k].note}</p></div></div>)}</section>
      <div className="mt-8 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={session}>Iniciar sessão</button>
        {lesson && <Link className="btn-ghost" to={`/aulas/${lesson.id}`}>Aula</Link>}
        {tasksForSkill(id).length > 0 && <Link className="btn-ghost" to={`/explicar/${id}`}>Explicar</Link>}
        {cmp && <Link className="btn-ghost" to={`/comparar/${cmp.id}`}>Comparar</Link>}
        {q && <Link className="btn-ghost" to={`/questoes/${q.id}`}>Questão inédita</Link>}
        <button className="btn-ghost" onClick={() => setSp({ recordar: '1' })}>Recordar</button>
      </div>
      <div className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
        <section><h2 className="section-title">Matriz de Referência do ENEM</h2><ul className="mt-2 space-y-2 text-sm">{sk.matrix.map((m) => <li key={m}><strong className="font-medium">{m.replace('-', ' ')}.</strong> <span className="muted">{matrixSkill(m)?.text}.</span></li>)}</ul><p className="muted mt-2 text-xs">Texto oficial do Inep; a associação com esta habilidade é proposta do NEXO.</p></section>
        <section><h2 className="section-title">Estudo</h2><ul className="muted mt-2 space-y-1.5 text-sm">
          <li>{incidenceNote(id) ?? 'Incidência não informada.'}</li>
          <li>Exercícios: {load.done} feito(s){load.max ? `, dose sugerida ${load.min}–${load.max}` : ', prioridade para leitura'} · {total} no banco</li>
          <li>{review ? (review.due <= Date.now() ? 'Revisão disponível agora' : `Próxima revisão em ${Math.ceil((review.due - Date.now()) / 86400000)} dia(s)`) : 'Revisão ainda não programada'}</li>
          {prerequisitesOf(id).length > 0 && <li>Pré-requisitos: {prerequisitesOf(id).map((p, i) => <span key={p}>{i > 0 && ', '}<Link className="link" to={`/conteudos/habilidade/${p}`}>{skillById(p)?.name}</Link></span>)}</li>}
        </ul></section>
      </div>
      <details className="mt-10"><summary className="cursor-pointer text-sm font-medium">Evidências registradas ({d.evidence.length})</summary>{d.evidence.length ? <ul className="mt-3 space-y-1 text-xs">{[...d.evidence].reverse().slice(0, 40).map((e, i) => <li key={i} className="flex gap-3"><span className="muted w-20 shrink-0">{new Date(e.ts).toLocaleDateString('pt-BR')}</span><span className="w-24 shrink-0">{DIM_LABEL[e.dim]}</span><span className={e.value === 'positiva' ? 'text-emerald-700 dark:text-emerald-300' : e.value === 'negativa' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}>{e.note}</span></li>)}</ul> : <p className="muted mt-2 text-sm">Nenhuma. Não avaliado não quer dizer desconhecido.</p>}</details>
    </div>
  );
}
