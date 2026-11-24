import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, SlidersHorizontal } from 'lucide-react';
import { QUESTIONS } from '../data/questions';
import { SKILLS, skillById } from '../data/skills';
import { ALL_DISCIPLINES, disciplineOf, placeOf } from '../data/curriculum';
import { useStore } from '../store/useStore';
import { useDomains } from '../store/selectors';
import { priorityWeight, byDifficulty } from '../engine/strategy';
import { Empty, PageHeader, cx } from '../components/ui';

const EMPTY = { area: '', disciplina: '', conteudo: '', habilidade: '', dificuldade: '', ano: '', origem: '', status: '' };
type F = typeof EMPTY;

export default function Questoes() {
  const [sp] = useSearchParams(); const nav = useNavigate(); const attempts = useStore((s) => s.attempts); const generated = useStore((s) => s.generated); const activities = useStore((s) => s.activities); const start = useStore((s) => s.startActivity); const domains = useDomains();
  const [f, setF] = useState<F>({ ...EMPTY, habilidade: sp.get('skill') ?? '' }); const [open, setOpen] = useState(false); const [size, setSize] = useState(10);
  const pool = useMemo(() => [...QUESTIONS, ...generated.filter((g) => g.status === 'aprovada' && attempts.some((a) => a.qid === g.q.id)).map((g) => g.q)], [generated, attempts]);
  const last = useMemo(() => new Map(attempts.map((a) => [a.qid, a])), [attempts]);
  const list = pool.filter((q) => (!f.area || q.area === f.area) && (!f.disciplina || disciplineOf(q.skillId) === f.disciplina) && (!f.conteudo || placeOf(q.skillId)?.content.name === f.conteudo) && (!f.habilidade || q.skillId === f.habilidade) && (!f.dificuldade || q.difficulty === f.dificuldade) && (!f.ano || String(q.year) === f.ano) && (!f.origem || q.source === f.origem)
    && (!f.status || (f.status === 'erradas' ? last.get(q.id)?.correct === false : f.status === 'ineditas' ? !last.has(q.id) : last.has(q.id))));
  const set = (k: keyof F, v: string) => setF((p) => ({ ...p, [k]: v, ...(k === 'area' ? { disciplina: '', conteudo: '', habilidade: '' } : k === 'disciplina' ? { conteudo: '', habilidade: '' } : k === 'conteudo' ? { habilidade: '' } : {}) }));
  const disc = ALL_DISCIPLINES.filter((d) => !f.area || d.areaName === f.area); const contents = disc.filter((d) => !f.disciplina || d.name === f.disciplina).flatMap((d) => d.blocks.flatMap((b) => b.contents.filter((c) => c.skills.length).map((c) => c.name)));
  const skills = SKILLS.filter((s) => (!f.area || s.area === f.area) && (!f.disciplina || disciplineOf(s.id) === f.disciplina) && (!f.conteudo || placeOf(s.id)?.content.name === f.conteudo));
  const Sel = ({ k, label, opts }: { k: keyof F; label: string; opts: [string, string][] }) => <div><label className="label !text-xs" htmlFor={`f-${k}`}>{label}</label><select id={`f-${k}`} className="input !py-1.5" value={f[k]} onChange={(e) => set(k, e.target.value)}><option value="">Todos</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>;
  const active = Object.values(f).filter(Boolean).length; const running = activities.find((a) => a.kind === 'bateria' && a.status !== 'concluida');
  // Adaptativo: inédita, da habilidade mais prioritária entre as filtradas, começando pelas fáceis.
  const adaptive = () => { const un = list.filter((q) => !last.has(q.id)); const score = (id: string) => { const d = domains.get(id)!; return priorityWeight(id) * (d.dims.resolucao.status === 'negativa' ? 1.5 : d.state === 'em_aprendizagem' ? 1.3 : d.evaluated ? 0.8 : 1); }; const q = [...(un.length ? un : list)].sort((a, b) => score(b.skillId) - score(a.skillId) || byDifficulty(a, b))[0]; if (q) nav(`/questoes/${q.id}`); };
  const battery = () => { const un = list.filter((q) => !last.has(q.id)), rest = list.filter((q) => last.has(q.id)); const qids = [...un, ...rest].slice(0, size).map((q) => q.id); if (qids.length) nav(`/atividade/${start({ kind: 'bateria', title: `Bateria de ${qids.length} questões`, qids })}`); };
  return (
    <div>
      <PageHeader title="Questões" subtitle="Três modos. Tudo o que você resolve alimenta seu perfil pedagógico." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Mode title="Estudo adaptativo" text="Uma por vez, com correção após cada resposta." action="Começar" onClick={adaptive} disabled={!list.length} />
        <Mode title="Bateria de exercícios" text="Responda todas e corrija ao final." action={running ? 'Continuar bateria' : 'Montar bateria'} onClick={() => (running ? nav(`/atividade/${running.id}`) : battery())} disabled={!running && !list.length} extra={!running && <select aria-label="Tamanho da bateria" className="input !w-auto !py-1 text-xs" value={size} onChange={(e) => setSize(+e.target.value)}>{[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n} questões</option>)}</select>} />
        <Mode title="Simulado" text="Com tempo e sem correção até o fim." action="Ver simulados" onClick={() => nav('/simulados')} />
      </div>
      <div className="mt-10 flex items-center justify-between"><h2 className="section-title">Banco <span className="muted font-normal">· {list.length}</span></h2><button className="btn-ghost btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}><SlidersHorizontal size={14} /> Filtros{active ? ` (${active})` : ''}</button></div>
      {open && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Sel k="area" label="Área" opts={[...new Set(SKILLS.map((s) => s.area))].map((a) => [a, a])} /><Sel k="disciplina" label="Disciplina" opts={disc.map((d) => [d.name, d.name])} /><Sel k="conteudo" label="Conteúdo" opts={contents.map((c) => [c, c])} /><Sel k="habilidade" label="Habilidade" opts={skills.map((s) => [s.id, s.name])} />
        <Sel k="dificuldade" label="Dificuldade" opts={['Fácil', 'Média', 'Difícil'].map((d) => [d, d])} /><Sel k="ano" label="Ano de elaboração" opts={[...new Set(pool.map((q) => String(q.year)))].map((y) => [y, y])} /><Sel k="origem" label="Origem" opts={[['original_nexo', 'Original demonstrativa'], ['gerada_ia_demo', 'Modelo paramétrico']]} /><Sel k="status" label="Situação" opts={[['ineditas', 'Inéditas para mim'], ['erradas', 'Que errei'], ['feitas', 'Já resolvidas']]} />
        {active > 0 && <button className="btn-quiet justify-self-start text-xs" onClick={() => setF(EMPTY)}>Limpar filtros</button>}
      </div>}
      {list.length ? <ul className="mt-3">{list.slice(0, 60).map((q) => { const a = last.get(q.id); return <li key={q.id}><Link to={`/questoes/${q.id}`} className="row group"><span className={cx('h-2 w-2 shrink-0 rounded-full', !a ? 'bg-ink-200 dark:bg-ink-700' : a.correct ? 'bg-emerald-500' : 'bg-red-400')} title={!a ? 'Inédita' : a.correct ? 'Acertou' : 'Errou'} /><span className="min-w-0 flex-1"><span className="block truncate text-sm group-hover:text-brand-700 dark:group-hover:text-brand-300">{q.statement}</span><span className="muted block truncate text-xs">{disciplineOf(q.skillId)} · {skillById(q.skillId)?.name}</span></span><span className="muted text-xs">{q.difficulty}</span><ChevronRight size={16} className="text-ink-400" /></Link></li>; })}</ul> : <div className="mt-4"><Empty title="Nenhuma questão com esses filtros" action={<button className="btn-ghost" onClick={() => setF(EMPTY)}>Limpar filtros</button>} /></div>}
      <p className="muted mt-6 text-xs">Questões originais do protótipo, ainda sem revisão pedagógica humana. Provas oficiais anteriores não estão cadastradas.</p>
    </div>
  );
}
function Mode({ title, text, action, onClick, disabled, extra }: { title: string; text: string; action: string; onClick: () => void; disabled?: boolean; extra?: React.ReactNode }) {
  return <div className="card flex flex-col"><h2 className="text-sm font-semibold">{title}</h2><p className="muted mt-1 flex-1 text-sm">{text}</p><div className="mt-4 flex flex-wrap items-center gap-2"><button className="btn-ghost btn-sm" disabled={disabled} onClick={onClick}>{action}</button>{extra}</div></div>;
}
