'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AREA_NAMES, DIFFICULTY_NAMES, fmtDate, pct, useApi } from '@/lib/api';
import { LiquidContainer } from '@/components/liquid';
import { Badge, Card, Empty, ErrorState, Loading, PageHeader, Progress, Stat, Tabs } from '@/components/ui';

interface MapRow { area_code: string; subject_id: string; subject: string; topic_id: string; topic: string; subtopic_id: string; subtopic: string; skills: number; assessed: number; consolidated: number; answered: number; correct: number }
interface Perf {
  overview: { accuracy: number | null; answered: number; correct: number; coverage: number | null; curricularMastery: number | null; byArea: { area_code: string; answered: number; correct: number }[];
    byDifficulty: { difficulty: string; answered: number; correct: number }[]; errorTypes: { cause: string; n: number }[]; evolution: { week: string; consolidated_events: number; updates: number }[] };
  essays: { last: number; average: number; max: number; byCompetency: { competency: number; last: number; average: number; max: number }[]; evolution: { at: string; total: number }[] } | null;
  exams: { id: string; title: string; finished_at: string; result: { correct: number; total: number; percent: number | null; byArea: Record<string, { correct: number; total: number }> } }[];
}
interface Agg { skills: number; assessed: number; consolidated: number; answered: number; correct: number }
const sum = (rows: MapRow[]): Agg => rows.reduce((a, r) => ({ skills: a.skills + r.skills, assessed: a.assessed + r.assessed, consolidated: a.consolidated + r.consolidated, answered: a.answered + r.answered, correct: a.correct + r.correct }), { skills: 0, assessed: 0, consolidated: 0, answered: 0, correct: 0 });
const mastery = (a: Agg) => (a.skills ? (a.consolidated / a.skills) * 100 : null);
const coverage = (a: Agg) => (a.skills ? (a.assessed / a.skills) * 100 : null);
const acc = (a: Agg) => (a.answered ? (a.correct / a.answered) * 100 : null);
const CAUSE: Record<string, string> = { knowledge_gap: 'Lacuna', conceptual: 'Conceitual', interpretive: 'Interpretação', application: 'Aplicação', procedural: 'Procedimento', attention: 'Atenção', unknown: 'Não sei' };

function Line({ label, a, href, depth }: { label: string; a: Agg; href?: string; depth: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5 text-sm" style={{ paddingLeft: depth * 16 }}>
      <span className="min-w-0 flex-1">{href ? <Link href={href} className="text-primary">{label}</Link> : label}</span>
      <span className="w-28 text-xs text-muted">Domínio {pct(mastery(a))}</span>
      <span className="w-28 text-xs text-muted">Cobertura {pct(coverage(a))}</span>
      <span className="w-24 text-xs text-muted">Acertos {pct(acc(a))}</span>
    </div>
  );
}

/** Mapa de domínio (10.1/8.9): recipientes = % de habilidades consolidadas; cobertura e acertos em texto; expansão hierárquica. */
function MasteryMap() {
  const { data, error, loading } = useApi<{ rows: MapRow[] }>('/api/performance/map');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const areas = useMemo(() => {
    const by = new Map<string, MapRow[]>();
    for (const r of data?.rows ?? []) (by.get(r.area_code) ?? by.set(r.area_code, []).get(r.area_code)!).push(r);
    return by;
  }, [data]);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error.message} />;
  const toggle = (k: string) => setOpen({ ...open, [k]: !open[k] });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {['LC', 'CH', 'CN', 'MT'].map((a) => {
          const agg = sum(areas.get(a) ?? []);
          return <button key={a} onClick={() => toggle(a)} aria-expanded={Boolean(open[a])} className="rounded-xl border border-border bg-surface p-3 hover:bg-surface-2"><LiquidContainer percent={mastery(agg)} label={AREA_NAMES[a]!} /><p className="mt-1 text-center text-xs text-muted">Cobertura {pct(coverage(agg))}</p></button>;
        })}
      </div>
      {['LC', 'CH', 'CN', 'MT'].filter((a) => open[a]).map((a) => {
        const rows = areas.get(a) ?? [];
        const subjects = [...new Map(rows.map((r) => [r.subject_id, r.subject])).entries()];
        return (
          <Card key={a}>
            <h2 className="mb-2 font-semibold">{AREA_NAMES[a]}</h2>
            {subjects.map(([sid, sname]) => {
              const srows = rows.filter((r) => r.subject_id === sid);
              const topics = [...new Map(srows.map((r) => [r.topic_id, r.topic])).entries()];
              return (
                <div key={sid} className="border-t border-border">
                  <button className="flex w-full items-center gap-1 text-left" onClick={() => toggle(sid)} aria-expanded={Boolean(open[sid])}>{open[sid] ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}<div className="flex-1"><Line label={sname} a={sum(srows)} depth={0} /></div></button>
                  {open[sid] && topics.map(([tid, tname]) => {
                    const trows = srows.filter((r) => r.topic_id === tid);
                    return (
                      <div key={tid}>
                        <button className="flex w-full items-center gap-1 text-left" onClick={() => toggle(tid)} aria-expanded={Boolean(open[tid])} style={{ paddingLeft: 16 }}>{open[tid] ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}<div className="flex-1"><Line label={tname} a={sum(trows)} depth={0} /></div></button>
                        {open[tid] && trows.map((r) => <Line key={r.subtopic_id} label={r.subtopic} a={r} depth={3} href={`/estudar/conteudo/${r.subtopic_id}`} />)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </Card>
        );
      })}
      <p className="text-xs text-muted">O recipiente mostra a porcentagem de habilidades consolidadas (peso visual igual entre habilidades). Não representa o índice individual de uma habilidade nem previsão de nota.</p>
    </div>
  );
}

export default function PerformancePage() {
  const [tab, setTab] = useState<'general' | 'questions' | 'exams' | 'essays'>('general');
  const [period, setPeriod] = useState<'recent' | 'all'>('all');
  const { data, error, loading, reload } = useApi<Perf>(`/api/performance?period=${period}`);
  return (
    <div>
      <PageHeader title="Desempenho" description="Acertos, cobertura e domínio são indicadores distintos."
        actions={<div className="flex gap-1 rounded-lg bg-surface-2 p-1 text-sm">{(['recent', 'all'] as const).map((p) => <button key={p} onClick={() => setPeriod(p)} aria-pressed={period === p} className={`rounded-md px-3 py-1 ${period === p ? 'bg-surface shadow-sm' : 'text-muted'}`}>{p === 'recent' ? 'Últimos 30 dias' : 'Todo o histórico'}</button>)}</div>} />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'general', label: 'Geral' }, { value: 'questions', label: 'Questões' }, { value: 'exams', label: 'Simulados' }, { value: 'essays', label: 'Redação' }]} />
      {loading && !data ? <Loading /> : error ? <ErrorState message={error.message} onRetry={reload} /> : data && (
        <>
          {tab === 'general' && (
            <div className="space-y-4">
              <Card className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Acertos" value={pct(data.overview.accuracy)} hint={`${data.overview.correct}/${data.overview.answered}`} />
                <Stat label="Cobertura" value={pct(data.overview.coverage)} hint="habilidades avaliadas" />
                <Stat label="Domínio curricular" value={pct(data.overview.curricularMastery)} hint="habilidades consolidadas" />
                <Stat label="Redação (última)" value={data.essays?.last ?? '—'} />
              </Card>
              <MasteryMap />
            </div>
          )}
          {tab === 'questions' && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card><h2 className="mb-3 font-semibold">Por área</h2>{data.overview.byArea.length === 0 ? <p className="text-sm text-muted">Sem respostas no período.</p> : data.overview.byArea.map((a) => (
                <div key={a.area_code} className="mb-2"><div className="mb-1 flex justify-between text-sm"><span>{AREA_NAMES[a.area_code]}</span><span className="tabular-nums">{a.correct}/{a.answered}</span></div><Progress value={(a.correct / a.answered) * 100} label={AREA_NAMES[a.area_code] ?? ''} /></div>))}</Card>
              <Card><h2 className="mb-3 font-semibold">Por dificuldade</h2>{data.overview.byDifficulty.map((d) => (
                <div key={d.difficulty} className="mb-2 flex justify-between text-sm"><span>{DIFFICULTY_NAMES[d.difficulty] ?? d.difficulty}</span><span className="tabular-nums">{d.correct}/{d.answered} · {pct((d.correct / d.answered) * 100)}</span></div>))}</Card>
              <Card><h2 className="mb-3 font-semibold">Tipos de erro informados (Matemática/Natureza)</h2>{data.overview.errorTypes.length === 0 ? <p className="text-sm text-muted">Nenhuma classificação informada.</p> : <div className="flex flex-wrap gap-2">{data.overview.errorTypes.map((e) => <Badge key={e.cause}>{CAUSE[e.cause]}: {e.n}</Badge>)}</div>}</Card>
              <Card><h2 className="mb-3 font-semibold">Evolução (atualizações do perfil por semana)</h2>{data.overview.evolution.length === 0 ? <p className="text-sm text-muted">Sem histórico ainda.</p> : <ul className="space-y-1 text-sm">{data.overview.evolution.map((w) => <li key={w.week} className="flex justify-between"><span>{fmtDate(w.week)}</span><span className="tabular-nums text-muted">{w.updates} atualizações · {w.consolidated_events} consolidações</span></li>)}</ul>}</Card>
            </div>
          )}
          {tab === 'exams' && (data.exams.length === 0 ? <Empty title="Nenhum simulado concluído" /> : (
            <ul className="space-y-2">{data.exams.map((e) => (
              <li key={e.id}><Link href={`/simulados/resultado/${e.id}`} className="block rounded-lg border border-border bg-surface p-3 hover:bg-surface-2">
                <div className="flex justify-between"><span>{e.title}</span><Badge tone="success">{e.result.correct}/{e.result.total} ({e.result.percent ?? 0}%)</Badge></div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">{fmtDate(e.finished_at)} {Object.entries(e.result.byArea).map(([a, s]) => <span key={a}>{AREA_NAMES[a]}: {s.correct}/{s.total}</span>)}</div>
              </Link></li>
            ))}</ul>
          ))}
          {tab === 'essays' && (!data.essays ? <Empty title="Nenhuma redação avaliada" /> : (
            <div className="space-y-4">
              <Card className="grid grid-cols-3 gap-4"><Stat label="Última" value={data.essays.last} /><Stat label="Média" value={data.essays.average} /><Stat label="Máxima" value={data.essays.max} /></Card>
              <Card><h2 className="mb-2 font-semibold">Por competência</h2><div className="grid grid-cols-5 gap-2 text-center text-sm">{data.essays.byCompetency.map((c) => <div key={c.competency} className="rounded-lg bg-surface-2 p-2"><div className="text-xs text-muted">C{c.competency}</div><div className="font-semibold">{c.last}</div><div className="text-xs text-muted">média {c.average} · máx {c.max}</div></div>)}</div></Card>
              <Card><h2 className="mb-2 font-semibold">Evolução</h2><ul className="space-y-1 text-sm">{data.essays.evolution.map((e, i) => <li key={i} className="flex justify-between"><span>{fmtDate(e.at)}</span><span className="tabular-nums">{e.total}</span></li>)}</ul></Card>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
