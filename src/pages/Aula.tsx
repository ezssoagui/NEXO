import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { lessonById } from '../data/lessons';
import { disciplineOf } from '../data/curriculum';
import { tasksForSkill } from '../data/explainTasks';
import { useStore } from '../store/useStore';
import { Choice, DemoTag, Empty, Rich, cx } from '../components/ui';

export default function Aula() {
  const { id = '' } = useParams(); const l = lessonById(id); const see = useStore((s) => s.seeLesson); const [ans, setAns] = useState<Record<number, number>>({});
  useEffect(() => { if (l) see(l.id); }, [l, see]);
  if (!l) return <Empty title="Aula não encontrada" action={<Link to="/conteudos?aba=aulas" className="btn-primary">Ver aulas</Link>} />;
  const Check = ({ i }: { i: number }) => { const c = l.checks[i]; const a = ans[i]; return <div className="my-6 border-l-2 border-brand-500 pl-4"><p className="text-sm font-medium">{c.q}</p><div className="mt-2 flex flex-wrap gap-2" role="radiogroup">{c.options.map((o, k) => <Choice key={o} disabled={a !== undefined} active={a === k} onClick={() => setAns((p) => ({ ...p, [i]: k }))}>{o}</Choice>)}</div>{a !== undefined && <p className={cx('mt-2 text-sm', a === c.answer ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300')}>{c.feedback}</p>}</div>; };
  const List = ({ title, items }: { title: string; items: string[] }) => (items.length ? <section><h2 className="section-title">{title}</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{items.map((x) => <li key={x}>{x}</li>)}</ul></section> : null);
  return (
    <article className="mx-auto max-w-2xl">
      <Link to="/conteudos?aba=aulas" className="muted mb-5 inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft size={14} /> Aulas</Link>
      <div className="flex flex-wrap items-center gap-2 text-xs"><span className="muted">{disciplineOf(l.skillIds[0])} · {l.level} · {l.minutes} min</span><DemoTag title="Conteúdo autoral do protótipo.">Sem revisão pedagógica humana</DemoTag></div>
      <h1 className="mt-2 text-2xl font-semibold">{l.title}</h1>
      <div className="mt-5 text-lg leading-relaxed text-ink-700 dark:text-ink-200"><Rich text={l.micro} /></div>
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed">{l.explanation.map((p, i) => <div key={i}><p>{p}</p>{l.checks.map((c, k) => (c.after === i + 1 ? <Check key={k} i={k} /> : null))}</div>)}</div>
      {l.visual.length > 0 && <dl className="mt-8 grid gap-4 border-y border-ink-200 py-4 text-sm dark:border-ink-800 sm:grid-cols-3">{l.visual.map((v) => <div key={v.label}><dt className="muted text-xs">{v.label}</dt><dd className="mt-0.5 font-medium">{v.value}</dd></div>)}</dl>}
      <div className="mt-8 space-y-8">
        {l.formulas.length > 0 && <section><h2 className="section-title">Relações</h2><ul className="mt-2 space-y-2 text-sm">{l.formulas.map((f) => <li key={f.expr}><code className="font-mono font-medium">{f.expr}</code> <span className="muted">{f.vars ? `${f.vars}. ` : ''}{f.when}</span></li>)}</ul></section>}
        <section><h2 className="section-title">Exemplo resolvido</h2><p className="mt-2 text-sm font-medium">{l.solved.problem}</p><ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{l.solved.steps.map((s) => <li key={s}>{s}</li>)}</ol></section>
        <List title="Como reconhecer" items={l.patterns} /><List title="Erros frequentes" items={l.mistakes} /><List title="No ENEM" items={l.examUse} />
      </div>
      <div className="mt-10 border-t border-ink-200 pt-6 dark:border-ink-800"><h2 className="section-title">Agora é com você</h2><p className="muted mt-1 text-sm">Assistir à aula não comprova aprendizagem.</p><div className="mt-4 flex flex-wrap gap-2">{l.skillIds.filter((s) => tasksForSkill(s).length).slice(0, 1).map((s) => <Link key={s} className="btn-primary" to={`/explicar/${s}`}>Explicar o conceito</Link>)}{l.exerciseIds.slice(0, 2).map((q, i) => <Link key={q} className="btn-ghost" to={`/questoes/${q}`}>Questão {i + 1}</Link>)}<Link className="btn-ghost" to={`/professor?skill=${l.skillIds[0]}`}>Tirar dúvida</Link></div></div>
    </article>
  );
}
