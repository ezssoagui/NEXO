'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AREA_NAMES, useApi } from '@/lib/api';
import { Badge, Card, ErrorState, Loading, PageHeader, Progress, cn } from '@/components/ui';

interface Attempt { title: string; kind: string; result: { correct: number; total: number; answered: number; percent: number | null; byArea: Record<string, { correct: number; total: number; percent: number | null }> } | null;
  answers: { position: number; question_id: string; selected_alternative: string | null; correct_alternative?: string | null; is_annulled?: boolean; area_code: string }[] }

/** Resultado por acertos/percentuais por área e geral (8.8). Nenhuma previsão TRI. */
export default function ExamResult() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { data, error, loading } = useApi<Attempt>(`/api/exam-attempts/${attemptId}`);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error.message} />;
  if (!data?.result) return null;
  const r = data.result;
  return (
    <div className="space-y-4">
      <PageHeader title={`Resultado — ${data.title}`} description="Acertos e percentuais. O NEXO não estima nota TRI." />
      <Card className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="text-4xl font-bold tabular-nums">{r.correct}<span className="text-xl text-muted">/{r.total}</span></div>
        <div className="space-y-3">
          {Object.entries(r.byArea).map(([a, s]) => (
            <div key={a}><div className="mb-1 flex justify-between text-sm"><span>{AREA_NAMES[a]}</span><span className="tabular-nums">{s.correct}/{s.total} · {s.percent ?? 0}%</span></div><Progress value={s.percent ?? 0} label={AREA_NAMES[a] ?? a} tone="success" /></div>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Revisão das questões</h2>
        <div className="flex flex-wrap gap-1">
          {data.answers.map((a) => {
            const ok = a.selected_alternative && a.selected_alternative === a.correct_alternative;
            return (
              <Link key={a.position} href={`/questoes/${a.question_id}`} title={`Questão ${a.position}`}
                className={cn('flex size-9 items-center justify-center rounded border text-xs', a.is_annulled ? 'border-border text-muted' : !a.selected_alternative ? 'border-border' : ok ? 'border-success bg-success-soft' : 'border-danger bg-danger-soft')}>
                {a.position}
              </Link>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs"><Badge tone="success">correta</Badge><Badge tone="danger">incorreta</Badge><Badge>em branco/anulada</Badge></div>
      </Card>
      <Link href="/simulados" className="text-sm text-primary">← Simulados</Link>
    </div>
  );
}
