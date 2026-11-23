import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play, Target, CheckCircle2, Layers, Brain, ArrowRight, Compass, Shuffle, TrendingUp, AlertTriangle, Trophy, BookOpen, ListChecks, Route as RouteIcon } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Card, Stat, Progress, Badge, cx } from '../components/ui';
import { EvolutionChart, SkillMap } from '../components/charts';
import { allMastery, subjectStats, masteryIndicators } from '../engine/mastery';
import { recommendations, NEXT_LABEL } from '../engine/learning';
import { isDue } from '../engine/srs';
import { FLASHCARDS } from '../data/flashcards';
import { levelInfo, totalXP } from '../engine/gamification';
import { CAUSE_LABELS, SKILLS, SUBJECT_COLORS, skillById } from '../data/skills';
import { LESSONS } from '../data/lessons';
import CyclesCard from '../components/CyclesCard';
import type { ErrorCause } from '../types';

const DAY = 86400000;
export default function Dashboard() {
  const nav = useNavigate();
  const { profile, attempts, cardStates, customCards, xpEvents, diagnosticDone, skillReviews, settings, setSetting, simHistory } = useStore();
  const [minutes, setMinutes] = useState<5 | 10 | 20 | 40>(10);
  const real = attempts.filter((a) => !a.free);
  const recs = recommendations(real, skillReviews, Date.now(), 3);
  const m = allMastery(real);
  const strong = m.filter((x) => x.state === 'consistente' || x.state === 'provisorio');
  const attention = m.filter((x) => x.state === 'desenvolvimento' || x.regressed || x.fragile);
  const allCards = [...FLASHCARDS, ...customCards];
  const dueCards = allCards.filter((c) => cardStates[c.id] && isDue(cardStates[c.id])).length;
  const dueSkills = Object.entries(skillReviews).filter(([, r]) => r.due <= Date.now()).map(([k]) => k);
  const causes = new Map<ErrorCause, number>(); real.filter((a) => !a.correct && a.cause && a.cause !== 'indeterminada').forEach((a) => causes.set(a.cause!, (causes.get(a.cause!) ?? 0) + 1));
  const topCauses = [...causes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const ind = SKILLS.map((s) => masteryIndicators(real, s.id));
  const reviewsDone = ind.reduce((s, x) => s + x.reviews, 0); const retained = ind.reduce((s, x) => s + x.retained, 0);
  const week = real.filter((a) => a.ts > Date.now() - 7 * DAY); const prevWeek = real.filter((a) => a.ts <= Date.now() - 7 * DAY && a.ts > Date.now() - 14 * DAY);
  const acc = (xs: typeof real) => (xs.length ? Math.round((xs.filter((a) => a.correct).length / xs.length) * 100) : null);
  const xp = totalXP(xpEvents); const lv = levelInfo(xp);
  const subj = subjectStats(real);
  const trails = LESSONS.map((l) => ({ l, done: l.skillIds.every((sk) => ['provisorio', 'consistente'].includes(m.find((x) => x.skillId === sk)?.state ?? '')), started: real.some((a) => l.skillIds.includes(a.skillId)) }));
  const adaptive = settings.studyMode === 'adaptativo';

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 p-6 text-white sm:p-8">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-mint-500/20 blur-2xl" aria-hidden />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm text-mint-300">Olá, {profile?.nickname}</p><h1 className="mt-1 text-2xl font-extrabold !text-white sm:text-3xl">Bom voltar a estudar. Vamos evoluir hoje?</h1></div>
          <div className="flex rounded-xl bg-white/10 p-1 text-sm" role="radiogroup" aria-label="Modo de estudo">
            <button role="radio" aria-checked={adaptive} onClick={() => setSetting('studyMode', 'adaptativo')} className={cx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold', adaptive ? 'bg-white text-navy-900' : 'text-white/80')}><Compass size={14} /> Adaptativo</button>
            <button role="radio" aria-checked={!adaptive} onClick={() => setSetting('studyMode', 'livre')} className={cx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold', !adaptive ? 'bg-white text-navy-900' : 'text-white/80')}><Shuffle size={14} /> Livre</button>
          </div>
        </div>
        {adaptive ? (
          <>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex rounded-xl bg-white/10 p-1" role="radiogroup" aria-label="Duração da sessão">{([5, 10, 20, 40] as const).map((n) => <button key={n} role="radio" aria-checked={minutes === n} onClick={() => setMinutes(n)} className={cx('rounded-lg px-3 py-2 text-sm font-semibold', minutes === n ? 'bg-white text-navy-900' : 'text-white/80 hover:text-white')}>{n} min</button>)}</div>
              <button className="btn-primary !px-5 !py-3 !text-base" onClick={() => nav(diagnosticDone ? `/sessao?min=${minutes}` : '/diagnostico')}><Play size={18} /> {diagnosticDone ? 'Começar minha sessão' : 'Fazer diagnóstico inicial'}</button>
            </div>
            <p className="mt-2 text-xs text-slate-400">A sessão é montada pelo NEXO Learning Engine a partir das suas evidências. Você pode sair dela a qualquer momento.</p>
          </>
        ) : (
          <div className="mt-5 grid gap-2 sm:grid-cols-4">{[['/questoes', 'Banco de questões', ListChecks], ['/aulas', 'Aulas e materiais', BookOpen], ['/flashcards', 'Revisão', Layers], ['/simulados', 'Simulados', Target]].map(([to, l, I]: any) => <Link key={to} to={to} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-3 text-sm font-semibold hover:bg-white/20"><I size={16} />{l}</Link>)}</div>
        )}
      </section>

      {/* 1) O que estudar hoje  2) Por quê */}
      <Card>
        <div className="mb-3 flex items-center gap-2"><Brain className="text-mint-600" size={20} /><h2 className="section-title">O que estudar hoje — e por quê</h2></div>
        {!diagnosticDone && real.length === 0 ? <p className="text-sm">Ainda não há evidências sobre você. O <Link to="/diagnostico" className="font-semibold text-mint-700 underline dark:text-mint-400">diagnóstico inicial</Link> (6 questões) permite as primeiras recomendações.</p> : (
          <ol className="grid gap-3 md:grid-cols-3">{recs.map((r, i) => <li key={r.skillId} className="rounded-xl border border-slate-200 p-4 dark:border-navy-700">
            <div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">{i + 1}</span><Badge tone={r.action === 'prerequisitos' ? 'red' : r.action === 'revisao' ? 'amber' : r.action === 'desafio' ? 'violet' : 'sky'}>{NEXT_LABEL[r.action]}</Badge></div>
            <div className="mt-2 font-semibold">{skillById(r.skillId)?.name}</div>
            <p className="muted mt-1 text-sm"><strong className="text-slate-700 dark:text-slate-300">Por quê:</strong> {r.reason}{skillById(r.skillId)?.examWeight === 'alta' ? ' Conteúdo de alta incidência no exame.' : ''}</p>
            {r.to && <Link to={r.to} className="btn-dark btn-sm mt-3">Começar <ArrowRight size={14} /></Link>}
          </li>)}</ol>
        )}
      </Card>

      {/* 3) Como estou evoluindo */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Acertos nesta semana" value={acc(week) === null ? '—' : `${acc(week)}%`} hint={acc(prevWeek) === null ? `${week.length} questões` : `semana anterior: ${acc(prevWeek)}%`} icon={<TrendingUp size={18} />} />
        <Stat label="Habilidades em domínio" value={`${strong.length}/${SKILLS.length}`} hint={`${attention.length} precisam de atenção`} icon={<CheckCircle2 size={18} />} />
        <Stat label="Retenção observada" value={reviewsDone ? `${retained}/${reviewsDone}` : '—'} hint="acertos em revisões ≥ 1 dia depois" icon={<Brain size={18} />} />
        <Stat label="Revisões pendentes" value={dueCards + dueSkills.length} hint={`${dueSkills.length} habilidade(s) · ${dueCards} cartão(ões)`} icon={<Layers size={18} />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3"><div className="mb-2 flex items-center justify-between"><h2 className="section-title">Evolução de acertos</h2><Link to="/desempenho" className="text-sm font-medium text-mint-700 hover:underline dark:text-mint-400">Detalhes</Link></div>{real.length ? <EvolutionChart attempts={real} /> : <p className="muted text-sm">O gráfico aparece com as primeiras respostas.</p>}</Card>
        <Card className="lg:col-span-2"><h2 className="section-title mb-3">Evolução por disciplina</h2>
          <div className="space-y-3">{subj.map((s) => <div key={s.subject}><div className="mb-1 flex justify-between text-sm"><span>{s.subject}</span><span className="muted text-xs">{s.dominated}/{s.total} em domínio · {s.attempts} questões{s.attempts ? ` · ${s.accuracy}% de acerto` : ''}</span></div><Progress value={s.dominated / s.total} hex={SUBJECT_COLORS[s.subject]} label={`Habilidades em domínio em ${s.subject}`} /></div>)}</div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card><h2 className="section-title mb-2 flex items-center gap-2"><Trophy size={16} className="text-mint-600" /> Habilidades fortes</h2>{strong.length ? <ul className="space-y-1 text-sm">{strong.slice(0, 6).map((x) => <li key={x.skillId}>✓ {x.skill.name} <span className="muted text-xs">({x.state === 'consistente' ? 'consistente' : 'provisório'})</span></li>)}</ul> : <p className="muted text-sm">Nenhuma ainda — um acerto isolado não basta.</p>}</Card>
        <Card><h2 className="section-title mb-2 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500" /> Precisam de atenção</h2>{attention.length ? <ul className="space-y-1 text-sm">{attention.slice(0, 6).map((x) => <li key={x.skillId}>• {x.skill.name} <span className="muted text-xs">{x.regressed ? '(falhou após domínio)' : x.fragile ? '(acerto frágil)' : '(em desenvolvimento)'}</span></li>)}</ul> : <p className="muted text-sm">Nada por enquanto.</p>}</Card>
        <Card><h2 className="section-title mb-2">Erros mais frequentes</h2>{topCauses.length ? <ul className="space-y-1 text-sm">{topCauses.map(([c, n]) => <li key={c} className="flex justify-between"><span>{CAUSE_LABELS[c].label}</span><Badge tone="red">{n}</Badge></li>)}</ul> : <p className="muted text-sm">Sem erros diagnosticados.</p>}<Link to="/desempenho" className="btn-ghost btn-sm mt-3">Detetive de Erros</Link></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3"><div className="mb-3 flex items-center justify-between"><h2 className="section-title">Radar de Domínio</h2><span className="muted text-xs">passe o mouse para ver o porquê</span></div><SkillMap attempts={real} /></Card>
        <div className="space-y-4 lg:col-span-2">
          <CyclesCard />
          <Card><h2 className="section-title mb-2 flex items-center gap-2"><RouteIcon size={16} /> Progresso nas trilhas</h2><ul className="space-y-1 text-sm">{trails.filter((t) => t.started).slice(0, 5).map((t) => <li key={t.l.id} className="flex justify-between"><span>{t.l.title}</span><Badge tone={t.done ? 'mint' : 'amber'}>{t.done ? 'concluída' : 'em andamento'}</Badge></li>)}{!trails.some((t) => t.started) && <li className="muted">Nenhuma iniciada.</li>}</ul><Link to="/trilha" className="btn-ghost btn-sm mt-3">Minha trilha</Link></Card>
          <Card><h2 className="section-title mb-2">Histórico de simulados</h2>{simHistory.length ? <ul className="space-y-1 text-sm">{simHistory.slice(-4).reverse().map((h) => <li key={h.ts} className="flex justify-between"><span>{h.name} · {new Date(h.ts).toLocaleDateString('pt-BR')}</span><strong>{h.correct}/{h.total}</strong></li>)}</ul> : <p className="muted text-sm">Nenhum simulado ainda.</p>}</Card>
          <Card className="!p-4"><div className="flex items-center justify-between text-sm"><span>Nível {lv.level} · {xp} XP</span><Link to="/arena" className="text-mint-700 underline dark:text-mint-400">Arena</Link></div><Progress className="mt-2" value={lv.progress} /></Card>
        </div>
      </div>
    </div>
  );
}
