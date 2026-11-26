'use client';

import { useState } from 'react';
import { api, fmtDate, useApi } from '@/lib/api';
import { Badge, Button, Card, Input, Loading, Modal, PageHeader, Select } from '@/components/ui';
import { useToast } from '@/components/toast';

interface UserRow { id: string; email: string; display_name: string; enem_target_year: number; created_at: string; suspended_at: string | null; last_activity: string | null; roles: string | null; guardian_consent_status: string }
interface Detail { profile: { email: string; display_name: string; suspension_reason: string | null }; plan: { plan: string; source: string; until: string | null }; subscriptions: { id: string; plan_code: string; status: string; current_period_end: string | null }[]; grants: { id: string; plan_code: string; ends_at: string; reason: string; revoked_at: string | null }[]; usage: { resource: string; period_key: string; n: number }[]; aiCostUsd: number }

/** Usuários e assinaturas (12.4): sem acesso a senhas e sem edição de resultados pedagógicos. */
export default function AdminUsers() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const { data, loading, reload } = useApi<{ items: UserRow[] }>(`/api/admin/users?page=1${search ? `&q=${encodeURIComponent(search)}` : ''}`);
  const [sel, setSel] = useState<string | null>(null);
  const { data: detail, reload: reloadDetail } = useApi<Detail>(sel ? `/api/admin/users/${sel}` : null);
  const [grant, setGrant] = useState({ plan: 'pro', days: 30, reason: 'piloto' });
  const toast = useToast();
  const act = async (body: unknown) => { try { await api(`/api/admin/users/${sel}`, { body }); toast('success', 'Registrado e auditado.'); reloadDetail(); reload(); } catch (e) { toast('error', (e as Error).message); } };
  return (
    <div>
      <PageHeader title="Usuários" />
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(q); }}><Input aria-label="Buscar por e-mail ou nome" value={q} onChange={(e) => setQ(e.target.value)} placeholder="E-mail ou nome" /><Button type="submit">Buscar</Button></form>
      {loading ? <Loading /> : (
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted"><tr><th className="p-2">E-mail</th><th className="p-2">Nome</th><th className="p-2">ENEM</th><th className="p-2">Cadastro</th><th className="p-2">Última atividade</th><th className="p-2">Status</th></tr></thead>
          <tbody>{data?.items.map((u) => (
            <tr key={u.id} className="cursor-pointer border-t border-border hover:bg-surface-2" onClick={() => setSel(u.id)}>
              <td className="p-2">{u.email}</td><td className="p-2">{u.display_name}</td><td className="p-2">{u.enem_target_year}</td><td className="p-2">{fmtDate(u.created_at)}</td><td className="p-2">{fmtDate(u.last_activity)}</td>
              <td className="p-2">{u.suspended_at ? <Badge tone="danger">suspenso</Badge> : u.roles?.includes('admin') ? <Badge tone="primary">admin</Badge> : <Badge>ativo</Badge>}</td>
            </tr>
          ))}</tbody></table></div>
      )}
      <Modal open={Boolean(sel)} onClose={() => setSel(null)} title="Usuário" wide>
        {!detail ? <Loading /> : (
          <div className="space-y-4 text-sm">
            <p><strong>{detail.profile.display_name}</strong> · {detail.profile.email}</p>
            <p>Plano efetivo: <Badge tone="primary">{detail.plan.plan}</Badge> ({detail.plan.source}{detail.plan.until ? ` até ${fmtDate(detail.plan.until)}` : ''}) · Custo de IA acumulado: US$ {detail.aiCostUsd.toFixed(4)}</p>
            <Card className="space-y-2"><h3 className="font-semibold">Conceder acesso temporário</h3>
              <div className="flex flex-wrap items-end gap-2">
                <Select label="Plano" value={grant.plan} onChange={(e) => setGrant({ ...grant, plan: e.target.value })}><option value="plus">Plus</option><option value="pro">Pro</option></Select>
                <Input label="Dias" type="number" value={grant.days} onChange={(e) => setGrant({ ...grant, days: Number(e.target.value) })} />
                <Input label="Motivo" value={grant.reason} onChange={(e) => setGrant({ ...grant, reason: e.target.value })} />
                <Button onClick={() => act({ action: 'grant', ...grant })}>Conceder</Button>
              </div>
              <ul>{detail.grants.map((g) => <li key={g.id} className="flex justify-between"><span>{g.plan_code} até {fmtDate(g.ends_at)} · {g.reason}{g.revoked_at ? ' (revogado)' : ''}</span>{!g.revoked_at && <button className="text-danger" onClick={async () => { await api(`/api/admin/grants/${g.id}`, { method: 'DELETE' }); reloadDetail(); }}>revogar</button>}</li>)}</ul>
            </Card>
            <Card className="space-y-2"><h3 className="font-semibold">Suspensão (justificada e auditada)</h3>
              {detail.profile.suspension_reason ? <><p>Motivo: {detail.profile.suspension_reason}</p><Button variant="secondary" onClick={() => act({ action: 'unsuspend' })}>Reativar</Button></>
                : <Button variant="danger" onClick={() => { const reason = prompt('Justificativa (mín. 10 caracteres):'); if (reason) void act({ action: 'suspend', reason }); }}>Suspender</Button>}
            </Card>
            <Card><h3 className="mb-1 font-semibold">Uso de franquias</h3><ul>{detail.usage.map((u, i) => <li key={i}>{u.resource} · {u.period_key}: {u.n}</li>)}</ul></Card>
          </div>
        )}
      </Modal>
    </div>
  );
}
