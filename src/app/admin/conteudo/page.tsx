'use client';

import { useState } from 'react';
import { api, useApi } from '@/lib/api';
import { Badge, Button, Card, Empty, Loading, PageHeader, Select } from '@/components/ui';
import { useToast } from '@/components/toast';

const TYPES: [string, string][] = [['question', 'Questões'], ['lesson', 'Aulas'], ['concept_activity', 'Atividades conceituais'], ['deck', 'Baralhos'], ['essay_theme', 'Temas de redação'], ['repertoire', 'Repertórios'], ['essay_exercise', 'Exercícios'], ['essay_theory', 'Teoria de redação']];
const KINDS: [string, string][] = [['technical', 'Técnica'], ['pedagogical', 'Pedagógica'], ['rights', 'Direitos']];

/** Fila de validação (12.5): criar/importar → validar técnica, pedagógica e direitos → publicar. */
export default function AdminContent() {
  const [type, setType] = useState('question');
  const [status, setStatus] = useState('staging');
  const { data, loading, reload } = useApi<{ items: { id: string; title: string; status: string; reviews: { kind: string; status: string; notes: string | null }[] | null }[] }>(`/api/admin/content?type=${type}&status=${status}`);
  const toast = useToast();
  const post = async (body: unknown) => { try { await api('/api/admin/content', { body }); toast('success', 'Registrado.'); reload(); } catch (e) { toast('error', (e as Error).message); } };
  return (
    <div>
      <PageHeader title="Conteúdos" description="Nenhum conteúdo é publicado sem validação técnica, pedagógica e de direitos autorais." />
      <div className="mb-4 flex flex-wrap gap-3">
        <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        <Select label="Situação" value={status} onChange={(e) => setStatus(e.target.value)}><option value="staging">Em preparação</option><option value="pending_review">Em revisão</option><option value="published">Publicado</option><option value="retired">Retirado</option></Select>
      </div>
      {loading ? <Loading /> : !data?.items.length ? <Empty title="Nada nesta fila" /> : (
        <ul className="space-y-2">{data.items.map((c) => (
          <li key={c.id}><Card className="space-y-2">
            <div className="text-sm">{c.title}</div>
            <div className="flex flex-wrap gap-2">{KINDS.map(([k, l]) => {
              const r = c.reviews?.filter((x) => x.kind === k).at(-1);
              return <Badge key={k} tone={r?.status === 'approved' ? 'success' : r?.status === 'rejected' ? 'danger' : 'neutral'}>{l}: {r?.status ?? 'pendente'}</Badge>;
            })}</div>
            {c.status !== 'published' && c.status !== 'retired' && (
              <div className="flex flex-wrap gap-2">
                {KINDS.map(([k, l]) => <Button key={k} size="sm" variant="secondary" onClick={() => post({ action: 'review', type, id: c.id, kind: k, decision: 'approved' })}>Aprovar {l.toLowerCase()}</Button>)}
                <Button size="sm" variant="secondary" onClick={() => { const notes = prompt('Motivo da rejeição:'); if (notes) void post({ action: 'review', type, id: c.id, kind: 'pedagogical', decision: 'rejected', notes }); }}>Rejeitar</Button>
                <Button size="sm" onClick={() => post({ action: 'publish', type, id: c.id })}>Publicar</Button>
              </div>
            )}
            {c.status === 'published' && <Button size="sm" variant="ghost" onClick={() => { const reason = prompt('Motivo da retirada:'); if (reason) void post({ action: 'retire', type, id: c.id, reason }); }}>Retirar</Button>}
          </Card></li>
        ))}</ul>
      )}
    </div>
  );
}
