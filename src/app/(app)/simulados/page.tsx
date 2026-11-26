'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ClipboardList, Stethoscope } from 'lucide-react';
import { api, AREA_NAMES, fmtDate, useApi } from '@/lib/api';
import { Badge, Button, Card, Empty, ErrorState, Loading, PageHeader } from '@/components/ui';
import { useToast } from '@/components/toast';

interface ExamsData {
  exams: { id: string; kind: string; title: string; duration_minutes: number | null; items: number; includes_essay: boolean }[];
  attempts: { id: string; title: string; kind: string; status: string; started_at: string; finished_at: string | null; result: { correct: number; total: number; percent: number | null } | null }[];
}

export default function ExamsPage() {
  const { data, error, loading, reload } = useApi<ExamsData>('/api/exams');
  const [per, setPer] = useState<Record<string, number>>({ LC: 10, CH: 10, CN: 10, MT: 10 });
  const [timed, setTimed] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  const start = async (examId: string, timerMode: 'official' | 'none') => {
    setBusy(examId);
    try { const a = await api<{ attemptId: string }>(`/api/exams/${examId}/start`, { body: { timerMode } }); router.push(`/simulados/prova/${a.attemptId}`); }
    catch (e) { toast('error', (e as Error).message); setBusy(null); }
  };
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  return (
    <div className="space-y-6">
      <PageHeader title="Simulados" description="Simulados ajudam a administrar o tempo, se familiarizar com a prova e identificar dificuldades. São opcionais." />
      <Card className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><ClipboardList className="size-5 text-primary" /> Simulado personalizado</h2>
        <p className="text-sm text-muted">Composto exclusivamente por questões oficiais de diferentes edições, priorizando as que você ainda não resolveu. Resultado por acertos (sem estimativa TRI).</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['LC', 'CH', 'CN', 'MT'] as const).map((a) => (
            <label key={a} className="text-sm"><span className="mb-1 block">{AREA_NAMES[a]}</span>
              <input type="number" min={0} max={45} value={per[a]} onChange={(e) => setPer({ ...per, [a]: Math.max(0, Math.min(45, Number(e.target.value))) })} className="h-10 w-full rounded-lg border border-border bg-surface px-3" /></label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} /> Cronometrar (tempo proporcional ao formato oficial; sem pausa)</label>
        <Button loading={busy === 'custom'} onClick={async () => {
          setBusy('custom');
          try {
            const e = await api<{ examId: string; shortfall: Record<string, number> }>('/api/exams', { body: { perArea: per, timed } });
            if (Object.keys(e.shortfall).length) toast('info', 'Algumas áreas têm menos questões publicadas do que o solicitado.');
            await start(e.examId, timed ? 'official' : 'none');
          } catch (err) { toast('error', (err as Error).message); setBusy(null); }
        }}>Montar e iniciar</Button>
      </Card>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="flex items-center gap-2 font-semibold"><Stethoscope className="size-5 text-primary" /> Diagnóstico completo (opcional)</h2>
          <p className="text-sm text-muted">Até 180 questões, sem cronômetro, com pausa e retomada. Não é obrigatório para estudar.</p></div>
        <Button variant="secondary" loading={busy === 'diag'} onClick={async () => {
          setBusy('diag');
          try { const d = await api<{ attemptId: string }>('/api/exams/diagnostic', { method: 'POST' }); router.push(`/simulados/prova/${d.attemptId}`); }
          catch (e) { toast('error', (e as Error).message); setBusy(null); }
        }}>Iniciar ou retomar</Button>
      </Card>
      <section>
        <h2 className="mb-2 font-semibold">Provas oficiais anteriores</h2>
        {data!.exams.filter((e) => e.kind === 'official').length === 0 ? <Empty title="Nenhuma prova oficial publicada ainda">As provas são publicadas após importação e validação do acervo oficial.</Empty> : (
          <ul className="space-y-2">{data!.exams.filter((e) => e.kind === 'official').map((e) => (
            <li key={e.id}><Card className="flex items-center justify-between py-3"><div><div className="font-medium">{e.title}</div><div className="text-xs text-muted">{e.items} questões{e.duration_minutes ? ` · ${Math.round(e.duration_minutes / 6) / 10} h` : ''}{e.includes_essay ? ' · com redação' : ''}</div></div>
              <Button size="sm" loading={busy === e.id} onClick={() => start(e.id, 'official')}>Iniciar</Button></Card></li>
          ))}</ul>
        )}
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Histórico</h2>
        {data!.attempts.length === 0 ? <Empty title="Nenhum simulado realizado" /> : (
          <ul className="space-y-2">{data!.attempts.map((a) => (
            <li key={a.id}><Link href={a.status === 'finished' ? `/simulados/resultado/${a.id}` : `/simulados/prova/${a.id}`} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 hover:bg-surface-2">
              <span>{a.title} <span className="text-xs text-muted">· {fmtDate(a.started_at)}</span></span>
              {a.status === 'finished' && a.result ? <Badge tone="success">{a.result.correct}/{a.result.total} ({a.result.percent ?? 0}%)</Badge> : <Badge>{a.status === 'paused' ? 'Pausado' : 'Em andamento'}</Badge>}
            </Link></li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
