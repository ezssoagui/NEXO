import { useState } from 'react';
import { GraduationCap, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { TEACH_TOPICS, evaluateTeaching } from '../engine/tutor';
import { skillById } from '../data/skills';
import { useStore } from '../store/useStore';
import { PageHeader, Card, DemoBadge, Progress } from '../components/ui';

export default function Ensinar() {
  const [t, setT] = useState(0); const [text, setText] = useState(''); const [res, setRes] = useState<ReturnType<typeof evaluateTeaching> | null>(null);
  const addXP = useStore((s) => s.addXP);
  const topic = TEACH_TOPICS[t];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Aprender ensinando" subtitle="Explique como se estivesse ensinando um colega. A NEXO verifica se os conceitos fundamentais aparecem, aponta lacunas e faz perguntas para aprofundar."><DemoBadge label="Verificação por conceitos-chave" /></PageHeader>
      <Card>
        <label className="label" htmlFor="tt">Conteúdo</label>
        <select id="tt" className="input" value={t} onChange={(e) => { setT(+e.target.value); setRes(null); setText(''); }}>{TEACH_TOPICS.map((x, i) => <option key={x.skill} value={i}>{skillById(x.skill)?.name}</option>)}</select>
        <div className="mt-4 flex gap-2 rounded-xl bg-navy-50 p-4 text-sm dark:bg-navy-800"><GraduationCap size={18} className="shrink-0 text-mint-600" /><span><strong>Sua missão:</strong> {topic.prompt}</span></div>
        <label className="label mt-4" htmlFor="ex">Sua explicação</label>
        <textarea id="ex" rows={7} className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Comece pelo conceito central e avance passo a passo…" />
        <button className="btn-primary mt-3" disabled={text.split(/\s+/).length < 10} onClick={() => { const r = evaluateTeaching(topic.skill, text); setRes(r); if (r.coverage === 1) addXP(20, 'Explicação completa (aprender ensinando)', `teach-${topic.skill}`); }}>Avaliar minha explicação</button>
      </Card>
      {res && <Card className="mt-4">
        <div className="mb-2 flex items-center justify-between"><h2 className="section-title">Cobertura dos conceitos fundamentais</h2><span className="font-bold">{Math.round(res.coverage * 100)}%</span></div><Progress value={res.coverage} />
        <ul className="mt-4 space-y-1 text-sm">{res.found.map((f) => <li key={f} className="flex gap-2"><CheckCircle2 size={16} className="text-mint-600" /> {f}</li>)}{res.missing.map((f) => <li key={f} className="flex gap-2"><XCircle size={16} className="text-red-500" /> Lacuna: {f}</li>)}</ul>
        <h3 className="mt-4 font-semibold">Perguntas para aprofundar</h3><ul className="mt-2 space-y-2 text-sm">{res.questions.map((q) => <li key={q} className="flex gap-2"><HelpCircle size={16} className="mt-0.5 shrink-0 text-sky-600" />{q}</li>)}</ul>
        <p className="muted mt-4 text-xs">A verificação procura conceitos-chave por padrões textuais; uma explicação correta com outras palavras pode não ser reconhecida. Em produção, um modelo de linguagem com rubrica faria essa análise.</p>
      </Card>}
    </div>
  );
}
