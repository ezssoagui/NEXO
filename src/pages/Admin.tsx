import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from 'recharts';
import { AlertTriangle, CheckCircle2, Undo2, ClipboardCheck } from 'lucide-react';
import { ADMIN_METRICS as M } from '../data/demo';
import { useStore } from '../store/useStore';
import { USAGE_LABEL, UNIT_COST, type UsageKind } from '../engine/billing';
import { DEFAULT_SRS, type SrsConfig } from '../engine/srs';
import ServerMetrics from '../components/ServerMetrics';
import { PageHeader, Card, Stat, Badge } from '../components/ui';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export default function Admin() {
  const { limits, setLimit, reports, reviewQueue, reviewDecision, generated, setGeneratedStatus, notify, srsConfig, setSrs } = useStore();
  const pendingGen = generated.filter((g) => g.status === 'revisao');
  const ret = M.retentionWeekly.map((v, i) => ({ semana: `S${i}`, retencao: v }));
  const maxCostPlus = (Object.keys(UNIT_COST) as UsageKind[]).reduce((s, k) => s + limits.plus[k] * UNIT_COST[k], 0);
  return (
    <div className="space-y-5">
      <PageHeader title="Painel administrativo" subtitle="Indicadores operacionais e financeiros." />
      <div className="flex gap-2 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"><AlertTriangle size={18} className="shrink-0" />TODOS os números desta página são FICTÍCIOS, criados apenas para demonstração. Não representam usuários, receitas ou custos reais.</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Estudantes cadastrados (fictício)" value={M.students.toLocaleString('pt-BR')} /><Stat label="Ativos em 7 dias (fictício)" value={M.active7d.toLocaleString('pt-BR')} /><Stat label="Conversão Free → Plus (fictício)" value={`${(M.conversion * 100).toFixed(1)}%`} /><Stat label="Receita recorrente simulada" value={brl(M.mrr)} hint={`${M.plusUsers} assinantes Plus`} />
        <Stat label="Correções de redação (fictício)" value={M.essays.toLocaleString('pt-BR')} /><Stat label="Questões resolvidas (fictício)" value={M.solved.toLocaleString('pt-BR')} /><Stat label="Custo IA/usuário Free (simulado)" value={brl(M.aiCostPerUser.free)} /><Stat label="Custo IA/usuário Plus (simulado)" value={brl(M.aiCostPerUser.plus)} hint={`margem ilustrativa ${Math.round((1 - M.aiCostPerUser.plus / 24.9) * 100)}%`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h2 className="section-title mb-2">Retenção semanal por coorte (fictício)</h2><div className="h-60"><ResponsiveContainer><LineChart data={ret}><CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} /><XAxis dataKey="semana" tick={{ fontSize: 11 }} /><YAxis unit="%" tick={{ fontSize: 11 }} /><Tooltip /><Line dataKey="retencao" name="Retenção (%)" stroke="#14b88d" strokeWidth={2.5} /></LineChart></ResponsiveContainer></div></Card>
        <Card><h2 className="section-title mb-2">Receita simulada × custo variável de IA</h2><div className="h-60"><ResponsiveContainer><BarChart data={M.monthly}><CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} /><XAxis dataKey="m" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v: number) => brl(v)} /><Legend /><Bar dataKey="mrr" name="Receita (fictícia)" fill="#2f5494" radius={[6, 6, 0, 0]} /><Bar dataKey="cost" name="Custo IA (fictício)" fill="#f59e0b" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h2 className="section-title mb-3">Conteúdos mais procurados (fictício)</h2><ul className="space-y-2 text-sm">{M.topContents.map((c) => <li key={c.name} className="flex justify-between"><span>{c.name}</span><span className="muted">{c.v.toLocaleString('pt-BR')} acessos</span></li>)}</ul></Card>
        <Card><h2 className="section-title mb-3">Questões e materiais denunciados</h2><ul className="space-y-2 text-sm">{reports.map((r) => <li key={r.id} className="flex justify-between gap-2"><span><strong>{r.target}</strong> — {r.reason}</span><Badge tone="amber">Novo (desta sessão)</Badge></li>)}{M.reports.map((r) => <li key={r.q} className="flex justify-between gap-2"><span><strong>{r.q}</strong> — {r.reason}</span><Badge>{r.status}</Badge></li>)}</ul></Card>
      </div>
      <Card><h2 className="section-title mb-1">Revisão de conteúdo gerado por IA</h2><p className="muted mb-4 text-sm">Conteúdo de IA só entra no banco oficial ou é marcado como revisado após aprovação humana. Esta fila usa dados reais da sessão (não fictícios).</p>
        <div className="space-y-3">
          {pendingGen.map((g) => <div key={g.q.id} className="rounded-xl border border-slate-200 p-4 dark:border-navy-700"><div className="flex flex-wrap items-center gap-2"><Badge tone="violet">Questão gerada</Badge><span className="font-mono text-xs">{g.q.id}</span><Badge tone="amber">pendente</Badge></div><p className="mt-2 text-sm">{g.q.context}</p><p className="text-sm font-medium">{g.q.statement}</p><ul className="mt-1 text-xs">{g.q.alternatives!.map((a) => <li key={a.letter}>{a.letter}) {a.text}{a.correct && ' ✓'}</li>)}</ul><ul className="mt-2 text-xs">{g.validation.map((v) => <li key={v.check}>{v.ok ? '✓' : '✗'} {v.check}: {v.detail}</li>)}</ul><div className="mt-3 flex gap-2"><button className="btn-primary btn-sm" onClick={() => { setGeneratedStatus(g.q.id, 'aprovada'); notify('Aprovada e publicada no banco.'); }}><CheckCircle2 size={14} /> Aprovar</button><button className="btn-ghost btn-sm" onClick={() => setGeneratedStatus(g.q.id, 'rejeitada')}><Undo2 size={14} /> Rejeitar</button></div></div>)}
          {reviewQueue.map((r) => <div key={r.id} className="rounded-xl border border-slate-200 p-4 dark:border-navy-700"><div className="flex flex-wrap items-center gap-2"><Badge tone={r.kind === 'questao' ? 'violet' : 'sky'}>{r.kind === 'questao' ? 'Questão' : 'Material'}</Badge><span className="text-sm font-medium">{r.title}</span><Badge tone={r.status === 'aprovado' ? 'mint' : r.status === 'devolvido' ? 'red' : 'amber'}>{r.status}</Badge></div>{r.note && <p className="muted mt-1 text-xs">Nota: {r.note}</p>}{r.status === 'pendente' && <div className="mt-3 flex gap-2"><button className="btn-primary btn-sm" onClick={() => reviewDecision(r.id, 'aprovado', 'Conferido: conceitos, exemplos e linguagem adequados.')}><ClipboardCheck size={14} /> Aprovar</button><button className="btn-ghost btn-sm" onClick={() => reviewDecision(r.id, 'devolvido', 'Solicitar ajuste de exemplos e verificação de dados.')}>Devolver para ajuste</button></div>}</div>)}
          {!pendingGen.length && !reviewQueue.length && <p className="muted text-sm">Nada pendente.</p>}
        </div>
      </Card>
      <ServerMetrics />
      <Card><h2 className="section-title mb-1">Parâmetros da repetição espaçada</h2><p className="muted mb-3 text-sm">Algoritmo configurável e documentado (inspirado no SM-2). Valores iniciais são experimentais — calibre-os com dados reais de retenção.</p>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">{(Object.keys(DEFAULT_SRS) as (keyof SrsConfig)[]).map((k) => <label key={k} className="text-xs"><span className="muted block">{k}</span><input type="number" step="0.05" className="input !py-1" value={srsConfig[k]} onChange={(e) => setSrs({ [k]: +e.target.value } as Partial<SrsConfig>)} /></label>)}</div>
        <button className="btn-ghost btn-sm mt-3" onClick={() => { setSrs(DEFAULT_SRS); notify('Parâmetros restaurados.'); }}>Restaurar padrão</button>
      </Card>
      <Card><h2 className="section-title mb-1">Controle de consumo de IA por usuário</h2><p className="muted mb-4 text-sm">Limites mensais configuráveis por plano. Aplicados imediatamente na demonstração (tutora, redação e gerador).</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="muted text-left text-xs"><tr><th className="py-2">Recurso</th><th>Custo unitário (fictício)</th><th>Limite Free</th><th>Limite Plus</th></tr></thead><tbody>{(Object.keys(USAGE_LABEL) as UsageKind[]).map((k) => <tr key={k} className="border-t border-slate-100 dark:border-navy-800"><td className="py-2">{USAGE_LABEL[k]}</td><td>{brl(UNIT_COST[k])}</td><td><input aria-label={`Limite Free ${k}`} type="number" min={0} className="input !w-24 !py-1" value={limits.free[k]} onChange={(e) => setLimit('free', k, +e.target.value)} /></td><td><input aria-label={`Limite Plus ${k}`} type="number" min={0} className="input !w-24 !py-1" value={limits.plus[k]} onChange={(e) => setLimit('plus', k, +e.target.value)} /></td></tr>)}</tbody></table></div>
        <p className="mt-3 text-sm">Custo máximo de IA por assinante Plus com estes limites: <strong>{brl(maxCostPlus)}</strong> de {brl(24.9)} ({Math.round((maxCostPlus / 24.9) * 100)}% do preço). {maxCostPlus / 24.9 > 0.35 ? <span className="text-red-600">Acima do teto sugerido de 35% — risco de inviabilidade.</span> : <span className="text-mint-700 dark:text-mint-400">Dentro do teto sugerido de 35%.</span>}</p>
      </Card>
    </div>
  );
}
