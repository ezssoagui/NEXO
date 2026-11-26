'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Clock, Flame, Info, Play, Sparkles, X } from 'lucide-react';
import { api, AREA_NAMES, CATEGORY_NAMES, pct, useApi } from '@/lib/api';
import { Badge, Button, Card, Empty, ErrorState, Loading, PageHeader, Stat, Tabs } from '@/components/ui';
import { useToast } from '@/components/toast';

interface Rec { id: string; subtopic_id: string; subtopic_name: string; topic_name: string; subject_name: string; area_code: string; category: string; focus: string; reason: string; factors: { factors: Record<string, number>; level: string } }
interface Dashboard {
  recommendations: Rec[];
  resume: { id: string; status: string; subtopic_name: string; done: number; total: number } | null;
  summary: { accuracy: number | null; answered: number; coverage: number | null; curricularMastery: number | null; xp: number; level: number; className: string; streak: number };
}

const FOCUS: Record<string, string> = {
  exploration: 'Explorar', fundamentals: 'Fundamentos', comprehension: 'Compreensão', practice: 'Prática', transfer: 'Aplicação',
  retention: 'Revisão', maintenance: 'Manutenção', recovery: 'Recuperação',
};
const FACTOR: Record<string, string> = { difficulty: 'Dificuldade individual', relevance: 'Relevância no ENEM', review: 'Necessidade de revisão', coverage: 'Lacuna de cobertura', connections: 'Conexões' };

/** Dashboard (4.9/10.2): recomendações e retomada em primeiro plano; resumo pessoal discreto. */
export default function DashboardPage() {
  const [filter, setFilter] = useState<'all' | 'learn' | 'improve' | 'deepen' | 'review'>('all');
  const { data, error, loading, reload } = useApi<Dashboard>('/api/dashboard');
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [why, setWhy] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;
  const recs = data.recommendations.filter((r) => filter === 'all' || r.category === filter);

  const start = async (r: Rec) => {
    setBusy(r.id);
    try {
      const s = await api<{ id: string }>('/api/sessions', { body: { recommendationId: r.id } });
      router.push(`/estudar/sessao/${s.id}`);
    } catch (e) { toast('error', (e as Error).message); setBusy(null); }
  };
  const act = async (r: Rec, action: 'postpone' | 'dismiss') => {
    try { await api(`/api/recommendations/${r.id}`, { body: { action } }); toast('success', action === 'postpone' ? 'Adiado por 3 dias.' : 'Recomendação dispensada.'); reload(); }
    catch (e) { toast('error', (e as Error).message); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
      <section>
        <PageHeader title="Seu próximo passo" description="Recomendações individuais a partir das suas evidências. Você pode seguir, adiar, dispensar ou estudar livremente." />
        {data.resume && (
          <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-primary/40 bg-primary-soft/30">
            <div>
              <div className="text-sm text-muted">Continuar sessão {data.resume.status === 'paused' ? 'pausada' : 'em andamento'}</div>
              <div className="font-semibold">{data.resume.subtopic_name}</div>
              <div className="text-sm text-muted">{data.resume.done} de {data.resume.total} atividades</div>
            </div>
            <Link href={`/estudar/sessao/${data.resume.id}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 font-medium text-on-primary"><Play className="size-4" /> Continuar</Link>
          </Card>
        )}
        <Tabs value={filter} onChange={setFilter} items={[{ value: 'all', label: 'Todas' }, { value: 'learn', label: 'Aprender' }, { value: 'improve', label: 'Melhorar' }, { value: 'deepen', label: 'Aprofundar' }, { value: 'review', label: 'Revisar' }]} />
        {recs.length === 0 ? (
          <Empty title="Nenhuma recomendação nesta categoria">
            <p className="text-sm">Explore o currículo em <Link href="/estudar" className="text-primary">Estudar</Link> ou pratique no <Link href="/questoes" className="text-primary">banco de questões</Link>.</p>
          </Empty>
        ) : (
          <ul className="space-y-3">
            {recs.map((r, i) => (
              <li key={r.id}>
                <Card className={i === 0 && filter === 'all' ? 'border-primary/50' : ''}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge tone="primary">{CATEGORY_NAMES[r.category]}</Badge>
                        <Badge>{FOCUS[r.focus] ?? r.focus}</Badge>
                        <span className="text-xs text-muted">{AREA_NAMES[r.area_code]} · {r.subject_name}</span>
                      </div>
                      <h2 className="font-semibold">{r.subtopic_name}</h2>
                      <p className="text-sm text-muted">{r.reason}</p>
                      {why === r.id && (
                        <div className="mt-2 rounded-lg bg-surface-2 p-3 text-xs">
                          <p className="mb-1 font-medium">Por que esta recomendação (fatores normalizados 0–1):</p>
                          <ul className="grid grid-cols-2 gap-1">{Object.entries(r.factors.factors).map(([k, v]) => <li key={k}>{FACTOR[k] ?? k}: {v.toFixed(2)}</li>)}</ul>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" loading={busy === r.id} onClick={() => start(r)}><Play className="size-4" /> Estudar</Button>
                      <button className="rounded p-1.5 text-muted hover:bg-surface-2" aria-label="Por que esta recomendação?" onClick={() => setWhy(why === r.id ? null : r.id)}><Info className="size-4" /></button>
                      <button className="rounded p-1.5 text-muted hover:bg-surface-2" aria-label="Adiar" title="Adiar 3 dias" onClick={() => act(r, 'postpone')}><Clock className="size-4" /></button>
                      <button className="rounded p-1.5 text-muted hover:bg-surface-2" aria-label="Dispensar" title="Dispensar" onClick={() => act(r, 'dismiss')}><X className="size-4" /></button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      <aside className="space-y-4">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-muted">Resumo</h2>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Acertos" value={pct(data.summary.accuracy)} hint={`${data.summary.answered} respostas`} />
            <Stat label="Cobertura" value={pct(data.summary.coverage)} />
            <Stat label="Domínio" value={pct(data.summary.curricularMastery)} hint="habilidades consolidadas" />
            <Stat label="Nível" value={<span className="text-award">{data.summary.level}</span>} hint={`${data.summary.className} · ${data.summary.xp} XP`} />
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-muted"><Flame className="size-4 text-award" /> Sequência: {data.summary.streak} dia(s)</div>
          <Link href="/desempenho" className="mt-3 inline-block text-sm text-primary">Ver mapa de domínio →</Link>
        </Card>
        <Card>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" /> Estudo livre</h2>
          <ul className="space-y-1 text-sm">
            <li><Link href="/questoes" className="text-primary">Banco de questões oficiais</Link></li>
            <li><Link href="/estudar/flashcards" className="text-primary">Revisar flashcards</Link></li>
            <li><Link href="/simulados" className="text-primary">Fazer um simulado</Link></li>
            <li><Link href="/redacao" className="text-primary">Escrever uma redação</Link></li>
          </ul>
        </Card>
      </aside>
    </div>
  );
}
