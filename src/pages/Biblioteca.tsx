import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend, Tooltip } from 'recharts';
import { EXAM_DNA, DNA_RADAR } from '../data/demo';
import { LESSONS } from '../data/lessons';
import { questionById } from '../data/questions';
import { ERROR_LABELS } from '../data/skills';
import { PageHeader, Tabs, Card, Badge } from '../components/ui';

export default function Biblioteca() {
  const [tab, setTab] = useState<'dna' | 'cpe' | 'formulas' | 'erros' | 'ia'>('dna');
  const q = questionById('q23')!;
  return (
    <div>
      <PageHeader title="Biblioteca" subtitle="Referências de método, formulário, DNA das provas e transparência sobre o uso de IA." />
      <Tabs tabs={[{ id: 'dna', label: 'DNA da Prova' }, { id: 'cpe', label: 'Método C-P-E' }, { id: 'formulas', label: 'Formulário' }, { id: 'erros', label: 'Tipos de erro' }, { id: 'ia', label: 'IA e revisão' }]} value={tab} onChange={setTab} />
      {tab === 'dna' && <div className="space-y-4">
        <Card><h2 className="section-title mb-1">Perfil de exigência (ilustrativo)</h2><p className="muted mb-2 text-xs">Escala demonstrativa construída pela equipe da NEXO para comparar estilos — não é medida oficial.</p><div className="h-80"><ResponsiveContainer><RadarChart data={DNA_RADAR} outerRadius="70%"><PolarGrid strokeOpacity={0.3} /><PolarAngleAxis dataKey="k" tick={{ fontSize: 11 }} /><Radar name="ENEM" dataKey="ENEM" stroke="#14b88d" fill="#14b88d" fillOpacity={0.25} /><Radar name="Vestibular" dataKey="Vestibular" stroke="#2f5494" fill="#2f5494" fillOpacity={0.15} /><Radar name="Olimpíada" dataKey="Olimpíada" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.1} /><Legend /><Tooltip /></RadarChart></ResponsiveContainer></div></Card>
        <div className="grid gap-4 md:grid-cols-3">{EXAM_DNA.map((e) => <Card key={e.exam}><h3 className="font-bold">{e.exam}</h3><Badge tone={e.status.startsWith('Informações') ? 'mint' : 'amber'}>{e.status}</Badge><dl className="mt-3 space-y-2 text-sm"><div><dt className="muted text-xs">Formato</dt><dd>{e.format}</dd></div><div><dt className="muted text-xs">Pontuação</dt><dd>{e.scoring}</dd></div><div><dt className="muted text-xs">Raciocínio exigido</dt><dd>{e.reasoning}</dd></div><div><dt className="muted text-xs">Competências-chave</dt><dd>{e.strengths.join(' · ')}</dd></div></dl></Card>)}</div>
      </div>}
      {tab === 'cpe' && <div className="space-y-4">
        <Card><h2 className="section-title">Exemplo completo de correção pelo C-P-E</h2><p className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 p-4 text-sm dark:bg-navy-950">{q.context}</p><p className="mt-3 font-medium">{q.statement}</p><ul className="mt-2 space-y-1 text-sm">{q.alternatives!.map((a) => <li key={a.letter} className={a.correct ? 'font-semibold text-mint-700 dark:text-mint-400' : ''}>{a.letter}) {a.text}</li>)}</ul>
          <div className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-navy-50 p-4 dark:bg-navy-800"><div className="font-display text-2xl font-bold text-mint-600">C</div><div className="text-xs font-semibold uppercase">Comando</div><p className="mt-1 text-sm">{q.cpe!.comando}</p></div><div className="rounded-xl bg-navy-50 p-4 dark:bg-navy-800"><div className="font-display text-2xl font-bold text-mint-600">P</div><div className="text-xs font-semibold uppercase">Prova textual</div><p className="mt-1 text-sm">{q.cpe!.prova}</p></div><div className="rounded-xl bg-navy-50 p-4 dark:bg-navy-800"><div className="font-display text-2xl font-bold text-mint-600">E</div><div className="text-xs font-semibold uppercase">Excesso ou erro</div><ul className="mt-1 space-y-1 text-sm">{q.cpe!.excesso.map((e) => <li key={e.letter}><strong>{e.letter} — {e.tipo}:</strong> {e.motivo}</li>)}</ul></div></div>
          <Link to="/questoes/q23" className="btn-primary mt-4">Resolver esta questão</Link></Card>
        <Card><h3 className="font-bold">Quando usar (e quando não usar)</h3><p className="mt-2 text-sm">O C-P-E é a ferramenta principal para questões interpretativas, sobretudo para comparar alternativas próximas. Em problemas de cálculo, prefira: identificar grandezas, reconhecer o que é constante, escolher a relação adequada e conferir unidades.</p><div className="mt-3 grid gap-2 sm:grid-cols-5">{['Extrapolação', 'Generalização', 'Inversão', 'Contradição', 'Relação imprecisa'].map((x) => <Badge key={x} tone="violet">{x}</Badge>)}</div></Card>
      </div>}
      {tab === 'formulas' && <div className="grid gap-3 md:grid-cols-2">{LESSONS.filter((l) => l.formulas.length).map((l) => <Card key={l.id}><div className="flex items-center justify-between"><h3 className="font-bold">{l.title}</h3><Badge>{l.subject}</Badge></div><ul className="mt-2 space-y-2">{l.formulas.map((f) => <li key={f.expr} className="text-sm"><span className="formula">{f.expr}</span> <span className="muted">— {f.when}</span></li>)}</ul></Card>)}</div>}
      {tab === 'erros' && <div className="grid gap-3 md:grid-cols-2">{Object.entries(ERROR_LABELS).map(([k, v]) => <Card key={k} className="!p-4"><div className="font-semibold">{v.label}</div><p className="muted text-sm">{v.tip}</p></Card>)}</div>}
      {tab === 'ia' && <Card className="space-y-3 text-sm"><h2 className="section-title">Transparência sobre IA nesta demonstração</h2><ul className="list-disc space-y-2 pl-5"><li><strong>Tutora, correção de redação, gerador de questões e “aprender ensinando”</strong> funcionam com motores locais baseados em regras e conteúdo curado. Não há modelo de linguagem conectado, e as telas indicam isso.</li><li>Materiais marcados como “rascunho de IA” passam por fila de revisão humana (painel administrativo) antes de serem marcados como revisados.</li><li>Questões geradas são sempre identificadas como “originais geradas” e nunca atribuídas a provas anteriores ou a autores.</li><li>Estimativas de nota (redação e TRI) são formativas e aproximadas — não equivalem a notas oficiais.</li><li>Toda decisão educacional relevante (ex.: reprovar conteúdo, alterar trilha institucional) deve ter revisão humana.</li></ul></Card>}
    </div>
  );
}
