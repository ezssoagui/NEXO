'use client';

import { useState } from 'react';
import { api, useApi } from '@/lib/api';
import { Badge, Button, Card, Input, Loading, PageHeader, Select } from '@/components/ui';
import { useToast } from '@/components/toast';

interface AiData {
  models: { id: string; purpose: string; model_id: string; status: string; input_usd_per_mtok: string | null; output_usd_per_mtok: string | null; notes: string | null }[];
  prompts: { id: string; purpose: string; version: string; status: string }[];
  byPurpose: { purpose: string; calls: number; ok: number; invalid: number; input_tokens: number; output_tokens: number; cost_usd: string | null; avg_latency: number }[];
  byPlan: { plan: string; calls: number; cost_usd: string | null }[];
  budgets: { period_key: string; budget_usd: string; hard_limit: boolean }[];
  spendMonth: number;
  essayGate: { released: boolean; runId?: string };
  benchmarkRuns: {
    id: string; label: string; dataset_sources: string[]; model_id: string | null; is_test_double: boolean; samples: number; status: 'passed' | 'failed';
    approved_at: string | null; created_at: string;
    metrics: { evaluated: number; failureRate: number; nonDiscrepantRate: number | null; total: { mae: number | null; bias: number | null }; competencies: { competency: number; mae: number; bias: number }[]; bands: Record<string, number> };
    acceptance: { passed: boolean; reasons: string[]; representativeness: string[] };
  }[];
}

const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)}%`);

/** IA (7.10): modelos aprovados manualmente (sem troca automática), prompts versionados, custos e orçamento. */
export default function AdminAi() {
  const { data, loading, reload } = useApi<AiData>('/api/admin/ai');
  const [m, setM] = useState({ purpose: 'essay', modelId: '', input: '', output: '', notes: '' });
  const [budget, setBudget] = useState({ periodKey: new Date().toISOString().slice(0, 7), budgetUsd: 50, hardLimit: true });
  const toast = useToast();
  const post = async (body: unknown) => { try { await api('/api/admin/ai', { body }); toast('success', 'Salvo.'); reload(); } catch (e) { toast('error', (e as Error).message); } };
  if (loading || !data) return <Loading />;
  return (
    <div className="space-y-4">
      <PageHeader title="Inteligência artificial" description={`Gasto no mês: US$ ${data.spendMonth.toFixed(4)}. Chamadas pagas exigem OPENAI_ALLOW_PAID_CALLS=true e modelo aprovado.`} />
      <Card className="space-y-3">
        <h2 className="font-semibold">Modelos</h2>
        <p className="text-sm text-muted">Confirme identificadores, disponibilidade e preços na documentação oficial do fornecedor antes de aprovar. Nenhum modelo vem pré-aprovado.</p>
        <ul className="space-y-1 text-sm">{data.models.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-surface-2 px-3 py-2"><span>{x.purpose} · <code>{x.model_id}</code> · entrada US$ {x.input_usd_per_mtok ?? '?'} / saída US$ {x.output_usd_per_mtok ?? '?'} por 1M tokens</span>
            <span className="flex gap-2"><Badge tone={x.status === 'approved' ? 'success' : 'neutral'}>{x.status}</Badge>{x.status !== 'approved' && <Button size="sm" onClick={() => post({ action: 'approve_model', id: x.id })}>Aprovar</Button>}</span></li>
        ))}</ul>
        <div className="grid gap-2 md:grid-cols-5">
          <Select label="Finalidade" value={m.purpose} onChange={(e) => setM({ ...m, purpose: e.target.value })}>{['essay', 'mini', 'nano', 'validator', 'embedding'].map((p) => <option key={p}>{p}</option>)}</Select>
          <Input label="ID do modelo" value={m.modelId} onChange={(e) => setM({ ...m, modelId: e.target.value })} />
          <Input label="US$/1M entrada" value={m.input} onChange={(e) => setM({ ...m, input: e.target.value })} />
          <Input label="US$/1M saída" value={m.output} onChange={(e) => setM({ ...m, output: e.target.value })} />
          <div className="flex items-end"><Button disabled={!m.modelId} onClick={() => post({ action: 'register_model', model: { purpose: m.purpose, modelId: m.modelId, inputUsdPerMtok: m.input ? Number(m.input) : null, outputUsdPerMtok: m.output ? Number(m.output) : null, notes: m.notes || undefined } })}>Registrar</Button></div>
        </div>
      </Card>
      <Card><h2 className="mb-2 font-semibold">Uso (30 dias)</h2>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted"><tr><th className="p-1">Função</th><th className="p-1">Chamadas</th><th className="p-1">Válidas</th><th className="p-1">Inválidas</th><th className="p-1">Tokens (in/out)</th><th className="p-1">Custo US$</th><th className="p-1">Latência</th></tr></thead>
          <tbody>{data.byPurpose.map((p) => <tr key={p.purpose} className="border-t border-border"><td className="p-1">{p.purpose}</td><td className="p-1">{p.calls}</td><td className="p-1">{p.ok}</td><td className="p-1">{p.invalid}</td><td className="p-1">{p.input_tokens ?? 0}/{p.output_tokens ?? 0}</td><td className="p-1">{Number(p.cost_usd ?? 0).toFixed(4)}</td><td className="p-1">{p.avg_latency ?? '—'} ms</td></tr>)}</tbody></table></div>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">{data.byPlan.map((p) => <Badge key={p.plan}>{p.plan}: {p.calls} · US$ {Number(p.cost_usd ?? 0).toFixed(4)}</Badge>)}</div>
      </Card>
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Benchmark da correção de redação</h2>
          <Badge tone={data.essayGate.released ? 'success' : 'warning'}>{data.essayGate.released ? 'correção liberada para produção' : 'correção bloqueada em produção'}</Badge>
        </div>
        <p className="text-sm text-muted">
          Compara a IA com redações avaliadas por humanos usando o critério oficial de discrepância do Inep (mais de 100 pontos no total ou mais de 80 em uma competência).
          A liberação exige execução aprovada pelos critérios, com o modelo aprovado e o prompt ativo, e aprovação explícita aqui. Execute via <code>POST /api/jobs/essay-benchmark</code>;
          os conjuntos ficam apenas no servidor e nunca entram no RAG.
        </p>
        {data.benchmarkRuns.length === 0 ? <p className="text-sm">Nenhuma execução registrada.</p> : (
          <ul className="space-y-2 text-sm">{data.benchmarkRuns.map((r) => (
            <li key={r.id} className="space-y-1 rounded bg-surface-2 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span><strong>{r.label}</strong> · {new Date(r.created_at).toLocaleString('pt-BR')} · <code>{r.model_id ?? '—'}</code> · {r.samples} redações ({r.dataset_sources.join(', ')})</span>
                <span className="flex gap-2">
                  {r.is_test_double && <Badge>dublê de teste</Badge>}
                  <Badge tone={r.status === 'passed' ? 'success' : 'danger'}>{r.status === 'passed' ? 'atingiu critérios' : 'não atingiu'}</Badge>
                  {r.approved_at ? <Badge tone="success">aprovada</Badge> : r.status === 'passed' && !r.is_test_double && <Button size="sm" onClick={() => post({ action: 'approve_benchmark', id: r.id })}>Aprovar liberação</Button>}
                </span>
              </div>
              <div className="text-muted">
                Sem discrepância: {pct(r.metrics.nonDiscrepantRate)} · erro médio no total: {r.metrics.total.mae ?? '—'} · viés: {r.metrics.total.bias ?? '—'} · falhas: {pct(r.metrics.failureRate)} ·
                por competência (erro/viés): {r.metrics.competencies.map((c) => `C${c.competency} ${c.mae}/${c.bias}`).join(' · ')}
              </div>
              {[...r.acceptance.representativeness, ...r.acceptance.reasons].length > 0 && (
                <ul className="list-disc pl-5 text-xs text-muted">{[...r.acceptance.representativeness, ...r.acceptance.reasons].map((x) => <li key={x}>{x}</li>)}</ul>
              )}
            </li>
          ))}</ul>
        )}
      </Card>
      <Card className="space-y-2"><h2 className="font-semibold">Prompts</h2>
        <ul className="space-y-1 text-sm">{data.prompts.map((p) => <li key={p.id} className="flex justify-between"><span>{p.purpose} · {p.version}</span>{p.status === 'active' ? <Badge tone="success">ativo</Badge> : <Button size="sm" variant="secondary" onClick={() => post({ action: 'activate_prompt', id: p.id })}>Ativar (rollback)</Button>}</li>)}</ul>
      </Card>
      <Card className="space-y-2"><h2 className="font-semibold">Orçamento mensal (alertas 70/90/100%)</h2>
        <div className="flex flex-wrap items-end gap-2">
          <Input label="Mês (AAAA-MM)" value={budget.periodKey} onChange={(e) => setBudget({ ...budget, periodKey: e.target.value })} />
          <Input label="Orçamento US$" type="number" value={budget.budgetUsd} onChange={(e) => setBudget({ ...budget, budgetUsd: Number(e.target.value) })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={budget.hardLimit} onChange={(e) => setBudget({ ...budget, hardLimit: e.target.checked })} /> Limite de segurança no backend</label>
          <Button onClick={() => post({ action: 'set_budget', ...budget })}>Salvar</Button>
        </div>
        <ul className="text-sm text-muted">{data.budgets.map((b) => <li key={b.period_key}>{b.period_key}: US$ {b.budget_usd}{b.hard_limit ? ' (com limite)' : ''}</li>)}</ul>
      </Card>
    </div>
  );
}
