'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api, fmtDate, useApi } from '@/lib/api';
import { Markdown } from '@/components/markdown';
import { Badge, Button, Card, Empty, ErrorState, Input, Loading, Modal, PageHeader, Stat, SyntheticBadge, Tabs } from '@/components/ui';
import { useToast } from '@/components/toast';

interface Stats { last: number; average: number; max: number; evolution: { at: string; total: number }[]; byCompetency: { competency: number; last: number; average: number; max: number }[] }
interface Overview { items: { id: string; status: string; title: string; updated_at: string; last_total: number | null }[]; stats: Stats | null; followUp: { competency: number; average: number; theory: { id: string; title: string }[]; exercises: { id: string; kind: string }[] }[] }
const STATUS: Record<string, string> = { draft: 'Rascunho', submitted: 'Enviada', evaluated: 'Avaliada', failed: 'Falha na avaliação' };

function NewEssay() {
  const { data } = useApi<{ items: { id: string; title: string; kind: string; year: number | null; is_synthetic: boolean }[] }>('/api/essays/themes');
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const router = useRouter();
  const toast = useToast();
  const create = async (body: { themeId?: string; customTitle?: string }) => {
    try { const e = await api<{ id: string }>('/api/essays', { body }); router.push(`/redacao/escrever/${e.id}`); } catch (err) { toast('error', (err as Error).message); }
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Nova redação</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Escolha um tema">
        <ul className="space-y-2">
          {data?.items.map((t) => (
            <li key={t.id}><button onClick={() => create({ themeId: t.id })} className="w-full rounded-lg border border-border p-3 text-left hover:bg-surface-2">
              <div className="text-sm font-medium">{t.title}<SyntheticBadge show={t.is_synthetic} /></div>
              <div className="text-xs text-muted">{t.kind === 'official' ? `Tema oficial ${t.year ?? ''}` : 'Tema inédito NEXO'}</div>
            </button></li>
          ))}
          {!data?.items.length && <p className="text-sm text-muted">Nenhum tema publicado ainda.</p>}
        </ul>
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <Input label="Ou escreva sobre um tema próprio" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={300} />
          <Button variant="secondary" disabled={custom.trim().length < 5} onClick={() => create({ customTitle: custom })}>Usar este tema</Button>
        </div>
      </Modal>
    </>
  );
}

function Repertoires() {
  const { data, loading, setData } = useApi<{ items: { id: string; title: string; concept_md: string; source_citation: string; context_md: string | null; applications_md: string | null; selected: boolean; is_synthetic: boolean }[] }>('/api/essays/repertoires');
  const toast = useToast();
  if (loading) return <Loading />;
  if (!data?.items.length) return <Empty title="Nenhum repertório publicado" />;
  return (
    <div>
      <p className="mb-3 text-sm text-muted">Selecione seus repertórios principais (sem quantidade mínima). A seleção é um recurso pedagógico, não uma lista de favoritos.</p>
      <ul className="grid gap-3 md:grid-cols-2">{data.items.map((r) => (
        <li key={r.id}><Card>
          <div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{r.title}<SyntheticBadge show={r.is_synthetic} /></h3>
            <Button size="sm" variant={r.selected ? 'primary' : 'secondary'} onClick={async () => {
              try { await api(`/api/essays/repertoires/${r.id}`, { body: { selected: !r.selected } }); setData({ items: data.items.map((x) => (x.id === r.id ? { ...x, selected: !x.selected } : x)) }); }
              catch (e) { toast('error', (e as Error).message); }
            }}>{r.selected ? 'Selecionado' : 'Selecionar'}</Button></div>
          <Markdown text={r.concept_md} className="text-sm" />
          {r.applications_md && <details className="text-sm"><summary className="cursor-pointer text-muted">Contexto e aplicações</summary><Markdown text={r.context_md} /><Markdown text={r.applications_md} /></details>}
          <p className="mt-2 text-xs text-muted">Fonte: {r.source_citation}</p>
        </Card></li>
      ))}</ul>
    </div>
  );
}

function Theory() {
  const { data, loading } = useApi<{ items: { id: string; competency: number; title: string; body_md: string; is_synthetic: boolean }[] }>('/api/essays/theory');
  if (loading) return <Loading />;
  if (!data?.items.length) return <Empty title="Teoria ainda não publicada" />;
  return <div className="space-y-3">{data.items.map((t) => (
    <details key={t.id} className="rounded-xl border border-border bg-surface p-4"><summary className="cursor-pointer font-semibold">Competência {t.competency}: {t.title}<SyntheticBadge show={t.is_synthetic} /></summary><Markdown text={t.body_md} /></details>
  ))}</div>;
}

function Exercises() {
  const { data, loading } = useApi<{ items: { id: string; competency: number; kind: string; prompt_md: string; is_synthetic: boolean }[] }>('/api/essays/exercises');
  if (loading) return <Loading />;
  if (!data?.items.length) return <Empty title="Nenhum exercício publicado" />;
  return <ul className="space-y-2">{data.items.map((e) => (
    <li key={e.id}><Link href={`/redacao/exercicio/${e.id}`} className="block rounded-lg border border-border bg-surface p-3 hover:bg-surface-2">
      <div className="mb-1 flex gap-2"><Badge>Competência {e.competency}</Badge><SyntheticBadge show={e.is_synthetic} /></div>
      <div className="line-clamp-2 text-sm">{e.prompt_md}</div>
    </Link></li>
  ))}</ul>;
}

export default function EssaysPage() {
  const { data, error, loading, reload } = useApi<Overview>('/api/essays');
  const [tab, setTab] = useState<'mine' | 'repertoires' | 'theory' | 'exercises'>('mine');
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;
  return (
    <div className="space-y-6">
      <PageHeader title="Redação" description="Correção estimada nas cinco competências do ENEM — não é nota oficial." actions={<NewEssay />} />
      {data.stats && (
        <Card>
          <div className="grid grid-cols-3 gap-4"><Stat label="Última" value={data.stats.last} /><Stat label="Média" value={data.stats.average} /><Stat label="Máxima" value={data.stats.max} /></div>
          <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs">
            {data.stats.byCompetency.map((c) => <div key={c.competency} className="rounded-lg bg-surface-2 p-2"><div className="text-muted">C{c.competency}</div><div className="text-base font-semibold tabular-nums">{c.last}</div><div className="text-muted">média {c.average}</div></div>)}
          </div>
        </Card>
      )}
      {data.followUp.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold">Sugestões a partir do seu histórico</h2>
          <ul className="space-y-1 text-sm">{data.followUp.map((f) => (
            <li key={f.competency}>Competência {f.competency} (média {f.average}): {f.exercises.map((e) => <Link key={e.id} href={`/redacao/exercicio/${e.id}`} className="mr-2 text-primary">exercício</Link>)}{f.theory.map((t) => <span key={t.id} className="text-muted">· teoria: {t.title}</span>)}</li>
          ))}</ul>
        </Card>
      )}
      <Tabs value={tab} onChange={setTab} items={[{ value: 'mine', label: 'Minhas redações' }, { value: 'repertoires', label: 'Repertórios' }, { value: 'theory', label: 'Teoria' }, { value: 'exercises', label: 'Exercícios' }]} />
      {tab === 'mine' && (data.items.length === 0 ? <Empty title="Nenhuma redação ainda">Comece com “Nova redação”.</Empty> : (
        <ul className="space-y-2">{data.items.map((e) => (
          <li key={e.id}><Link href={e.status === 'draft' || e.status === 'failed' ? `/redacao/escrever/${e.id}` : `/redacao/${e.id}`} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 hover:bg-surface-2">
            <span className="text-sm">{e.title} <span className="text-xs text-muted">· {fmtDate(e.updated_at)}</span></span>
            <span className="flex gap-2">{e.last_total !== null && <Badge tone="primary">{e.last_total}</Badge>}<Badge>{STATUS[e.status]}</Badge></span>
          </Link></li>
        ))}</ul>
      ))}
      {tab === 'repertoires' && <Repertoires />}
      {tab === 'theory' && <Theory />}
      {tab === 'exercises' && <Exercises />}
    </div>
  );
}
