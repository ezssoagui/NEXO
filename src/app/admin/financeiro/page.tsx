'use client';

import { useState } from 'react';
import { api, useApi } from '@/lib/api';
import { Badge, Button, Card, Input, Loading, PageHeader, Select } from '@/components/ui';
import { useToast } from '@/components/toast';

interface Fin { revenue: { month: string; gross_cents: number; net_cents: number; payments: number }[]; ai: { month: string; usd: string | null; unpriced_calls: number }[]; expenses: { month: string; category: string; cents: number; has_estimates: boolean }[]; marketing: { month: string; channel: string; spend_cents: number; signups: number | null }[]; mrrCents: number; churn30d: { canceled: number; active: number }; notes: string }
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Financeiro híbrido (12.6): automáticos (Asaas, IA) + despesas manuais; distingue caixa e MRR. */
export default function AdminFinance() {
  const { data, loading, reload } = useApi<Fin>('/api/admin/finance');
  const [exp, setExp] = useState({ category: 'infrastructure', description: '', amount: '', month: new Date().toISOString().slice(0, 7), isEstimate: false });
  const [mk, setMk] = useState({ month: new Date().toISOString().slice(0, 7), channel: 'meta_ads', spend: '', signups: '' });
  const toast = useToast();
  const post = async (body: unknown) => { try { await api('/api/admin/finance', { body }); toast('success', 'Registrado.'); reload(); } catch (e) { toast('error', (e as Error).message); } };
  if (loading || !data) return <Loading />;
  return (
    <div className="space-y-4">
      <PageHeader title="Financeiro" description={data.notes} />
      <Card className="flex flex-wrap gap-6"><div><div className="text-xs text-muted">MRR</div><div className="text-2xl font-semibold">{brl(data.mrrCents)}</div></div><div><div className="text-xs text-muted">Cancelamentos (30 dias)</div><div className="text-2xl font-semibold">{data.churn30d.canceled} / {data.churn30d.active} ativos</div></div></Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><h2 className="mb-2 font-semibold">Recebimentos (caixa)</h2>{data.revenue.length === 0 ? <p className="text-sm text-muted">Nenhum pagamento confirmado.</p> : <ul className="text-sm">{data.revenue.map((r) => <li key={r.month} className="flex justify-between"><span>{r.month}</span><span>{brl(r.gross_cents)} bruto · {brl(r.net_cents)} líquido</span></li>)}</ul>}</Card>
        <Card><h2 className="mb-2 font-semibold">Custos de IA</h2>{data.ai.length === 0 ? <p className="text-sm text-muted">Sem chamadas.</p> : <ul className="text-sm">{data.ai.map((a) => <li key={a.month} className="flex justify-between"><span>{a.month}</span><span>US$ {Number(a.usd ?? 0).toFixed(2)}{a.unpriced_calls ? ` (+${a.unpriced_calls} sem preço)` : ''}</span></li>)}</ul>}</Card>
        <Card><h2 className="mb-2 font-semibold">Despesas manuais</h2><ul className="text-sm">{data.expenses.map((e, i) => <li key={i} className="flex justify-between"><span>{e.month} · {e.category}</span><span>{brl(e.cents)} {e.has_estimates && <Badge tone="warning">estimativa</Badge>}</span></li>)}</ul></Card>
        <Card><h2 className="mb-2 font-semibold">Marketing</h2><ul className="text-sm">{data.marketing.map((m, i) => <li key={i} className="flex justify-between"><span>{m.month} · {m.channel}</span><span>{brl(m.spend_cents)} · {m.signups ?? '—'} cadastros</span></li>)}</ul></Card>
      </div>
      <Card className="space-y-2"><h2 className="font-semibold">Registrar despesa</h2>
        <div className="grid gap-2 md:grid-cols-6">
          <Select label="Categoria" value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })}>{['infrastructure', 'marketing', 'accounting', 'taxes', 'domain', 'other'].map((c) => <option key={c}>{c}</option>)}</Select>
          <Input label="Descrição" value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} />
          <Input label="Valor (R$)" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} inputMode="decimal" />
          <Input label="Competência" value={exp.month} onChange={(e) => setExp({ ...exp, month: e.target.value })} />
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={exp.isEstimate} onChange={(e) => setExp({ ...exp, isEstimate: e.target.checked })} /> Estimativa</label>
          <div className="flex items-end"><Button onClick={() => post({ action: 'expense', expense: { category: exp.category, description: exp.description, amountCents: Math.round(Number(exp.amount.replace(',', '.')) * 100), competenceMonth: exp.month, isEstimate: exp.isEstimate } })}>Salvar</Button></div>
        </div>
      </Card>
      <Card className="space-y-2"><h2 className="font-semibold">Registrar marketing</h2>
        <div className="grid gap-2 md:grid-cols-5">
          <Input label="Mês" value={mk.month} onChange={(e) => setMk({ ...mk, month: e.target.value })} />
          <Input label="Canal" value={mk.channel} onChange={(e) => setMk({ ...mk, channel: e.target.value })} />
          <Input label="Gasto (R$)" value={mk.spend} onChange={(e) => setMk({ ...mk, spend: e.target.value })} />
          <Input label="Cadastros" value={mk.signups} onChange={(e) => setMk({ ...mk, signups: e.target.value })} />
          <div className="flex items-end"><Button onClick={() => post({ action: 'marketing', month: mk.month, channel: mk.channel, spendCents: Math.round(Number(mk.spend.replace(',', '.') || 0) * 100), signups: mk.signups ? Number(mk.signups) : undefined })}>Salvar</Button></div>
        </div>
      </Card>
    </div>
  );
}
