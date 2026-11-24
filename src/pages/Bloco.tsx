import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { blockById, blockSkills } from '../data/curriculum';
import { INCIDENCE_SOURCE, tierOf } from '../data/incidence';
import { skillById } from '../data/skills';
import { useDomains, useRecommendations } from '../store/selectors';
import { useStore } from '../store/useStore';
import { blockIndicators } from '../engine/indicators';
import { detectDifficulties, difficultySkills, difficultyText } from '../engine/difficulties';
import { incidenceNote, TIER_LABEL } from '../engine/strategy';
import { QUESTIONS } from '../data/questions';
import { RecommendationCard } from '../components/Recommendation';
import { Badge, Empty, Metric, PageHeader, StateBadge, pct } from '../components/ui';

export default function Bloco() {
  const { id = '' } = useParams(); const nav = useNavigate(); const b = blockById(id);
  const domains = useDomains(); const attempts = useStore((s) => s.attempts); const explanations = useStore((s) => s.explanations); const params = useStore((s) => s.params); const startAct = useStore((s) => s.startActivity); const recs = useRecommendations(60);
  if (!b) return <Empty title="Bloco não encontrado" action={<Link className="btn-primary" to="/conteudos">Ver currículo</Link>} />;
  const ids = blockSkills(b); const ind = blockIndicators(b, { attempts, explanations }, domains, params); const diff = detectDifficulties(attempts, params).find((d) => d.block.id === b.id);
  const notEval = ids.filter((i) => !domains.get(i)?.evaluated); const rec = recs.filter((r) => r.skillIds.some((s) => ids.includes(s))).slice(0, 2);
  const pool = QUESTIONS.filter((q) => ids.includes(q.skillId)); const seen = new Set(attempts.map((a) => a.qid));
  const notes = [...new Set(ids.map(incidenceNote).filter(Boolean))];
  const battery = () => { const qs = [...pool.filter((q) => !seen.has(q.id)), ...pool.filter((q) => seen.has(q.id))].slice(0, 10).map((q) => q.id); nav(`/atividade/${startAct({ kind: 'bateria', title: `Bateria: ${b.name}`, qids: qs })}`); };
  return (
    <div>
      <Link to="/conteudos" className="muted mb-4 inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft size={14} /> {b.areaName} · {b.disciplineName}</Link>
      <PageHeader title={b.name}>{pool.length > 0 && <button className="btn-ghost" onClick={battery}>Bateria de exercícios</button>}</PageHeader>
      {ids.length === 0 ? <Empty title="Conteúdos em cadastramento" text="A estrutura deste bloco já existe, mas as atividades ainda não foram cadastradas. Ele não entra nos seus indicadores." /> : <>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <Metric label="Cobertura" value={pct(ind.coverage.value)} hint={`${ind.coverage.n} de ${ind.coverage.total}`} /><Metric label="Aproveitamento" value={pct(ind.accuracy.value)} hint={ind.accuracy.n ? `${ind.accuracy.n} resposta(s)` : 'sem respostas'} /><Metric label="Domínio consolidado" value={pct(ind.domain.value)} hint={`${ind.domain.provisional} provisória(s)`} /><Metric label="Não avaliadas" value={notEval.length} hint="não significa desconhecidas" />
        </div>
        {diff && <div className="mt-8 rounded-lg border border-amber-300 px-4 py-3 text-sm dark:border-amber-500/40"><strong className="font-medium">Dificuldade identificada.</strong> {difficultyText(diff)} Principalmente em {difficultySkills(diff)}.</div>}
        {rec.length > 0 && <div className="mt-8 grid gap-4 md:grid-cols-2">{rec.map((r) => <RecommendationCard key={r.key} plan={r} />)}</div>}
      </>}
      <div className="mt-10 space-y-8">{b.contents.map((c) => <section key={c.id}><h2 className="section-title">{c.name}</h2>{c.skills.length ? <ul className="mt-1">{c.skills.map((s) => { const d = domains.get(s)!; return <li key={s}><Link to={`/conteudos/habilidade/${s}`} className="row group"><span className="flex-1"><span className="text-sm font-medium group-hover:text-brand-700 dark:group-hover:text-brand-300">{skillById(s)?.name}</span><span className="muted block text-xs">Matriz: {skillById(s)?.matrix.map((m) => m.replace('-', ' ')).join(', ')}</span></span><span className="hidden sm:block"><Badge tone={tierOf(s) === 'alta' ? 'brand' : 'slate'}>Incidência {TIER_LABEL[tierOf(s)].toLowerCase()}</Badge></span><StateBadge state={d.state} /><ChevronRight size={16} className="text-ink-400" /></Link></li>; })}</ul> : <p className="muted mt-2 text-sm">Em cadastramento.</p>}</section>)}</div>
      {notes.length > 0 && <div className="muted mt-10 text-xs"><p className="font-medium">Relevância para o ENEM</p><ul className="mt-1 list-disc pl-5">{notes.map((n) => <li key={n}>{n}</li>)}</ul><p className="mt-1">{INCIDENCE_SOURCE}</p></div>}
    </div>
  );
}
