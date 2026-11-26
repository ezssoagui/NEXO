'use client';

import Link from 'next/link';
import { useApi } from '@/lib/api';
import { Card, ErrorState, Loading, PageHeader, Stat } from '@/components/ui';

interface Overview { users: number; active_7d: number; active_30d: number; paying: number; grants: number; open_alerts: number; open_feedback: number; pending_reviews: number; failed_webhooks: number; mrrCents: number; monthRevenueCents: number; aiSpendUsdMonth: number }
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AdminOverview() {
  const { data, error, loading, reload } = useApi<Overview>('/api/admin/overview');
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;
  return (
    <div className="space-y-4">
      <PageHeader title="Visão geral" />
      <Card className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Usuários" value={data.users} /><Stat label="Ativos 7 dias" value={data.active_7d} /><Stat label="Ativos 30 dias" value={data.active_30d} /><Stat label="Assinantes" value={data.paying} hint={`${data.grants} acessos temporários`} />
        <Stat label="MRR" value={brl(data.mrrCents)} /><Stat label="Receita do mês" value={brl(data.monthRevenueCents)} /><Stat label="IA no mês" value={`US$ ${data.aiSpendUsdMonth.toFixed(2)}`} />
      </Card>
      <div className="grid gap-3 md:grid-cols-4">
        <Link href="/admin/monitoramento"><Card className="hover:bg-surface-2"><Stat label="Alertas abertos" value={data.open_alerts} /></Card></Link>
        <Link href="/admin/feedback"><Card className="hover:bg-surface-2"><Stat label="Feedback aberto" value={data.open_feedback} /></Card></Link>
        <Link href="/admin/conteudo"><Card className="hover:bg-surface-2"><Stat label="Revisões pendentes" value={data.pending_reviews} /></Card></Link>
        <Link href="/admin/monitoramento"><Card className="hover:bg-surface-2"><Stat label="Webhooks com falha" value={data.failed_webhooks} /></Card></Link>
      </div>
    </div>
  );
}
