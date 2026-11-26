'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { api, AREA_NAMES, fmtDate, STATE_NAMES, useApi } from '@/lib/api';
import { Button, Card, Empty, ErrorState, Loading, PageHeader, Select, Tabs } from '@/components/ui';
import { useToast } from '@/components/toast';

interface Tree {
  areas: { code: string; name: string }[];
  subjects: { id: string; area_code: string; name: string }[];
  topics: { id: string; subject_id: string; name: string }[];
  subtopics: { id: string; topic_id: string; name: string; relevance: string }[];
}

function Curriculum() {
  const { data, error, loading, reload } = useApi<Tree>('/api/curriculum');
  const [area, setArea] = useState('MT');
  const [filter, setFilter] = useState('');
  const subjects = useMemo(() => data?.subjects.filter((s) => s.area_code === area) ?? [], [data, area]);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;
  const f = filter.trim().toLowerCase();
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {data.areas.map((a) => <Button key={a.code} size="sm" variant={a.code === area ? 'primary' : 'secondary'} onClick={() => setArea(a.code)}>{AREA_NAMES[a.code]}</Button>)}
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar conteúdos" aria-label="Filtrar conteúdos" className="h-8 flex-1 rounded-lg border border-border bg-surface px-3 text-sm" />
      </div>
      <div className="space-y-3">
        {subjects.map((s) => {
          const topics = data.topics.filter((t) => t.subject_id === s.id);
          return (
            <details key={s.id} className="rounded-xl border border-border bg-surface" open={Boolean(f)}>
              <summary className="cursor-pointer px-4 py-3 font-semibold">{s.name}</summary>
              <div className="space-y-2 px-4 pb-4">
                {topics.map((t) => {
                  const subs = data.subtopics.filter((st) => st.topic_id === t.id && (!f || st.name.toLowerCase().includes(f) || t.name.toLowerCase().includes(f)));
                  if (!subs.length) return null;
                  return (
                    <div key={t.id}>
                      <div className="text-sm font-medium text-muted">{t.name}</div>
                      <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                        {subs.map((st) => (
                          <li key={st.id}><Link href={`/estudar/conteudo/${st.id}`} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">{st.name}<ChevronRight className="size-4 text-muted" /></Link></li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted">Currículo-base gerado a partir da Matriz de Referência oficial do Inep (versão em validação pedagógica). Todo o currículo é acessível, sem bloqueios.</p>
    </div>
  );
}

function Reviews() {
  const { data, error, loading } = useApi<{ items: { skill_id: string; skill: string; subtopic_id: string; subtopic: string; due_at: string; state: string | null }[] }>('/api/reviews');
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error.message} />;
  if (!data?.items.length) return <Empty title="Nenhuma revisão pendente">Revisões surgem conforme você estuda; estudo livre válido também satisfaz revisões.</Empty>;
  return (
    <ul className="space-y-2">
      {data.items.map((r) => (
        <li key={r.skill_id}><Card className="flex items-center justify-between gap-3 py-3">
          <div><div className="font-medium">{r.subtopic}</div><div className="text-xs text-muted">Sugerida para {fmtDate(r.due_at)} · {STATE_NAMES[r.state ?? 'not_assessed']}</div></div>
          <Link href={`/estudar/conteudo/${r.subtopic_id}`} className="text-sm text-primary">Revisar</Link>
        </Card></li>
      ))}
    </ul>
  );
}

function Materials() {
  const { data, loading, reload } = useApi<{ items: { id: string; title: string; scope: string; created_at: string }[] }>('/api/materials');
  const router = useRouter();
  const toast = useToast();
  const [scope, setScope] = useState('final_review');
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3">
        <Select label="Montar resumo personalizado" value={scope} onChange={(e) => setScope(e.target.value)} className="min-w-56">
          <option value="final_review">Revisão final (conteúdos já estudados)</option>
          <option value="area:LC">Área: Linguagens</option><option value="area:CH">Área: Humanas</option>
          <option value="area:CN">Área: Natureza</option><option value="area:MT">Área: Matemática</option>
        </Select>
        <Button loading={busy} onClick={async () => {
          setBusy(true);
          try {
            const [s, ref] = scope.split(':');
            const m = await api<{ id: string }>('/api/materials', { body: { scope: s, ref } });
            router.push(`/estudar/materiais/${m.id}`);
          } catch (e) { toast('error', (e as Error).message); setBusy(false); } finally { void reload(); }
        }}>Montar</Button>
        <p className="w-full text-xs text-muted">Montado com blocos já validados e seus erros recorrentes — nenhum material novo é gerado por IA.</p>
      </Card>
      {loading ? <Loading /> : !data?.items.length ? <Empty title="Nenhum material montado ainda" /> : (
        <ul className="space-y-2">{data.items.map((m) => <li key={m.id}><Link href={`/estudar/materiais/${m.id}`} className="block rounded-lg border border-border bg-surface px-4 py-3 hover:bg-surface-2">{m.title} <span className="text-xs text-muted">· {fmtDate(m.created_at)}</span></Link></li>)}</ul>
      )}
    </div>
  );
}

export default function StudyPage() {
  const [tab, setTab] = useState<'content' | 'reviews' | 'materials'>('content');
  return (
    <div>
      <PageHeader title="Estudar" description="Acesse qualquer conteúdo do currículo, revisões e materiais." actions={<Link href="/estudar/flashcards" className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-2">Flashcards</Link>} />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'content', label: 'Conteúdos' }, { value: 'reviews', label: 'Revisões' }, { value: 'materials', label: 'Materiais' }]} />
      {tab === 'content' && <Curriculum />}
      {tab === 'reviews' && <Reviews />}
      {tab === 'materials' && <Materials />}
    </div>
  );
}
