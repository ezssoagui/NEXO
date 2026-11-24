import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Play, Timer, Bot, TrendingUp, AlertTriangle } from 'lucide-react';
import { QUESTIONS, SIMULADO_IDS } from '../data/questions';
import { useStore } from '../store/useStore';
import QuestionPlayer from '../components/QuestionPlayer';
import { PageHeader, Card, Badge, Progress, cx } from '../components/ui';
import type { Attempt, Question } from '../types';
import { ERROR_LABELS, skillById } from '../data/skills';

interface Mode { id: string; name: string; desc: string; ids: () => string[]; minutes: number; pause: boolean }
const MODES: Mode[] = [
  { id: 'rapido', name: 'Simulado rápido', desc: '10 questões variadas · 25 min', ids: () => SIMULADO_IDS, minutes: 25, pause: true },
  { id: 'natureza', name: 'ENEM por área: Natureza', desc: 'Física, Química e Biologia', ids: () => QUESTIONS.filter((q) => q.area === 'Ciências da Natureza' && q.type === 'objetiva').slice(0, 8).map((q) => q.id), minutes: 24, pause: true },
  { id: 'linguagens', name: 'ENEM por área: Linguagens e Humanas', desc: 'Interpretação e contexto', ids: () => QUESTIONS.filter((q) => q.area === 'Linguagens' || q.area === 'Ciências Humanas').map((q) => q.id), minutes: 18, pause: true },
  { id: 'completo', name: 'ENEM completo (demo)', desc: 'Todas as 28 objetivas do banco · sem pausa', ids: () => QUESTIONS.filter((q) => q.type === 'objetiva').map((q) => q.id), minutes: 84, pause: false },
  { id: 'vestibular', name: 'Vestibular (estilo)', desc: 'Questões em estilo vestibular tradicional', ids: () => QUESTIONS.filter((q) => q.exam === 'Vestibular').map((q) => q.id), minutes: 15, pause: false },
  { id: 'olimpiada', name: 'Olimpíadas', desc: 'Problemas abertos com justificativa', ids: () => QUESTIONS.filter((q) => q.exam === 'Olimpíada').map((q) => q.id), minutes: 40, pause: false },
  { id: 'habilidade', name: 'Diagnóstico por habilidade', desc: 'Uma questão por habilidade em desenvolvimento', ids: () => [...new Map(QUESTIONS.map((q) => [q.skillId, q.id])).values()].slice(0, 8), minutes: 20, pause: true },
];

export default function Simulados() {
  const { attempts, simHistory, addSim } = useStore();
  const [mode, setMode] = useState<Mode | null>(null);
  const [i, setI] = useState(0); const [res, setRes] = useState<Attempt[]>([]);
  const [left, setLeft] = useState(0); const [paused, setPaused] = useState(false);
  const [startTs, setStartTs] = useState(0);
  const [ids, setIds] = useState<string[]>([]);
  const later = () => setIds([...ids.slice(0, i), ...ids.slice(i + 1), ids[i]]);
  useEffect(() => { if (!mode || paused || i >= ids.length) return; const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000); return () => clearInterval(t); }, [mode, paused, i, ids.length]);
  const history = simHistory;
  const finished = mode && (i >= ids.length || left === 0);
  useEffect(() => { if (finished && res.length) addSim({ ts: startTs, pct: Math.round((res.filter((r) => r.correct).length / ids.length) * 100), name: mode!.name, correct: res.filter((r) => r.correct).length, total: ids.length }); }, [finished]); // eslint-disable-line

  if (!mode) return (
    <div>
      <PageHeader title="Simulados" subtitle="Treine com tempo controlado. Correção completa só ao final, como na prova." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{MODES.map((m) => <button key={m.id} onClick={() => { setMode(m); setIds(m.ids()); setI(0); setRes([]); setLeft(m.minutes * 60); setPaused(false); setStartTs(Date.now()); }} className="card text-left transition hover:border-mint-400"><div className="flex items-center gap-2 font-semibold"><Timer size={16} /> {m.name}</div><p className="muted mt-1 text-sm">{m.desc}</p><div className="mt-3 flex gap-2"><Badge>{m.ids().length} questões</Badge><Badge>{m.minutes} min</Badge><Badge tone={m.pause ? 'mint' : 'amber'}>{m.pause ? 'Permite pausa' : 'Sem pausa'}</Badge></div></button>)}</div>
      <Card className="mt-6"><h2 className="section-title mb-2">Estratégia de prova</h2><ul className="muted list-disc space-y-1 pl-5 text-sm"><li>Leia o comando antes do texto-base: você passa a saber o que procurar.</li><li>Deixe as questões demoradas para depois e garanta primeiro as rápidas.</li><li>Sem certeza? Elimine os absurdos e marque a confiança: isso orienta a revisão.</li><li>Corrija assim que terminar, enquanto ainda lembra das dúvidas.</li></ul></Card>
      {history.length > 0 && <Card className="mt-6"><h2 className="section-title mb-2">Simulados anteriores</h2><ul className="space-y-1 text-sm">{history.slice(-6).reverse().map((h) => <li key={h.ts} className="flex justify-between"><span>{h.name} · {new Date(h.ts).toLocaleDateString('pt-BR')}</span><strong>{h.pct}%</strong></li>)}</ul></Card>}
    </div>
  );

  if (finished) return <Result mode={mode} ids={ids} res={res} prev={history.filter((h) => h.ts !== startTs)} onBack={() => setMode(null)} />;
  const q = QUESTIONS.find((x) => x.id === ids[i])!;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-14 z-10 -mx-4 mb-4 flex items-center gap-3 bg-slate-50/95 px-4 py-2 backdrop-blur dark:bg-navy-950/95 sm:top-16">
        <span className="font-semibold">{mode.name}</span><span className="muted text-sm">{i + 1}/{ids.length}</span>
        <Progress value={i / ids.length} className="flex-1" />
        <span className={cx('font-mono text-sm font-bold', left < 120 && 'text-red-600')}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
        {i < ids.length - 1 && !paused && <button className="btn-ghost btn-sm" onClick={later}>Deixar para depois</button>}
        {mode.pause && <button className="btn-ghost btn-sm" onClick={() => setPaused(!paused)} aria-label={paused ? 'Retomar' : 'Pausar'}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>}
        <button className="btn-ghost btn-sm" onClick={() => setI(ids.length)}>Encerrar</button>
      </div>
      {paused ? <Card className="text-center"><p className="font-semibold">Simulado pausado</p><button className="btn-primary mt-3" onClick={() => setPaused(false)}>Retomar</button></Card> : <QuestionPlayer key={q.id} q={q} mode="simulado" onDone={(a) => { setRes([...res, a]); setI(i + 1); }} />}
    </div>
  );
}

function Result({ mode, ids, res, prev, onBack }: { mode: Mode; ids: string[]; res: Attempt[]; prev: { pct: number }[]; onBack: () => void }) {
  const qs = ids.map((id) => QUESTIONS.find((q) => q.id === id)!) as Question[];
  const correct = res.filter((r) => r.correct).length; const pct = Math.round((correct / ids.length) * 100);
  const byArea = [...new Set(qs.map((q) => q.area))].map((area) => { const aq = qs.filter((q) => q.area === area); const ar = res.filter((r) => aq.some((q) => q.id === r.qid)); return { area, n: aq.length, c: ar.filter((r) => r.correct).length }; });
  // Erros fáceis primeiro: são os que mais afetam a coerência em provas com TRI.
  const rankD = { 'Fácil': 0, 'Média': 1, 'Difícil': 2 } as const; const dOf = (r: Attempt) => rankD[qs.find((q) => q.id === r.qid)!.difficulty];
  const wrong = res.filter((r) => !r.correct).sort((a, b) => dOf(a) - dOf(b));
  const diffErr = ['Fácil', 'Média', 'Difícil'].map((d) => ({ d, n: wrong.filter((r) => qs.find((q) => q.id === r.qid)?.difficulty === d).length }));
  const skills = [...new Set(res.map((r) => r.skillId))].map((s) => ({ s, ok: res.filter((r) => r.skillId === s && r.correct && r.confidence !== 'chute').length, tot: res.filter((r) => r.skillId === s).length }));
  const strong = skills.filter((x) => x.ok === x.tot && x.tot > 0); const weak = skills.filter((x) => x.ok < x.tot);
  // Estimativa EXPERIMENTAL: ponderada por dificuldade e penalizando acertos em fáceis errados (coerência), apenas ilustrativa.
  const w = { 'Fácil': 1, 'Média': 1.6, 'Difícil': 2.3 } as const;
  const score = res.reduce((s, r) => s + (r.correct && r.confidence !== 'chute' ? w[qs.find((q) => q.id === r.qid)!.difficulty] : r.correct ? 0.4 : 0), 0);
  const maxS = qs.reduce((s, q) => s + w[q.difficulty], 0);
  const easyMiss = wrong.filter((r) => qs.find((q) => q.id === r.qid)?.difficulty === 'Fácil').length;
  const tri = Math.round(350 + (score / maxS) * 450 - easyMiss * 15);
  const prevPct = prev.at(-1)?.pct;
  return (
    <div className="space-y-5">
      <PageHeader title={`Resultado · ${mode.name}`} subtitle={`${new Date().toLocaleString('pt-BR')}`}><button className="btn-ghost" onClick={onBack}>Voltar aos simulados</button></PageHeader>
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="!p-4"><div className="muted text-xs">Acertos</div><div className="font-display text-3xl font-bold">{correct}/{ids.length}</div></Card>
        <Card className="!p-4"><div className="muted text-xs">Percentual</div><div className="font-display text-3xl font-bold">{pct}%</div>{prevPct !== undefined && <div className={cx('text-xs font-semibold', pct >= prevPct ? 'text-mint-600' : 'text-red-500')}><TrendingUp size={12} className="inline" /> {pct - prevPct >= 0 ? '+' : ''}{pct - prevPct} p.p. vs. anterior</div>}</Card>
        <Card className="!p-4 sm:col-span-2"><div className="flex items-center gap-2"><span className="muted text-xs">Estimativa no estilo TRI</span><Badge tone="amber"><AlertTriangle size={12} /> Experimental e aproximada</Badge></div><div className="font-display text-3xl font-bold">~{tri}</div><p className="muted text-xs">Heurística ilustrativa (pondera dificuldade e coerência). Não reproduz a TRI oficial nem prevê sua nota.</p></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card><h2 className="section-title mb-3">Desempenho por área</h2>{byArea.map((a) => <div key={a.area} className="mb-3"><div className="mb-1 flex justify-between text-sm"><span>{a.area}</span><span>{a.c}/{a.n}</span></div><Progress value={a.c / a.n} /></div>)}</Card>
        <Card><h2 className="section-title mb-3">Dificuldade dos erros</h2>{diffErr.map((d) => <div key={d.d} className="flex justify-between py-1 text-sm"><span>{d.d}</span><Badge tone={d.n ? 'red' : 'mint'}>{d.n} erro(s)</Badge></div>)}{easyMiss > 0 && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Erros em questões fáceis costumam indicar desatenção — e pesam na coerência em modelos do tipo TRI.</p>}</Card>
        <Card><h2 className="section-title mb-3">Habilidades</h2><div className="text-xs font-semibold text-mint-700 dark:text-mint-400">Fortes</div><ul className="mb-2 text-sm">{strong.map((x) => <li key={x.s}>• {skillById(x.s)?.name}</li>)}{!strong.length && <li className="muted">—</li>}</ul><div className="text-xs font-semibold text-red-600">A fortalecer</div><ul className="text-sm">{weak.map((x) => <li key={x.s}>• {skillById(x.s)?.name}</li>)}{!weak.length && <li className="muted">—</li>}</ul></Card>
      </div>
      <Card><h2 className="section-title mb-3">Plano de recuperação</h2>
        {wrong.length ? <ol className="list-decimal space-y-2 pl-5 text-sm">{wrong.map((r) => { const q = qs.find((x) => x.id === r.qid)!; return <li key={r.id}><strong>{skillById(r.skillId)?.name}</strong> — {r.errorType ? ERROR_LABELS[r.errorType].label : 'erro'}. <Link className="text-mint-700 underline dark:text-mint-400" to={`/questoes/${q.id}`}>Rever correção</Link> · <Link className="text-mint-700 underline dark:text-mint-400" to={`/questoes/${q.id}?gemea=1`}>Questão gêmea</Link>{q.lessonId && <> · <Link className="text-mint-700 underline dark:text-mint-400" to={`/aulas/${q.lessonId}`}>Microaula</Link></>}</li>; })}</ol> : <p className="text-sm">Nenhum erro! Que tal um simulado mais difícil?</p>}
        {wrong.length > 0 && <Link to={`/tutor?modo=corrigir&q=${wrong[0].qid}&a=${wrong[0].id}`} className="btn-primary mt-4"><Bot size={16} /> Corrigir meus erros com a IA</Link>}
      </Card>
    </div>
  );
}
