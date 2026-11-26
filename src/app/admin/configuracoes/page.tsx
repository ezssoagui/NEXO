'use client';

import { useState } from 'react';
import { api, fmtDate, useApi } from '@/lib/api';
import { Badge, Button, Card, Input, Loading, PageHeader, Select, Textarea } from '@/components/ui';
import { useToast } from '@/components/toast';

interface S {
  settings: { key: string; value: unknown; status: string; description: string | null }[];
  plans: { code: string; name: string; monthly_price_cents: number | null; annual_price_cents: number | null; price_status: string }[];
  limits: { plan_code: string; resource: string; period: string; limit_value: number | null; version: string }[];
  coupons: { code: string; kind: string; value: number; plan_code: string | null; grant_days: number | null; redeemed_count: number; max_redemptions: number | null; active: boolean }[];
  engine: { id: string; version: string; status: string; notes: string | null; created_at: string }[];
}

/** Configurações versionadas e auditadas (A.3.7). Preços e regras abertas exigem aprovação dos sócios. */
export default function AdminSettings() {
  const { data, loading, reload } = useApi<S>('/api/admin/settings');
  const [coupon, setCoupon] = useState({ code: '', kind: 'access_grant', value: 1, planCode: 'pro', grantDays: 30, maxRedemptions: '' });
  const toast = useToast();
  const post = async (body: unknown) => { try { await api('/api/admin/settings', { body }); toast('success', 'Salvo e auditado.'); reload(); } catch (e) { toast('error', (e as Error).message); } };
  if (loading || !data) return <Loading />;
  return (
    <div className="space-y-4">
      <PageHeader title="Configurações" />
      <Card className="space-y-3"><h2 className="font-semibold">Preços dos planos</h2>
        <p className="text-sm text-muted">Nenhum preço foi aprovado no Documento Mestre. Registre valores somente após decisão dos sócios com custos reais.</p>
        {data.plans.filter((p) => p.code !== 'free').map((p) => <PriceRow key={p.code} p={p} onSave={(b) => post({ action: 'price', plan: p.code, ...b })} />)}
      </Card>
      <Card><h2 className="mb-2 font-semibold">Franquias por plano</h2>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted"><tr><th className="p-1">Plano</th><th className="p-1">Recurso</th><th className="p-1">Período</th><th className="p-1">Limite (vazio = ilimitado)</th></tr></thead>
          <tbody>{data.limits.map((l) => <tr key={l.plan_code + l.resource} className="border-t border-border"><td className="p-1">{l.plan_code}</td><td className="p-1">{l.resource}</td><td className="p-1">{l.period}</td>
            <td className="p-1"><input defaultValue={l.limit_value ?? ''} aria-label={`Limite ${l.plan_code} ${l.resource}`} className="h-8 w-24 rounded border border-border bg-surface px-2" onBlur={(e) => { const v = e.target.value.trim(); const n = v === '' ? null : Number(v); if (n !== l.limit_value) void post({ action: 'limit', plan: l.plan_code, resource: l.resource, limit: n }); }} /></td></tr>)}</tbody></table></div>
      </Card>
      <Card className="space-y-2"><h2 className="font-semibold">Configurações gerais</h2>
        {data.settings.map((s) => <SettingRow key={s.key} s={s} onSave={(value, status) => post({ action: 'setting', key: s.key, value, status })} />)}
      </Card>
      <Card className="space-y-2"><h2 className="font-semibold">Cupons e acessos de campanha</h2>
        <div className="grid gap-2 md:grid-cols-6">
          <Input label="Código" value={coupon.code} onChange={(e) => setCoupon({ ...coupon, code: e.target.value.toUpperCase() })} />
          <Select label="Tipo" value={coupon.kind} onChange={(e) => setCoupon({ ...coupon, kind: e.target.value })}><option value="access_grant">Acesso temporário</option><option value="percent">Desconto %</option></Select>
          <Input label="Valor (% ou 1)" type="number" value={coupon.value} onChange={(e) => setCoupon({ ...coupon, value: Number(e.target.value) })} />
          <Select label="Plano" value={coupon.planCode} onChange={(e) => setCoupon({ ...coupon, planCode: e.target.value })}><option value="plus">Plus</option><option value="pro">Pro</option></Select>
          <Input label="Dias" type="number" value={coupon.grantDays} onChange={(e) => setCoupon({ ...coupon, grantDays: Number(e.target.value) })} />
          <div className="flex items-end"><Button onClick={() => post({ action: 'coupon', coupon: { code: coupon.code, kind: coupon.kind, value: coupon.value, planCode: coupon.planCode, grantDays: coupon.kind === 'access_grant' ? coupon.grantDays : null, maxRedemptions: coupon.maxRedemptions ? Number(coupon.maxRedemptions) : null } })}>Criar</Button></div>
        </div>
        <ul className="text-sm">{data.coupons.map((c) => <li key={c.code}>{c.code} · {c.kind} · {c.plan_code} · {c.redeemed_count}{c.max_redemptions ? `/${c.max_redemptions}` : ''} usos</li>)}</ul>
      </Card>
      <Card><h2 className="mb-2 font-semibold">Parâmetros do motor adaptativo</h2>
        <p className="mb-2 text-sm text-muted">Parâmetros experimentais versionados; novas versões são registradas via API administrativa (ação “engine”) com validação de esquema.</p>
        <ul className="text-sm">{data.engine.map((e) => <li key={e.id} className="flex justify-between"><span>{e.version} · {fmtDate(e.created_at)}</span><Badge tone={e.status === 'active' ? 'success' : 'neutral'}>{e.status}</Badge></li>)}</ul>
      </Card>
    </div>
  );
}

function PriceRow({ p, onSave }: { p: S['plans'][number]; onSave: (b: { monthlyCents: number | null; annualCents: number | null; status: string }) => void }) {
  const [m, setM] = useState(p.monthly_price_cents ? String(p.monthly_price_cents / 100) : '');
  const [a, setA] = useState(p.annual_price_cents ? String(p.annual_price_cents / 100) : '');
  const [st, setSt] = useState(p.price_status);
  const cents = (v: string) => (v.trim() ? Math.round(Number(v.replace(',', '.')) * 100) : null);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <span className="w-12 pb-2 font-medium">{p.name}</span>
      <Input label="Mensal (R$)" value={m} onChange={(e) => setM(e.target.value)} />
      <Input label="Anual (R$)" value={a} onChange={(e) => setA(e.target.value)} />
      <Select label="Situação" value={st} onChange={(e) => setSt(e.target.value)}><option value="not_defined">Não definido</option><option value="pending_approval">Pendente de aprovação</option><option value="approved">Aprovado pelos sócios</option></Select>
      <Button onClick={() => { if (st === 'approved' && !confirm('Confirmar que os sócios aprovaram estes preços?')) return; onSave({ monthlyCents: cents(m), annualCents: cents(a), status: st }); }}>Salvar</Button>
    </div>
  );
}

function SettingRow({ s, onSave }: { s: S['settings'][number]; onSave: (v: unknown, status: string) => void }) {
  const [v, setV] = useState(JSON.stringify(s.value, null, 1));
  const [status, setStatus] = useState(s.status);
  return (
    <details className="rounded-lg border border-border p-3">
      <summary className="flex cursor-pointer justify-between text-sm"><span><code>{s.key}</code> — {s.description}</span><Badge tone={s.status === 'approved' ? 'success' : 'warning'}>{s.status === 'approved' ? 'aprovado' : 'proposta'}</Badge></summary>
      <Textarea rows={4} value={v} onChange={(e) => setV(e.target.value)} className="mt-2 font-mono text-xs" aria-label={s.key} />
      <div className="mt-2 flex gap-2"><Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Situação"><option value="proposal">Proposta</option><option value="approved">Aprovado</option></Select>
        <Button size="sm" onClick={() => { try { onSave(JSON.parse(v), status); } catch { alert('JSON inválido'); } }}>Salvar</Button></div>
    </details>
  );
}
