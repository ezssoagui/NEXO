import { Link } from 'react-router-dom';
import { Search, FileBarChart, GraduationCap } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useStore } from '../store/useStore';
import { PageHeader, Card, Badge } from '../components/ui';
import { EvolutionChart, SubjectRadar } from '../components/charts';
import { allMastery, MASTERY_COLOR, MASTERY_LABEL, subjectStats } from '../engine/mastery';
import { detectPatterns, errorDistribution } from '../engine/detective';
import { ERROR_LABELS } from '../data/skills';
import { EVIDENCE_LABEL } from '../engine/evidence';
import { SITUATION_LABEL } from '../engine/intervention';
import CyclesCard from '../components/CyclesCard';
import { recommendForSkill, NEXT_LABEL } from '../engine/learning';
import { masteryIndicators } from '../engine/mastery';
import { CAUSE_LABELS, prerequisitesOf, skillById } from '../data/skills';
import type { Evidence } from '../types';

export default function Desempenho() {
  const { attempts, interventionLog, skillReviews } = useStore();
  const m = allMastery(attempts); const insights = detectPatterns(attempts); const dist = errorDistribution(attempts);
  const conf = ['certeza', 'duvida', 'chute', 'nao_consegui'].map((c) => { const a = attempts.filter((x) => x.confidence === c); return { c: { certeza: 'Certeza', duvida: 'Dúvida', chute: 'Chute', nao_consegui: 'Não consegui' }[c]!, total: a.length, acerto: a.length ? Math.round((a.filter((x) => x.correct).length / a.length) * 100) : 0 }; });
  return (
    <div className="space-y-5">
      <PageHeader title="Meu desempenho" subtitle="Domínio demonstrado, padrões de erro e calibração da sua confiança.">
        <Link to="/portfolio" className="btn-ghost"><FileBarChart size={16} /> Meu portfólio</Link><Link to="/ensinar" className="btn-ghost"><GraduationCap size={16} /> Aprender ensinando</Link>
      </PageHeader>
      <Card><div className="mb-3 flex items-center gap-2"><Search size={18} className="text-mint-600" /><h2 className="section-title">Detetive de Erros</h2></div>
        {insights.length ? <div className="grid gap-3 md:grid-cols-2">{insights.slice(0, 4).map((ins) => <div key={ins.title} className="rounded-xl border border-slate-200 p-4 dark:border-navy-700"><div className="flex items-center gap-2"><Badge tone="red">{ERROR_LABELS[ins.errorType].label}</Badge><span className="muted text-xs">{ins.count}x</span></div><div className="mt-2 font-semibold">{ins.title}</div><p className="muted text-sm">{ins.detail}</p><div className="mt-2 text-xs font-semibold">Sequência sugerida:</div><ol className="list-decimal pl-5 text-xs">{ins.sequence.map((s) => <li key={s}>{s}</li>)}</ol>{ins.skillId && <Link to={`/questoes?skill=${ins.skillId}`} className="btn-primary btn-sm mt-3">Começar sequência</Link>}</div>)}</div> : <p className="muted text-sm">Ainda não há padrões recorrentes. Continue resolvendo — o detetive precisa de pelo menos 2 ocorrências semelhantes.</p>}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h2 className="section-title mb-2">Qualidade dos acertos e erros</h2><p className="muted mb-3 text-xs">Confiança alta não prova domínio, e dúvida não prova desconhecimento: o Radar combina estas evidências, com peso maior para questões inéditas.</p>
          {(() => { const counts: Partial<Record<Evidence, number>> = {}; attempts.forEach((a) => { if (a.evidence) counts[a.evidence] = (counts[a.evidence] ?? 0) + 1; }); const rows = Object.entries(counts) as [Evidence, number][]; return rows.length ? <ul className="space-y-1 text-sm">{rows.sort((a, b) => b[1] - a[1]).map(([e, n]) => <li key={e} className="flex justify-between"><span>{EVIDENCE_LABEL[e]}</span><Badge>{n}</Badge></li>)}</ul> : <p className="muted text-sm">Sem respostas ainda.</p>; })()}
          {m.some((x) => x.fragile || x.regressed) && <div className="mt-3 space-y-1 text-xs">{m.filter((x) => x.regressed).map((x) => <p key={x.skillId} className="text-red-600">⚠ Domínio aparente com falha posterior: {x.skill.name}</p>)}{m.filter((x) => x.fragile).map((x) => <p key={x.skillId} className="text-amber-700 dark:text-amber-300">◐ Acerto frágil, verificação priorizada: {x.skill.name}</p>)}</div>}
        </Card>
        <CyclesCard limit={6} />
      </div>
      <Card><h2 className="section-title mb-2">Intervenções pedagógicas registradas</h2><p className="muted mb-3 text-xs">Histórico local das hipóteses e intervenções escolhidas (base para avaliar o que funciona).</p>
        {interventionLog.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="muted text-left text-xs"><tr><th className="py-1">Quando</th><th>Questão</th><th>Hipótese</th><th>Intervenção</th><th>Resultado</th></tr></thead><tbody>{[...interventionLog].reverse().slice(0, 10).map((e, i) => <tr key={i} className="border-t border-slate-100 dark:border-navy-800"><td className="py-1.5 text-xs">{new Date(e.ts).toLocaleString('pt-BR')}</td><td>{e.qid}</td><td>{e.cause ? CAUSE_LABELS[e.cause].label : SITUATION_LABEL[e.situation]} (confiança {e.confidence >= 0.75 ? 'alta' : e.confidence >= 0.5 ? 'média' : 'baixa'})</td><td>{e.intervention}</td><td>{e.outcome ?? '—'}</td></tr>)}</tbody></table></div> : <p className="muted text-sm">Nenhuma ainda.</p>}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h2 className="section-title mb-2">Radar por disciplina</h2><SubjectRadar data={subjectStats(attempts)} /></Card>
        <Card><h2 className="section-title mb-2">Evolução</h2><EvolutionChart attempts={attempts} /></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h2 className="section-title mb-2">Tipos de erro</h2>{dist.length ? <div className="h-64"><ResponsiveContainer><BarChart data={dist} layout="vertical" margin={{ left: 30 }}><CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" name="Ocorrências" fill="#2f5494" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div> : <p className="muted text-sm">Sem erros registrados.</p>}</Card>
        <Card><h2 className="section-title mb-2">Calibração da confiança</h2><p className="muted mb-3 text-xs">Comparar sua confiança com o acerto real ajuda a perceber quando você “acha que sabe”.</p><table className="w-full text-sm"><thead><tr className="muted text-left text-xs"><th>Confiança</th><th>Respostas</th><th>Acerto</th></tr></thead><tbody>{conf.map((c) => <tr key={c.c} className="border-t border-slate-100 dark:border-navy-800"><td className="py-2">{c.c}</td><td>{c.total}</td><td>{c.total ? `${c.acerto}%` : '—'}</td></tr>)}</tbody></table></Card>
      </div>
      <Card><h2 className="section-title mb-1">Radar de Domínio — detalhes por habilidade</h2><p className="muted mb-3 text-xs">Indicadores interpretáveis (contagens reais) e a recomendação do Motor de Domínio, recalculada a cada nova evidência.</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="muted text-left text-xs"><tr><th className="py-2">Habilidade</th><th>Estado</th><th>Evidências</th><th>Retenção</th><th>Recomendação</th></tr></thead>
          <tbody>{m.filter((x) => x.attempts > 0).map((x) => { const ind = masteryIndicators(attempts, x.skillId); const rec = recommendForSkill(x.skillId, attempts, skillReviews); return <tr key={x.skillId} className="border-t border-slate-100 align-top dark:border-navy-800"><td className="py-2 font-medium">{x.skill.name}{prerequisitesOf(x.skillId).length > 0 && <div className="muted text-[11px]">pré-requisito: {prerequisitesOf(x.skillId).map((p) => skillById(p)?.name).join(', ')}</div>}</td><td><span className="chip" style={{ background: MASTERY_COLOR[x.state] + '33', color: 'inherit' }}>{MASTERY_LABEL[x.state]}</span>{x.regressed && <div className="text-[11px] text-red-600">falhou após domínio</div>}{x.fragile && <div className="text-[11px] text-amber-600">acerto frágil</div>}</td><td className="text-xs">{ind.secure} seguro(s) · {ind.doubt} com dúvida · {ind.guess} tentativa(s) · {ind.wrong} erro(s) · {ind.novelCorrect} inédita(s) · {ind.hints} dica(s)</td><td className="text-xs">{ind.reviews ? `${ind.retained}/${ind.reviews} revisões` : '—'}</td><td className="text-xs"><Badge tone={rec.action === 'prerequisitos' ? 'red' : rec.action === 'revisao' ? 'amber' : rec.action === 'desafio' ? 'violet' : 'sky'}>{NEXT_LABEL[rec.action]}</Badge><div className="muted mt-1">{rec.reason}</div></td></tr>; })}</tbody></table></div>
        {m.every((x) => x.attempts === 0) && <p className="muted text-sm">Sem dados ainda.</p>}
        <p className="muted mt-3 text-xs">Regras: cada resposta vale conforme a evidência (compreensão demonstrada, confiança, dúvida, tentativa, dicas, raciocínio incorreto), com peso maior para respostas recentes e questões inéditas. Domínio provisório exige acertos sólidos repetidos ou comprovação em questão inédita; um único acerto nunca basta. Consistente exige também acertos em dias diferentes.</p>
      </Card>
    </div>
  );
}
