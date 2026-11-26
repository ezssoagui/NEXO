'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { BookOpen, Info, ListChecks, Play, Layers, Lightbulb } from 'lucide-react';
import { api, AREA_NAMES, STATE_NAMES, useApi } from '@/lib/api';
import { Badge, Button, Card, ErrorState, Loading, PageHeader } from '@/components/ui';
import { useToast } from '@/components/toast';

interface Detail {
  id: string; name: string; relevance: string; topic: string; subject: string; area_code: string; questionCount: number;
  skills: { id: string; name: string; state: string | null; r: string | null; c: string | null; t: string | null; m: string | null; d: string | null; evidence_count: number | null; reason: string | null; rule_version: string | null }[];
  lessons: { id: string; title: string; kind: string; accessible: boolean; read: boolean }[];
  decks: { id: string; title: string; cards: number; due: number }[];
  concepts: { id: string; kind: string }[];
  officialSkills: { area_code: string; number: number; description: string; confidence: string }[];
}
const REL: Record<string, string> = { high: 'Alta relevância', medium: 'Relevância média', low: 'Relevância baixa (base)', unknown: 'Relevância em validação' };
const fmt = (v: string | null) => (v === null ? '—' : Math.round(Number(v)).toString());

export default function SubtopicPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<Detail>(`/api/curriculum/subtopics/${id}`);
  const [showDims, setShowDims] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;
  const startSession = async () => {
    setBusy('session');
    try { const s = await api<{ id: string }>('/api/sessions', { body: { subtopicId: id } }); router.push(`/estudar/sessao/${s.id}`); }
    catch (e) { toast('error', (e as Error).message); setBusy(null); }
  };
  const practice = async () => {
    setBusy('list');
    try { const l = await api<{ id: string }>('/api/lists', { body: { mode: 'manual', filters: { subtopicIds: [id], status: 'unseen', page: 1 }, count: 10 } }); router.push(`/questoes/lista/${l.id}`); }
    catch (e) { toast('error', (e as Error).message); setBusy(null); }
  };
  return (
    <div>
      <PageHeader title={data.name} description={`${AREA_NAMES[data.area_code]} · ${data.subject} · ${data.topic}`}
        actions={<><Button loading={busy === 'session'} onClick={startSession}><Play className="size-4" /> Sessão para este conteúdo</Button></>} />
      <div className="mb-4 flex flex-wrap gap-2"><Badge>{REL[data.relevance]}</Badge>{data.officialSkills.map((o) => <Badge key={o.number} tone="primary">H{o.number} ({o.area_code})</Badge>)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Habilidades</h2>
            <button className="inline-flex items-center gap-1 text-xs text-muted" onClick={() => setShowDims(!showDims)} aria-expanded={showDims}><Info className="size-4" /> Dimensões</button>
          </div>
          <ul className="space-y-2">
            {data.skills.map((s) => (
              <li key={s.id} className="rounded-lg bg-surface-2 p-3">
                <div className="flex items-start justify-between gap-2"><span className="text-sm">{s.name}</span><Badge tone={s.state === 'consolidated' ? 'success' : s.state === 'provisional' ? 'primary' : 'neutral'}>{STATE_NAMES[s.state ?? 'not_assessed']}</Badge></div>
                {showDims && s.state && (
                  <div className="mt-2 text-xs text-muted">
                    <div className="grid grid-cols-5 gap-1 tabular-nums"><span>R {fmt(s.r)}</span><span>C {fmt(s.c)}</span><span>T {fmt(s.t)}</span><span>M {fmt(s.m)}</span><span className="font-semibold text-text">D {fmt(s.d)}</span></div>
                    <p className="mt-1">{s.reason}</p>
                    <p>D = 0,50·Resolução + 0,25·Compreensão + 0,15·Transferência + 0,10·Retenção (dimensões ausentes não contam como zero). Regra {s.rule_version}.</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-4">
          <Card>
            <h2 className="mb-2 flex items-center gap-2 font-semibold"><BookOpen className="size-4" /> Aulas e materiais</h2>
            {data.lessons.length === 0 ? <p className="text-sm text-muted">Material escrito ainda não publicado para este conteúdo.</p> : (
              <ul className="space-y-1">{data.lessons.map((l) => (
                <li key={l.id}>{l.accessible ? <Link href={`/estudar/aula/${l.id}`} className="text-sm text-primary">{l.title}</Link> : <span className="text-sm text-muted">{l.title} — <Link href="/configuracoes?aba=plano" className="text-primary">Plus/Pro</Link></span>}{l.read && <Badge tone="success" className="ml-2">estudada</Badge>}</li>
              ))}</ul>
            )}
          </Card>
          <Card>
            <h2 className="mb-2 flex items-center gap-2 font-semibold"><Lightbulb className="size-4" /> Explicação ativa</h2>
            {data.concepts.length === 0 ? <p className="text-sm text-muted">Nenhuma atividade conceitual publicada.</p> : (
              <ul className="space-y-1">{data.concepts.map((c, i) => <li key={c.id}><Link href={`/estudar/atividade/${c.id}`} className="text-sm text-primary">Atividade {i + 1}</Link></li>)}</ul>
            )}
          </Card>
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="flex items-center gap-2 font-semibold"><ListChecks className="size-4" /> Questões oficiais</h2><p className="text-sm text-muted">{data.questionCount} publicadas</p></div>
            <Button variant="secondary" loading={busy === 'list'} disabled={!data.questionCount} onClick={practice}>Praticar</Button>
          </Card>
          <Card>
            <h2 className="mb-2 flex items-center gap-2 font-semibold"><Layers className="size-4" /> Flashcards</h2>
            {data.decks.length === 0 ? <p className="text-sm text-muted">Nenhum baralho publicado.</p> : (
              <ul className="space-y-1">{data.decks.map((d) => <li key={d.id} className="text-sm"><Link href={`/estudar/flashcards?deck=${d.id}`} className="text-primary">{d.title}</Link> <span className="text-muted">· {d.due} para revisar</span></li>)}</ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
