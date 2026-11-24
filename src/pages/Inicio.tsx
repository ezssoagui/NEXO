import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAllCards, useDomains, useIndicators, useRecInput, useRecommendations } from '../store/selectors';
import { dayPlan, essayRecommendation, recommend } from '../engine/recommender';
import { dueSkillReviews } from '../engine/skillReview';
import { isDue } from '../engine/fsrs';
import { skillName } from '../engine/domain';
import { ALL_BLOCKS, blockSkills } from '../data/curriculum';
import { tierOf } from '../data/incidence';
import { MainRecommendation } from '../components/Recommendation';
import { Metric, pct } from '../components/ui';

const DAY = 86400000;
/** Saudação conforme o horário local do dispositivo. */
const greetingFor = (h: number) => (h < 6 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite');
const START = [['Resolver questões', 'Livre, com filtros', '/questoes'], ['Explorar o currículo', 'Por área e bloco', '/conteudos'], ['Assistir a uma aula', 'Aulas curtas em texto', '/conteudos?aba=aulas'], ['Seguir o percurso sugerido', 'Montado para você', '/percurso'], ['Escrever uma redação', 'Com correção formativa', '/redacao']] as const;

export default function Inicio() {
  const nav = useNavigate(); const profile = useStore((s) => s.profile)!; const attempts = useStore((s) => s.attempts); const explanations = useStore((s) => s.explanations); const essays = useStore((s) => s.essays);
  const start = useStore((s) => s.startSession); const reviews = useStore((s) => s.skillReviews); const cardStates = useStore((s) => s.cardStates); const sessions = useStore((s) => s.sessions);
  const ind = useIndicators(); const domains = useDomains(); const cards = useAllCards(); const x = useRecInput(); const recs = useRecommendations(12);
  const [greeting, setGreeting] = useState(() => greetingFor(new Date().getHours()));
  useEffect(() => { const t = setInterval(() => setGreeting(greetingFor(new Date().getHours())), 60000); return () => clearInterval(t); }, []);
  const fresh = !attempts.length && !explanations.length && !essays.length;
  const due = dueSkillReviews(reviews, domains, attempts); const dueCards = cards.filter((c) => isDue(cardStates[c.id])).length;
  const next = Object.entries(reviews).filter(([, r]) => r.due > Date.now()).sort((a, b) => a[1].due - b[1].due).slice(0, 3);
  const plan = dayPlan({ ...x, weeklyHours: profile.weeklyHours }); const essay = essayRecommendation(x);
  const running = sessions.filter((s) => s.status === 'andamento').at(-1);
  // Prioridades: blocos de maior incidência com habilidades ainda não avaliadas.
  const prio = ALL_BLOCKS.map((b) => { const ids = blockSkills(b); return { b, open: ids.filter((i) => !domains.get(i)?.evaluated).length, total: ids.length, high: ids.filter((i) => tierOf(i) === 'alta').length }; }).filter((p) => p.total && p.open && p.high).sort((a, b) => b.high - a.high || b.open / b.total - a.open / a.total).slice(0, 3);
  const openItem = (i: (typeof plan)[number]) => { if (i.to) return nav(i.to); const p = recommend(x, 20).find((r) => r.key === i.key); if (p) nav(`/sessao/${start(p)}`); };

  return (
    <div className="space-y-10">
      <header><p className="text-xs font-semibold tracking-wide text-brand-700 dark:text-brand-300">NEXO</p><h1 className="mt-1 text-2xl font-semibold">{greeting}, {profile.nickname}. Vamos evoluir hoje?</h1></header>

      {!fresh && <section aria-label="Indicadores" className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        <Metric label="Cobertura curricular" value={pct(ind.coverage.value)} hint={`${ind.coverage.n} de ${ind.coverage.total} habilidades`} />
        <Metric label="Domínio comprovado" value={pct(ind.domain.value)} hint={`${ind.domain.n} consolidada(s), ${ind.domain.provisional} provisória(s)`} />
        <Metric label="Aproveitamento recente" value={pct(ind.accuracy.value)} hint={ind.accuracy.n ? `últimas ${ind.accuracy.n} respostas` : 'sem respostas'} />
        <Metric label="Retenção demonstrada" value={pct(ind.retention.value)} hint={ind.retention.n ? `${ind.retention.n} verificação(ões)` : 'ainda sem verificação'} />
      </section>}

      {fresh ? (
        <section><h2 className="text-lg font-semibold">Por onde você quer começar?</h2><p className="muted mt-1 max-w-xl text-sm">O NEXO ainda não conhece você, e isso não é problema: cada atividade ajuda a montar seu percurso.</p>
          <ul className="mt-5 divide-y divide-ink-100 border-y border-ink-100 dark:divide-ink-800 dark:border-ink-800">{START.map(([l, d, to]) => <li key={to}><Link to={to} className="flex items-center gap-3 py-3.5 hover:text-brand-700 dark:hover:text-brand-300"><span className="font-medium">{l}</span><span className="muted text-sm">{d}</span><ChevronRight size={16} className="ml-auto text-ink-400" /></Link></li>)}</ul>
          <p className="muted mt-4 text-sm">Prefere um retrato inicial? Há uma <Link className="link" to="/diagnostico">avaliação diagnóstica opcional</Link>, sem tempo e com pausa.</p>
        </section>
      ) : <>
        {running && <button className="flex w-full items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-left text-sm dark:border-brand-500/30 dark:bg-brand-500/10" onClick={() => nav(`/sessao/${running.id}`)}><span className="font-medium">Continuar: {running.title}</span><span className="muted">etapa {running.idx + 1} de {running.steps.length}</span><ChevronRight size={16} className="ml-auto" /></button>}
        <MainRecommendation />
      </>}

      {!fresh && <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
        <section><h2 className="section-title">Plano de hoje</h2><ul className="mt-1">{plan.map((i) => <li key={i.label} className="row"><button className="flex-1 text-left text-sm hover:text-brand-700 dark:hover:text-brand-300" onClick={() => openItem(i)}>{i.label}</button>{i.minutes > 0 && <span className="muted text-xs">{i.minutes} min</span>}</li>)}{!plan.length && <li className="muted py-3 text-sm">Nada programado. Escolha o que quiser.</li>}</ul></section>
        <section><div className="flex items-baseline justify-between"><h2 className="section-title">Próximas revisões</h2><Link className="link text-xs" to="/revisoes">Ver todas</Link></div><ul className="mt-1">
          {due.slice(0, 2).map((r) => <li key={r.skillId} className="row"><Link to={r.options[0].to} className="flex-1 text-sm hover:text-brand-700 dark:hover:text-brand-300">{skillName(r.skillId)}</Link><span className="text-xs text-amber-700 dark:text-amber-300">hoje</span></li>)}
          {dueCards > 0 && <li className="row"><Link to="/revisoes" className="flex-1 text-sm hover:text-brand-700 dark:hover:text-brand-300">Flashcards</Link><span className="text-xs text-amber-700 dark:text-amber-300">{dueCards} pendente(s)</span></li>}
          {next.slice(0, Math.max(0, 3 - due.length)).map(([id, r]) => <li key={id} className="row"><span className="flex-1 text-sm">{skillName(id)}</span><span className="muted text-xs">em {Math.ceil((r.due - Date.now()) / DAY)} d</span></li>)}
          {!due.length && !dueCards && !next.length && <li className="muted py-3 text-sm">Aparecem depois das primeiras atividades.</li>}</ul></section>
        <section><h2 className="section-title">Prioridades curriculares</h2><ul className="mt-1">{prio.map(({ b, open, total }) => <li key={b.id} className="row"><Link to={`/conteudos/${b.id}`} className="flex-1 text-sm hover:text-brand-700 dark:hover:text-brand-300">{b.name} <span className="muted">· {b.disciplineName}</span></Link><span className="muted text-xs">{open} de {total} não avaliada(s)</span></li>)}{!prio.length && <li className="muted py-3 text-sm">Todos os blocos de alta incidência já têm evidências.</li>}</ul></section>
        <section><h2 className="section-title">Redação</h2>{essay ? <div className="pt-3"><p className="text-sm">{essay.question}</p><p className="muted mt-1 text-xs">{essay.title}. {essay.reason}</p><button className="link mt-2 text-sm" onClick={() => nav(`/sessao/${start({ ...essay, priority: 0 })}`)}>Iniciar sessão de redação</button></div> : <p className="muted pt-3 text-sm">{essays.some((e) => e.versions.length) ? 'Nenhuma dificuldade recorrente identificada.' : 'Envie um texto para receber recomendações.'} <Link className="link" to="/redacao">Escrever</Link></p>}</section>
      </div>}
      {!fresh && recs.length === 0 && <p className="muted text-sm">Sem recomendações no momento. Estude livremente: tudo o que você fizer conta.</p>}
    </div>
  );
}
