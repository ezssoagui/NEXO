'use client';

import { useState } from 'react';
import { api, fmtDate, useApi } from '@/lib/api';
import { Badge, Button, Card, Empty, Loading, PageHeader, Select } from '@/components/ui';
import { useToast } from '@/components/toast';

const KIND: Record<string, string> = { question_error: 'Erro em questão', evaluation_issue: 'Correção inadequada', technical: 'Erro técnico', suggestion: 'Sugestão' };

export default function AdminFeedback() {
  const [status, setStatus] = useState('open');
  const { data, loading, reload } = useApi<{ items: { id: string; kind: string; entity_type: string | null; entity_id: string | null; message: string; status: string; created_at: string }[] }>(`/api/admin/feedback?status=${status}`);
  const toast = useToast();
  const set = async (id: string, s: string) => { try { await api('/api/admin/feedback', { body: { id, status: s } }); reload(); } catch (e) { toast('error', (e as Error).message); } };
  return (
    <div>
      <PageHeader title="Feedback" description="Canal discreto e opcional dos estudantes (14.7)." />
      <div className="mb-4 max-w-xs"><Select label="Situação" value={status} onChange={(e) => setStatus(e.target.value)}><option value="open">Abertos</option><option value="triaged">Em análise</option><option value="resolved">Resolvidos</option><option value="dismissed">Descartados</option></Select></div>
      {loading ? <Loading /> : !data?.items.length ? <Empty title="Nenhum feedback" /> : (
        <ul className="space-y-2">{data.items.map((f) => (
          <li key={f.id}><Card className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2"><Badge>{KIND[f.kind]}</Badge>{f.entity_type && <Badge tone="primary">{f.entity_type}</Badge>}<span className="text-xs text-muted">{fmtDate(f.created_at)}</span></div>
            <p className="whitespace-pre-wrap">{f.message}</p>
            {f.entity_id && <p className="text-xs text-muted">Referência: {f.entity_id}</p>}
            <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => set(f.id, 'triaged')}>Em análise</Button><Button size="sm" variant="secondary" onClick={() => set(f.id, 'resolved')}>Resolvido</Button><Button size="sm" variant="ghost" onClick={() => set(f.id, 'dismissed')}>Descartar</Button></div>
          </Card></li>
        ))}</ul>
      )}
    </div>
  );
}
