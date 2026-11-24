import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../store/useStore';
import { useDomains, useIndicators } from '../store/selectors';
import { ALL_DISCIPLINES } from '../data/curriculum';
import { SKILLS } from '../data/skills';
import { indicators, weeklySeries } from '../engine/indicators';
import { detectDifficulties, difficultySkills, difficultyText, errorPatterns } from '../engine/difficulties';
import { DIM_LABEL, STATE_LABEL, skillName } from '../engine/domain';
import { RESULT_LABEL } from '../engine/explain';
import { Badge, Empty, Metric, PageHeader, Progress, Tabs, cx, dimDot, pct, stateTone } from '../components/ui';
import type { Confidence, Dimension, DomainState } from '../types';

type Tab = 'geral' | 'dominio' | 'erros' | 'explicacoes';
const DIMS = Object.keys(DIM_LABEL) as Dimension[];

export default function Desempenho() {
  const [tab, setTab] = useState<Tab>('geral'); const ind = useIndicators(); const attempts = useStore((s) => s.attempts); const explanations = useStore((s) => s.explanations);
  if (!attempts.length && !explanations.length) return <div><PageHeader title="Meu desempenho" /><Empty title="Ainda não há evidências" text="Resolva questões ou explique um conceito. Se quiser um retrato inicial, há uma avaliação diagnóstica opcional." action={<><Link className="btn-primary" to="/questoes">Resolver questões</Link><Link className="btn-ghost" to="/diagnostico">Avaliação diagnóstica</Link></>} /></div>;
  return (
    <div>
      <PageHeader title="Meu desempenho" subtitle="Quatro indicadores separados: um não substitui o outro."><Link className="btn-ghost" to="/diagnostico">Avaliação diagnóstica</Link></PageHeader>
      <div className="mb-10 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4"><Metric label="Cobertura curricular" value={pct(ind.coverage.value)} hint={`${ind.coverage.n} de ${ind.coverage.total}`} /><Metric label="Domínio comprovado" value={pct(ind.domain.value)} hint={`${ind.domain.n} consolidada(s)`} /><Metric label="Aproveitamento recente" value={pct(ind.accuracy.value)} hint={`${ind.accuracy.n} respostas`} /><Metric label="Retenção demonstrada" value={pct(ind.retention.value)} hint={`${ind.retention.n} verificações`} /></div>
      <Tabs tabs={[{ id: 'geral', label: 'Evolução' }, { id: 'dominio', label: 'Domínio' }, { id: 'erros', label: 'Erros e padrões' }, { id: 'explicacoes', label: 'Explicações' }]} value={tab} onChange={setTab} />
      {tab === 'geral' ? <Overview /> : tab === 'dominio' ? <Domain /> : tab === 'erros' ? <Errors /> : <Explained />}
    </div>
  );
}

function Overview() {
  const attempts = useStore((s) => s.attempts); const explanations = useStore((s) => s.explanations); const params = useStore((s) => s.params); const domains = useDomains(); const dark = useStore((s) => s.settings.dark); const axis = dark ? '#9aa3b0' : '#667080';
  const data = weeklySeries({ attempts, explanations });
  return (
    <div className="space-y-12">
      <section><h2 className="section-title">Aproveitamento por semana</h2><p className="muted text-xs">Semanas sem respostas ficam vazias.</p>
        <div className="mt-4 h-52" role="img" aria-label="Aproveitamento semanal em porcentagem"><ResponsiveContainer><BarChart data={data} margin={{ left: -14, right: 4, top: 4 }}><CartesianGrid stroke={axis} strokeOpacity={0.15} vertical={false} /><XAxis dataKey="semana" tick={{ fontSize: 11, fill: axis }} tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: axis }} tickLine={false} axisLine={false} unit="%" /><Tooltip cursor={{ fill: axis, fillOpacity: 0.08 }} formatter={(v, _n, p) => [`${v}% em ${p.payload.questoes} questões`, 'Aproveitamento']} contentStyle={{ borderRadius: 8, fontSize: 12, background: dark ? '#171b22' : '#fff', borderColor: dark ? '#363d49' : '#e4e7ec' }} /><Bar dataKey="aproveitamento" fill="#3b6ef5" radius={[4, 4, 0, 0]} maxBarSize={36} /></BarChart></ResponsiveContainer></div></section>
      <section><h2 className="section-title">Por disciplina</h2><div className="mt-2 overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead><tr className="muted border-b border-ink-200 text-left text-xs dark:border-ink-800">{['Disciplina', 'Cobertura', 'Aproveitamento', 'Consolidadas', 'Retenção'].map((h) => <th key={h} className="py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>{ALL_DISCIPLINES.map((d) => { const ids = d.blocks.flatMap((b) => b.contents.flatMap((c) => c.skills)); if (!ids.length) return null; const i = indicators({ attempts, explanations }, domains, params, ids); return <tr key={d.id} className="border-b border-ink-100 dark:border-ink-800"><td className="py-2.5 font-medium">{d.name}</td><td>{i.coverage.n} de {i.coverage.total}</td><td>{pct(i.accuracy.value)} <span className="muted text-xs">{i.accuracy.n ? `(${i.accuracy.n})` : ''}</span></td><td>{i.domain.n}</td><td>{pct(i.retention.value)}</td></tr>; })}</tbody></table></div></section>
    </div>
  );
}

const ORDER: DomainState[] = ['consolidado', 'provisorio', 'em_aprendizagem', 'nao_avaliado'];
function Domain() {
  const domains = useDomains(); const list = SKILLS.map((s) => domains.get(s.id)!);
  return (
    <div className="space-y-10">
      <p className="muted max-w-2xl text-sm">Provisório exige resolução, compreensão e aplicação em contexto novo. Consolidado exige também retenção. Não há média: cada dimensão precisa da própria evidência.</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">{(['demonstrada', 'parcial', 'negativa', 'sem_evidencia'] as const).map((s) => <span key={s} className="flex items-center gap-1.5"><span className={cx('h-2.5 w-2.5 rounded-full', dimDot(s))} />{{ demonstrada: 'Demonstrada', parcial: 'Parcial', negativa: 'Não demonstrada', sem_evidencia: 'Sem evidência' }[s]}</span>)}<span className="muted">Ordem: {DIMS.map((d) => DIM_LABEL[d].toLowerCase()).join(', ')}</span></div>
      {ORDER.map((st) => {
        const xs = list.filter((d) => d.state === st); if (!xs.length) return null;
        return <section key={st}><h2 className="section-title flex items-center gap-2"><Badge tone={stateTone(st)}>{xs.length}</Badge>{STATE_LABEL[st]}</h2><ul className="mt-1">{xs.map((d) => <li key={d.skillId}><Link className="row group" to={`/conteudos/habilidade/${d.skillId}`}><span className="flex-1 text-sm group-hover:text-brand-700 dark:group-hover:text-brand-300">{skillName(d.skillId)}{d.regressed && <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">regressão</span>}</span>{st !== 'nao_avaliado' && <span className="flex gap-1.5">{DIMS.map((k) => <span key={k} title={`${DIM_LABEL[k]}: ${d.dims[k].note}`} className={cx('h-2.5 w-2.5 rounded-full', dimDot(d.dims[k].status))}><span className="sr-only">{DIM_LABEL[k]}: {d.dims[k].note}</span></span>)}</span>}</Link></li>)}</ul></section>;
      })}
    </div>
  );
}

function Errors() {
  const attempts = useStore((s) => s.attempts); const params = useStore((s) => s.params); const diff = detectDifficulties(attempts, params); const pats = errorPatterns(attempts, params);
  const conf = ([['certeza', 'Certeza'], ['duvida', 'Dúvida'], ['chute', 'Chute'], ['nao_informada', 'Não informada']] as [Confidence, string][]).map(([c, l]) => { const xs = attempts.filter((a) => a.confidence === c); return { l, n: xs.length, ok: xs.filter((a) => a.correct).length }; }).filter((c) => c.n);
  return (
    <div className="space-y-12">
      <section><h2 className="section-title">Dificuldades por bloco</h2>{diff.length ? <ul>{diff.map((d) => <li key={d.block.id}><Link className="row" to={`/conteudos/${d.block.id}`}><span className="flex-1"><span className="text-sm font-medium">{d.block.name}</span><span className="muted block text-xs">{difficultyText(d)} Principalmente em {difficultySkills(d)}.</span></span></Link></li>)}</ul> : <p className="muted mt-2 text-sm">Nenhuma, com os parâmetros atuais. Uma única questão nunca indica dificuldade.</p>}</section>
      <section><h2 className="section-title">Padrões de erro</h2><p className="muted text-xs">Hipóteses a partir do que você declarou e das alternativas marcadas. Só aparecem com repetição.</p>{pats.length ? <ul>{pats.map((p) => <li key={p.label} className="row"><span className="flex-1"><span className="text-sm font-medium">{p.label}</span><span className="muted block text-xs">{p.count} de {p.total} {p.kind === 'cpe' ? 'correções com CPE' : 'erros recentes'}{p.declared ? `, ${p.declared} declarado(s) por você` : ''}</span></span><Badge>confiança {p.confidence}</Badge></li>)}</ul> : <p className="muted mt-2 text-sm">Ainda não há repetição suficiente para afirmar um padrão.</p>}</section>
      {conf.length > 0 && <section><h2 className="section-title">Confiança × acerto</h2><ul>{conf.map((c) => <li key={c.l} className="row"><span className="w-28 text-sm">{c.l}</span><Progress value={c.ok / c.n} className="flex-1" label={c.l} /><span className="muted w-24 text-right text-xs">{Math.round((c.ok / c.n) * 100)}% de {c.n}</span></li>)}</ul></section>}
    </div>
  );
}

function Explained() {
  const xs = useStore((s) => s.explanations);
  if (!xs.length) return <Empty title="Nenhuma explicação ainda" action={<Link className="btn-primary" to="/conteudos?aba=explicacao">Explicar um conceito</Link>} />;
  return <ul>{[...xs].reverse().slice(0, 40).map((x) => <li key={x.id} className="row"><span className="flex-1"><Link className="text-sm hover:underline" to={`/conteudos/habilidade/${x.skillId}`}>{skillName(x.skillId)}</Link><span className="muted block text-xs">{new Date(x.ts).toLocaleDateString('pt-BR')}{x.assisted ? ' · assistida, não comprova' : ''}{x.selfCheck ? ` · sua avaliação: ${x.selfCheck}` : ''}</span></span><Badge tone={x.result === 'demonstrada' ? 'green' : x.result === 'inconclusiva' ? 'slate' : 'amber'}>{RESULT_LABEL[x.result]}</Badge></li>)}</ul>;
}
