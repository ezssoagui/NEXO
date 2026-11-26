'use client';

import { useState } from 'react';
import { api, fmtDate, useApi } from '@/lib/api';
import { Badge, Button, Card, Loading, PageHeader } from '@/components/ui';
import { useToast } from '@/components/toast';

interface Mon { alerts: { id: string; kind: string; severity: string; message: string; created_at: string; acknowledged_at: string | null }[]; webhooks: { event_type: string; status: string; n: number; last: string }[]; backups: { kind: string; status: string; started_at: string; size_bytes: number | null; location_hint: string | null }[]; aiFailures: { purpose: string; status: string; n: number }[]; lastBackupOk: string | null }

/** Monitoramento (12.7/13.5): alertas, webhooks, falhas de IA e registro de backups/restauração. */
export default function AdminMonitoring() {
  const { data, loading, reload } = useApi<Mon>('/api/admin/monitoring');
  const toast = useToast();
  const [now] = useState(() => Date.now());
  if (loading || !data) return <Loading />;
  const stale = !data.lastBackupOk || now - Date.parse(data.lastBackupOk) > 72 * 3600e3;
  return (
    <div className="space-y-4">
      <PageHeader title="Monitoramento" />
      <Card className={stale ? 'border-danger/50' : ''}><h2 className="font-semibold">Backups</h2><p className="text-sm">{data.lastBackupOk ? `Último backup bem-sucedido: ${fmtDate(data.lastBackupOk)}` : 'Nenhum backup registrado.'} {stale && <Badge tone="danger">fora da janela de 72 h</Badge>}</p>
        <p className="mt-1 text-xs text-muted">Execute scripts/backup (pg_dump criptografado para armazenamento externo) a cada 3 dias e registre aqui; teste de restauração mensal.</p>
        <ul className="mt-2 text-sm">{data.backups.map((b, i) => <li key={i}>{fmtDate(b.started_at)} · {b.kind} · {b.status}{b.location_hint ? ` · ${b.location_hint}` : ''}</li>)}</ul>
      </Card>
      <Card><h2 className="mb-2 font-semibold">Alertas</h2>
        {data.alerts.length === 0 ? <p className="text-sm text-muted">Nenhum alerta.</p> : <ul className="space-y-1 text-sm">{data.alerts.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-surface-2 px-3 py-2"><span><Badge tone={a.severity === 'critical' || a.severity === 'high' ? 'danger' : 'warning'}>{a.severity}</Badge> {a.message} <span className="text-xs text-muted">· {fmtDate(a.created_at)}</span></span>
            {!a.acknowledged_at && <Button size="sm" variant="secondary" onClick={async () => { try { await api('/api/admin/monitoring', { body: { action: 'ack', id: a.id } }); reload(); } catch (e) { toast('error', (e as Error).message); } }}>Reconhecer</Button>}</li>
        ))}</ul>}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><h2 className="mb-2 font-semibold">Webhooks de pagamento</h2><ul className="text-sm">{data.webhooks.map((w, i) => <li key={i}>{w.event_type} · {w.status}: {w.n}</li>)}</ul></Card>
        <Card><h2 className="mb-2 font-semibold">Falhas de IA (7 dias)</h2><ul className="text-sm">{data.aiFailures.map((f, i) => <li key={i}>{f.purpose} · {f.status}: {f.n}</li>)}</ul></Card>
      </div>
    </div>
  );
}
