import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, ShieldCheck, FileClock, Flag, Lightbulb, AlertTriangle, Target, Layers, BookOpen, Sigma, Bot } from 'lucide-react';
import { lessonById } from '../data/lessons';
import { FLASHCARDS } from '../data/flashcards';
import { useStore } from '../store/useStore';
import { Badge, Card, Empty, Modal, cx } from '../components/ui';
import { questionById } from '../data/questions';

const STEPS = ['Explicação inicial', 'Exemplo resolvido', 'Padrões', 'Aplicação guiada', 'Questão individual', 'Correção argumentada', 'Transferência', 'Revisão posterior'];

export default function Aula() {
  const { id = '' } = useParams(); const l = lessonById(id);
  const { report, notify, addXP, cardStates } = useStore();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [rep, setRep] = useState(false);
  if (!l) return <Empty title="Aula não encontrada" action={<Link to="/aulas" className="btn-primary">Voltar</Link>} />;
  const cards = FLASHCARDS.filter((c) => l.skillIds.includes(c.skillId));
  const Check = ({ idx }: { idx: number }) => {
    const c = l.checks[idx]; const a = answers[idx];
    return (
      <div className="my-4 rounded-2xl border border-mint-300 bg-mint-50/60 p-4 dark:border-mint-500/30 dark:bg-mint-500/5">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-mint-800 dark:text-mint-300">Pergunta rápida</div>
        <div className="font-medium">{c.q}</div>
        <div className="mt-2 flex flex-wrap gap-2">{c.options.map((o, i) => <button key={o} disabled={a !== undefined} onClick={() => { setAnswers({ ...answers, [idx]: i }); if (i === c.answer) addXP(3, 'Pergunta rápida da aula', `chk-${l.id}-${idx}`); }} className={cx('rounded-xl border px-3 py-2 text-sm', a === undefined ? 'border-slate-300 bg-white hover:border-mint-500 dark:border-navy-600 dark:bg-navy-900' : i === c.answer ? 'border-mint-500 bg-mint-100 dark:bg-mint-500/20' : i === a ? 'border-red-400 bg-red-50 dark:bg-red-500/10' : 'opacity-50')}>{o}</button>)}</div>
        {a !== undefined && <p className="mt-2 flex items-start gap-2 text-sm">{a === c.answer ? <CheckCircle2 size={16} className="mt-0.5 text-mint-600" /> : <XCircle size={16} className="mt-0.5 text-red-500" />}{c.feedback}</p>}
      </div>
    );
  };
  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/aulas" className="btn-ghost btn-sm mb-4"><ArrowLeft size={14} /> Aulas</Link>
      <div className="flex flex-wrap gap-2"><Badge>{l.subject}</Badge><Badge tone="navy">{l.level}</Badge><Badge>{l.minutes} min</Badge>{l.origin === 'curado' ? <Badge tone="mint"><ShieldCheck size={12} /> Conteúdo curado e revisado (equipe demo)</Badge> : <Badge tone="amber"><FileClock size={12} /> Produzido com IA · revisão editorial pendente</Badge>}</div>
      <h1 className="mt-3 text-3xl font-extrabold">{l.title}</h1>

      <nav aria-label="Etapas do ensino progressivo" className="mt-5 flex gap-1 overflow-x-auto pb-1">{STEPS.map((s, i) => <span key={s} className="chip shrink-0 bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300">{i + 1}. {s}</span>)}</nav>

      <Card className="mt-5 !bg-navy-900 !text-white dark:!bg-navy-800"><div className="text-xs font-bold uppercase tracking-wider text-mint-300">Microaula · 1 minuto</div><p className="mt-2 text-lg leading-relaxed">{l.micro}</p></Card>

      <section className="mt-6"><h2 className="mb-2 flex items-center gap-2 text-xl font-bold"><BookOpen size={20} /> Explicação completa</h2>
        {l.explanation.map((p, i) => <div key={i}><p className="my-3 leading-relaxed">{p}</p>{l.checks.map((c, ci) => c.after === i + 1 ? <Check key={ci} idx={ci} /> : null)}</div>)}
      </section>

      <section className="mt-6"><h2 className="mb-3 text-xl font-bold">Resumo visual</h2>
        <div className="grid gap-3 sm:grid-cols-3">{l.visual.map((v) => <div key={v.label} className="rounded-2xl border-2 border-navy-100 p-4 text-center dark:border-navy-700"><div className="muted text-xs font-semibold uppercase">{v.label}</div><div className="mt-2 font-display text-lg font-bold text-navy-800 dark:text-mint-300">{v.value}</div></div>)}</div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card><h3 className="mb-2 font-bold">Conceitos fundamentais</h3><ul className="list-disc space-y-1 pl-5 text-sm">{l.concepts.map((c) => <li key={c}>{c}</li>)}</ul></Card>
        <Card><h3 className="mb-2 flex items-center gap-2 font-bold"><Target size={16} /> Reconheça o padrão</h3><ul className="list-disc space-y-1 pl-5 text-sm">{l.patterns.map((c) => <li key={c}>{c}</li>)}</ul></Card>
      </div>

      {l.formulas.length > 0 && <section className="mt-6"><h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><Sigma size={20} /> Fórmulas e variáveis</h2><div className="space-y-2">{l.formulas.map((f) => <div key={f.expr} className="card !p-4"><span className="formula !text-base">{f.expr}</span>{f.vars && <p className="muted mt-2 text-sm">{f.vars}</p>}<p className="mt-1 text-sm"><strong>Quando usar:</strong> {f.when}</p></div>)}</div></section>}

      <section className="mt-6"><h2 className="mb-2 text-xl font-bold">Exemplos</h2><ul className="list-disc space-y-1 pl-5">{l.examples.map((e) => <li key={e}>{e}</li>)}</ul></section>

      <section className="mt-6"><h2 className="mb-3 text-xl font-bold">Questão resolvida</h2><Card><p className="font-medium">{l.solved.problem}</p><ol className="mt-3 space-y-2">{l.solved.steps.map((s, i) => <li key={i} className="flex gap-3 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint-500 text-xs font-bold text-navy-950">{i + 1}</span>{s}</li>)}</ol></Card></section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card><h3 className="mb-2 flex items-center gap-2 font-bold text-red-700 dark:text-red-400"><AlertTriangle size={16} /> Erros frequentes</h3><ul className="list-disc space-y-1 pl-5 text-sm">{l.mistakes.map((c) => <li key={c}>{c}</li>)}</ul></Card>
        <Card><h3 className="mb-2 flex items-center gap-2 font-bold"><Lightbulb size={16} /> Aplicações em provas</h3><ul className="list-disc space-y-1 pl-5 text-sm">{l.examUse.map((c) => <li key={c}>{c}</li>)}</ul></Card>
      </div>

      <section className="mt-6"><h2 className="mb-3 text-xl font-bold">Exercícios de fixação</h2>
        <div className="grid gap-2 sm:grid-cols-2">{l.exerciseIds.map((qid, i) => { const q = questionById(qid)!; return <Link key={qid} to={`/questoes/${qid}`} className="card !p-4 hover:border-mint-400"><Badge tone={i === 0 ? 'mint' : 'sky'}>{i === 0 ? 'Questão individual' : 'Transferência'}</Badge><div className="mt-2 text-sm font-medium">{q.topic} · {q.difficulty}</div><p className="muted line-clamp-2 text-xs">{q.context ?? q.statement}</p></Link>; })}</div>
      </section>

      <section className="mt-6"><h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><Layers size={20} /> Flashcards e revisão</h2>
        <div className="grid gap-2 sm:grid-cols-2">{cards.slice(0, 6).map((c) => <div key={c.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-navy-700"><div className="font-medium">{c.front}</div><div className="muted mt-1">{c.back}</div>{cardStates[c.id] && <Badge tone="mint">no seu baralho</Badge>}</div>)}</div>
        <div className="mt-3 flex flex-wrap gap-2"><Link to="/flashcards" className="btn-primary btn-sm">Revisar flashcards</Link><Link to={`/tutor?modo=aprender`} className="btn-ghost btn-sm"><Bot size={14} /> Tirar dúvida com a tutora</Link><Link to="/ensinar" className="btn-ghost btn-sm">Aprender ensinando</Link></div>
      </section>

      <div className="mt-8 rounded-2xl bg-slate-100 p-4 text-xs text-slate-600 dark:bg-navy-900 dark:text-slate-400">
        <strong>Origem e revisão:</strong> {l.origin === 'curado' ? 'conteúdo redigido e revisado pela equipe pedagógica da demonstração.' : 'rascunho produzido com apoio de IA; aguarda revisão editorial humana antes de ser marcado como revisado (ver fila no painel administrativo).'} Encontrou um problema? <button className="inline-flex items-center gap-1 font-semibold underline" onClick={() => setRep(true)}><Flag size={12} /> Denunciar erro</button>
      </div>
      <Modal open={rep} onClose={() => setRep(false)} title="Denunciar erro no material">
        <form onSubmit={(e) => { e.preventDefault(); report(l.id, (new FormData(e.currentTarget).get('r') as string) || '—'); setRep(false); notify('Relato enviado para a revisão editorial.'); }}><textarea name="r" className="input" rows={3} aria-label="Descrição" placeholder="Descreva o problema" /><button className="btn-primary mt-3">Enviar</button></form>
      </Modal>
    </div>
  );
}
