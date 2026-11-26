import Link from 'next/link';
import { Check } from 'lucide-react';
import { asService } from '@/server/db';
import { plansCatalog } from '@/server/services/commerce';

export const dynamic = 'force-dynamic';

const LABELS: Record<string, string> = {
  questions: 'Questões oficiais', adaptive_sessions: 'Sessões adaptativas', flashcards: 'Flashcards', explanations: 'Explicações ativas com IA',
  essays: 'Redações completas', rewrites: 'Reescritas', discursive: 'Exercícios discursivos', exams: 'Simulados',
};
const fmt = (l: { limit_value: number | null; period: string }) => (l.limit_value === null ? 'Ilimitado' : `${l.limit_value}/${l.period === 'day' ? 'dia' : 'mês'}`);
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function PlansPage() {
  const plans = await asService((tx) => plansCatalog(tx));
  const order = ['questions', 'adaptive_sessions', 'flashcards', 'explanations', 'essays', 'rewrites', 'discursive', 'exams'];
  return (
    <div>
      <h1 className="text-3xl font-bold">Planos</h1>
      <p className="mt-2 max-w-2xl text-muted">A mesma metodologia e a mesma qualidade de correção em todos os planos. Repertórios, mapa de domínio, indicadores, gamificação e ranking são completos em todos.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div key={p.code} className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-xl font-semibold">{p.name}</h2>
            <p className="mt-1 text-sm text-muted">
              {p.code === 'free' ? 'Gratuito, sem expiração'
                : p.monthly_price_cents ? `${brl(p.monthly_price_cents)}/mês · ${brl(p.annual_price_cents!)}/ano` : 'Preço em definição'}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {order.map((r) => {
                const l = p.limits.find((x) => x.resource === r);
                return l ? <li key={r} className="flex gap-2"><Check className="size-4 shrink-0 text-success" />{LABELS[r]}: <strong>{fmt(l)}</strong></li> : null;
              })}
              <li className="flex gap-2"><Check className="size-4 shrink-0 text-success" />Aulas e microaulas: <strong>{p.code === 'free' ? 'Limitado' : 'Completo'}</strong></li>
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">“Ilimitado” significa uso legítimo sem quota comercial de atividade. Sem publicidade e sem venda de dados. <Link href="/cadastro" className="text-primary">Comece grátis</Link>.</p>
    </div>
  );
}
