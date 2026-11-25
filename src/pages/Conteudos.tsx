import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { CURRICULUM, blockSkills } from '../data/curriculum';
import { LESSONS } from '../data/lessons';
import { INCIDENCE_SOURCE, tierOf } from '../data/incidence';
import { EXPLAIN_TASKS } from '../data/explainTasks';
import { COMPARISONS } from '../data/comparisons';
import { SKILLS, skillById } from '../data/skills';
import { disciplineOf } from '../data/curriculum';
import { useDomains } from '../store/selectors';
import { useStore } from '../store/useStore';
import { LEVEL_LABEL } from '../engine/explain';
import { levelFor } from '../engine/domain';
import { TIER_LABEL } from '../engine/strategy';
import { Badge, PageHeader, Tabs, cx } from '../components/ui';

type Tab = 'curriculo' | 'explicacao' | 'aulas';
export default function Conteudos() {
  const [sp, setSp] = useSearchParams(); const tab = (sp.get('aba') as Tab) || 'curriculo';
  return (
    <div>
      <PageHeader title="Conteúdos" subtitle="O currículo completo, com o que já foi avaliado e o que ainda falta." />
      <Tabs tabs={[{ id: 'curriculo', label: 'Currículo' }, { id: 'explicacao', label: 'Explicação ativa' }, { id: 'aulas', label: 'Aulas' }]} value={tab} onChange={(t) => setSp({ aba: t })} />
      {tab === 'curriculo' && <Curriculum />}{tab === 'explicacao' && <ExplainList />}{tab === 'aulas' && <Lessons />}
    </div>
  );
}

function Curriculum() {
  const domains = useDomains(); const [area, setArea] = useState(CURRICULUM[0].id); const a = CURRICULUM.find((x) => x.id === area)!;
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">{CURRICULUM.map((x) => <button key={x.id} aria-pressed={area === x.id} onClick={() => setArea(x.id)} className={cx('rounded-full border px-3 py-1 text-sm', area === x.id ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200' : 'border-ink-200 text-ink-600 dark:border-ink-700 dark:text-ink-300')}>{x.name}</button>)}</div>
      <div className="space-y-8">{a.disciplines.map((d) => (
        <section key={d.id}><h2 className="section-title">{d.name}</h2>
          <ul className="mt-1">{d.blocks.map((b) => {
            const ids = blockSkills(b); const ev = ids.filter((i) => domains.get(i)?.evaluated).length; const cons = ids.filter((i) => domains.get(i)?.state === 'consolidado').length; const prov = ids.filter((i) => domains.get(i)?.state === 'provisorio').length;
            const tier = ids.some((i) => tierOf(i) === 'alta') ? 'alta' : ids.some((i) => tierOf(i) === 'media') ? 'media' : 'baixa';
            return <li key={b.id}><Link to={`/conteudos/${b.id}`} className="row group">
              <span className="min-w-0 flex-1"><span className="text-sm font-medium group-hover:text-brand-700 dark:group-hover:text-brand-300">{b.name}</span><span className="muted block truncate text-xs">{b.contents.map((c) => c.name).join(', ')}</span></span>
              {ids.length ? <><span className="hidden gap-1 sm:flex" aria-hidden>{ids.map((i) => { const s = domains.get(i)!.state; return <span key={i} className={cx('h-2 w-2 rounded-full', { nao_avaliado: 'bg-ink-200 dark:bg-ink-700', em_aprendizagem: 'bg-amber-400', provisorio: 'bg-brand-400', consolidado: 'bg-emerald-500' }[s])} />; })}</span><span className="muted hidden w-40 text-right text-xs sm:block">{ev} de {ids.length} avaliada(s){cons || prov ? ` · ${cons} consol.` : ''}</span><span className="hidden w-20 sm:block"><Badge tone={tier === 'alta' ? 'brand' : 'slate'}>Inc. {TIER_LABEL[tier].toLowerCase()}</Badge></span></> : <span className="muted text-xs">em cadastramento</span>}
              <ChevronRight size={16} className="text-ink-400" /></Link></li>;
          })}</ul></section>))}</div>
      <p className="muted mt-8 text-xs">Organização curricular provisória. {SKILLS.length} habilidades com atividades; conteúdos em cadastramento não entram nos indicadores. Relevância: {INCIDENCE_SOURCE}</p>
    </div>
  );
}

function ExplainList() {
  const domains = useDomains(); const done = useStore((s) => s.explanations); const [disc, setDisc] = useState('');
  const groups = [...new Set(EXPLAIN_TASKS.map((t) => disciplineOf(t.skillId)))];
  const skills = [...new Set(EXPLAIN_TASKS.map((t) => t.skillId))].filter((s) => !disc || disciplineOf(s) === disc);
  return (
    <div>
      <p className="muted mb-5 max-w-2xl text-sm">Explique com suas palavras. A atividade se adapta ao nível que você já demonstrou em cada habilidade.</p>
      <div className="mb-4 flex flex-wrap gap-2">{['', ...groups].map((g) => <button key={g} aria-pressed={disc === g} onClick={() => setDisc(g)} className={cx('rounded-full border px-3 py-1 text-xs', disc === g ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200' : 'border-ink-200 text-ink-600 dark:border-ink-700 dark:text-ink-300')}>{g || 'Todas'}</button>)}</div>
      <ul>{skills.map((id) => { const d = domains.get(id)!; const ok = done.some((x) => x.skillId === id && x.result === 'demonstrada' && !x.assisted); return <li key={id}><Link to={`/explicar/${id}`} className="row group"><span className="flex-1"><span className="text-sm font-medium group-hover:text-brand-700 dark:group-hover:text-brand-300">{skillById(id)?.name}</span><span className="muted block text-xs">{disciplineOf(id)} · {EXPLAIN_TASKS.filter((t) => t.skillId === id).length} atividade(s)</span></span><Badge>{LEVEL_LABEL[levelFor(d)]}</Badge>{ok && <Badge tone="green">Demonstrada</Badge>}<ChevronRight size={16} className="text-ink-400" /></Link></li>; })}</ul>
      <h2 className="section-title mt-10">Comparar conceitos</h2><ul>{COMPARISONS.filter((c) => !disc || c.skillIds.some((s) => disciplineOf(s) === disc)).map((c) => <li key={c.id}><Link to={`/comparar/${c.id}`} className="row group"><span className="flex-1 text-sm font-medium group-hover:text-brand-700 dark:group-hover:text-brand-300">{c.a} × {c.b}</span><span className="muted text-xs">{disciplineOf(c.skillIds[0])}</span><ChevronRight size={16} className="text-ink-400" /></Link></li>)}</ul>
    </div>
  );
}
function Lessons() {
  const seen = useStore((s) => s.lessonsSeen);
  return <><ul>{LESSONS.map((l) => <li key={l.id}><Link to={`/aulas/${l.id}`} className="row group"><span className="flex-1"><span className="text-sm font-medium group-hover:text-brand-700 dark:group-hover:text-brand-300">{l.title}</span><span className="muted block text-xs">{disciplineOf(l.skillIds[0])} · {l.minutes} min</span></span>{seen[l.id] && <span className="muted text-xs">vista</span>}<ChevronRight size={16} className="text-ink-400" /></Link></li>)}</ul><p className="muted mt-6 text-xs">Aulas demonstrativas, ainda sem revisão pedagógica humana. Assistir não comprova domínio.</p></>;
}
