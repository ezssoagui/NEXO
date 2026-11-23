import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { DIAGNOSTIC_IDS, questionById } from '../data/questions';
import { useStore } from '../store/useStore';
import QuestionPlayer from '../components/QuestionPlayer';
import { Logo, Progress, Badge } from '../components/ui';
import type { Attempt } from '../types';
import { ERROR_LABELS, skillById } from '../data/skills';
import { weekPlan } from '../engine/recommend';

export default function Diagnostico() {
  const nav = useNavigate(); const { finishDiagnostic, profile, attempts } = useStore();
  const [i, setI] = useState(0); const [results, setResults] = useState<Attempt[]>([]);
  const done = i >= DIAGNOSTIC_IDS.length;
  const q = !done ? questionById(DIAGNOSTIC_IDS[i])! : null;
  const plan = done ? weekPlan(profile, attempts) : [];
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-navy-950">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between"><Logo /><button className="muted text-xs underline" onClick={() => { finishDiagnostic(); nav('/inicio'); }}>Pular diagnóstico</button></div>
        {!done ? <>
          <h1 className="text-xl font-bold">Diagnóstico inicial · {i + 1} de {DIAGNOSTIC_IDS.length}</h1>
          <p className="muted mb-3 text-sm">Seis habilidades diferentes. Sem correção agora — responda com honestidade, inclusive o grau de confiança.</p>
          <Progress value={i / DIAGNOSTIC_IDS.length} className="mb-5" />
          <QuestionPlayer q={q!} mode="diagnostico" onDone={(a) => { setResults([...results, a]); setI(i + 1); }} />
        </> : (
          <div className="card animate-fadeUp !p-6">
            <h1 className="text-2xl font-bold">Seu ponto de partida, {profile?.nickname}</h1>
            <p className="muted mt-1">Acertos sólidos: {results.filter((r) => r.correct && r.confidence !== 'chute').length} de {results.length}. Isso não é uma nota — é um mapa para começar.</p>
            <ul className="mt-5 space-y-2">{results.map((r) => <li key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-navy-700">{r.correct ? <CheckCircle2 className="text-mint-600" size={18} /> : <XCircle className="text-red-500" size={18} />}<span className="flex-1">{skillById(r.skillId)?.name}</span>{r.errorType && <Badge tone="red">{ERROR_LABELS[r.errorType].label}</Badge>}{r.correct && r.confidence === 'chute' && <Badge tone="amber">chute</Badge>}</li>)}</ul>
            <h2 className="mt-6 text-lg font-bold">Plano inicial adaptativo da semana</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{plan.slice(0, 6).map((d) => <div key={d.day} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-navy-950"><div className="font-semibold">{d.day} · {d.minutes} min</div><ul className="muted mt-1 list-disc pl-4 text-xs">{d.tasks.map((t) => <li key={t}>{t}</li>)}</ul></div>)}</div>
            <button className="btn-primary mt-6" onClick={() => { finishDiagnostic(); nav('/inicio'); }}>Ir para meu painel <ArrowRight size={16} /></button>
          </div>
        )}
      </div>
    </div>
  );
}
