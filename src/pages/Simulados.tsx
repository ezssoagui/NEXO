import { Link, useNavigate } from 'react-router-dom';
import { QUESTIONS } from '../data/questions';
import { useStore } from '../store/useStore';
import { PageHeader } from '../components/ui';
import { byDifficulty } from '../engine/strategy';
import type { Area, Question } from '../types';

/** Ordem de prova intercalada (não por dificuldade) e prioridade para questões inéditas. */
function pick(filter: (q: Question) => boolean, n: number) {
  const seen = new Set(useStore.getState().attempts.map((a) => a.qid)); const pool = QUESTIONS.filter(filter).sort(byDifficulty);
  const chosen = [...pool.filter((q) => !seen.has(q.id)), ...pool.filter((q) => seen.has(q.id))].slice(0, n);
  return chosen.map((q, i) => ({ q, k: (i * 7) % Math.max(1, chosen.length) + i / 1000 })).sort((a, b) => a.k - b.k).map((x) => x.q.id);
}
const area = (...a: Area[]) => (q: Question) => a.includes(q.area);
const MODES = [
  { id: 'rapido', name: 'Simulado rápido', f: () => true, n: 10 }, { id: 'lc', name: 'Linguagens', f: area('Linguagens'), n: 15 }, { id: 'ch', name: 'Ciências Humanas', f: area('Ciências Humanas'), n: 15 },
  { id: 'cn', name: 'Ciências da Natureza', f: area('Ciências da Natureza'), n: 20 }, { id: 'mt', name: 'Matemática', f: area('Matemática'), n: 20 },
  { id: 'd1', name: 'Dia 1 (Linguagens e Humanas)', f: area('Linguagens', 'Ciências Humanas'), n: 90 }, { id: 'd2', name: 'Dia 2 (Natureza e Matemática)', f: area('Ciências da Natureza', 'Matemática'), n: 90 },
];
export default function Simulados() {
  const nav = useNavigate(); const activities = useStore((s) => s.activities); const start = useStore((s) => s.startActivity); const running = activities.find((a) => a.kind === 'simulado' && a.status !== 'concluida'); const done = activities.filter((a) => a.kind === 'simulado' && a.status === 'concluida').reverse(); const attempts = useStore((s) => s.attempts);
  return (
    <div>
      <PageHeader title="Simulados" subtitle="Tempo controlado, sem pausa e sem IA. A correção vem no final." />
      {running && <p className="mb-6 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm dark:border-brand-500/30 dark:bg-brand-500/10">Você tem um simulado em andamento. <Link className="link" to={`/atividade/${running.id}`}>Continuar</Link></p>}
      <ul>{MODES.map((m) => { const avail = Math.min(m.n, QUESTIONS.filter(m.f).length); const min = avail * 3; return <li key={m.id} className="row"><div className="flex-1"><p className="text-sm font-medium">{m.name}</p><p className="muted text-xs">{avail} questões · {min} min{avail < m.n ? ` (prova completa teria ${m.n}; banco em cadastramento)` : ''}</p></div><button className="btn-ghost btn-sm" disabled={!!running} onClick={() => nav(`/atividade/${start({ kind: 'simulado', title: m.name, qids: pick(m.f, m.n), limitSec: min * 60 })}`)}>Iniciar</button></li>; })}</ul>
      <section className="mt-10 max-w-2xl"><h2 className="section-title">Na prova</h2><ul className="muted mt-2 list-disc space-y-1 pl-5 text-sm"><li>Leia o comando antes do texto-base.</li><li>Deixe as demoradas para depois e garanta as rápidas.</li><li>Marque a confiança: ela orienta a correção.</li><li>Corrija logo em seguida, enquanto lembra das dúvidas.</li></ul></section>
      {done.length > 0 && <section className="mt-10"><h2 className="section-title">Realizados</h2><ul>{done.map((a) => { const xs = (a.attemptIds ?? []).map((i) => attempts.find((t) => t.id === i)); const ok = xs.filter((t) => t?.correct).length; return <li key={a.id}><Link className="row" to={`/atividade/${a.id}`}><span className="flex-1 text-sm">{a.title}</span><span className="muted text-xs">{new Date(a.finishedAt!).toLocaleDateString('pt-BR')}</span><span className="text-sm font-medium">{ok}/{xs.length}</span></Link></li>; })}</ul></section>}
    </div>
  );
}
