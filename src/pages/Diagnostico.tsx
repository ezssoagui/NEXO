import { Link, useNavigate } from 'react-router-dom';
import { QUESTIONS } from '../data/questions';
import { useStore } from '../store/useStore';
import { Badge, PageHeader, Progress } from '../components/ui';
import { diagnosticSet } from '../engine/diagnostic';

/** Avaliação diagnóstica complementar: opcional, sem tempo, com pausa e relatório. */
export default function Diagnostico() {
  const nav = useNavigate(); const params = useStore((s) => s.params); const activities = useStore((s) => s.activities); const start = useStore((s) => s.startActivity); const resume = useStore((s) => s.resumeActivity); const attempts = useStore((s) => s.attempts);
  const cur = activities.find((a) => a.kind === 'diagnostico' && a.status !== 'concluida'); const done = activities.filter((a) => a.kind === 'diagnostico' && a.status === 'concluida');
  const set = diagnosticSet(QUESTIONS, params.diagnosticoAlvo, attempts.map((a) => a.qid)); const target = params.diagnosticoAlvo;
  return (
    <div className="max-w-2xl">
      <PageHeader title="Avaliação diagnóstica" subtitle="Opcional. O NEXO também conhece você aos poucos, sem ela." />
      <ul className="space-y-2 text-sm"><li>{target} questões previstas, distribuídas entre as quatro áreas.</li><li>Sem limite de tempo. Pause e retome quando quiser.</li><li>A confiança é opcional. Não há correção nem IA durante a avaliação.</li><li>Ao final, um relatório de conhecimentos e dificuldades.</li><li>Redação diagnóstica opcional e independente.</li></ul>
      {set.qids.length < target && <p className="mt-5 rounded-lg border border-amber-300 px-4 py-3 text-sm dark:border-amber-500/40"><strong className="font-medium">Versão parcial.</strong> O banco demonstrativo tem {set.qids.length} questões disponíveis para esta avaliação ({set.byArea.map((a) => `${a.n} de ${a.area}`).join(', ')}). A estrutura está pronta para {target}; não repetimos questões para completar.</p>}
      {cur ? <div className="mt-8"><p className="text-sm font-medium">Em andamento: {Object.keys(cur.answers).length} de {cur.qids.length}</p><Progress value={Object.keys(cur.answers).length / cur.qids.length} className="mt-2" /><button className="btn-primary mt-4" onClick={() => { resume(cur.id); nav(`/atividade/${cur.id}`); }}>Retomar</button></div>
        : <div className="mt-8 flex flex-wrap gap-2"><button className="btn-primary" onClick={() => nav(`/atividade/${start({ kind: 'diagnostico', title: 'Avaliação diagnóstica', qids: set.qids })}`)}>Começar</button><Link className="btn-ghost" to="/redacao?diagnostica=1">Só a redação diagnóstica</Link></div>}
      {done.length > 0 && <section className="mt-10"><h2 className="section-title">Relatórios</h2><ul>{done.map((a) => <li key={a.id}><Link className="row" to={`/atividade/${a.id}`}><span className="flex-1 text-sm">{new Date(a.finishedAt!).toLocaleDateString('pt-BR')}</span><Badge>{a.attemptIds?.length ?? 0} respostas</Badge></Link></li>)}</ul></section>}
    </div>
  );
}
