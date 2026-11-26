/**
 * Regras de assinatura (11.10/13.7/15.9) — funções puras.
 * O estado é DERIVADO do conjunto autoritativo de pagamentos (persistidos a partir de webhooks
 * verificados e da reconciliação), o que torna o processamento robusto a eventos repetidos,
 * atrasados ou fora de ordem.
 */
export type PlanCode = 'free' | 'plus' | 'pro';
export const PLAN_RANK: Record<PlanCode, number> = { free: 0, plus: 1, pro: 2 };

export interface PaymentRecord {
  status: string; // status Asaas: PENDING, CONFIRMED, RECEIVED, OVERDUE, REFUNDED, ...
  dueDate: Date;
  paidAt: Date | null;
  refundedAt: Date | null;
}

export interface SubscriptionRecord {
  planCode: Exclude<PlanCode, 'free'>;
  cycle: 'monthly' | 'annual';
  status: 'pending' | 'active' | 'past_due' | 'canceled' | 'expired' | 'refunded';
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  graceUntil: Date | null;
}

const PAID = new Set(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']);
const REFUNDED = new Set(['REFUNDED', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE']);

export function addCycle(d: Date, cycle: 'monthly' | 'annual'): Date {
  const x = new Date(d.getTime());
  if (cycle === 'monthly') x.setUTCMonth(x.getUTCMonth() + 1);
  else x.setUTCFullYear(x.getUTCFullYear() + 1);
  return x;
}

export function deriveSubscriptionStatus(
  sub: Pick<SubscriptionRecord, 'cycle' | 'cancelAtPeriodEnd' | 'canceledAt'>,
  payments: PaymentRecord[],
  now: Date,
  graceDays: number,
): Pick<SubscriptionRecord, 'status' | 'currentPeriodEnd' | 'graceUntil'> & { firstPaidAt: Date | null } {
  const paid = payments.filter((p) => PAID.has(p.status)).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const refunded = payments.filter((p) => REFUNDED.has(p.status));
  const firstPaidAt = paid.length ? paid.reduce((m, p) => (p.paidAt && p.paidAt < m ? p.paidAt : m), paid[0]!.paidAt ?? paid[0]!.dueDate) : null;
  if (refunded.length && !paid.length) return { status: 'refunded', currentPeriodEnd: null, graceUntil: null, firstPaidAt };
  const lastPaid = paid.at(-1);
  const periodEnd = lastPaid ? addCycle(lastPaid.dueDate, sub.cycle) : null;
  const overdue = payments
    .filter((p) => p.status === 'OVERDUE' && (!lastPaid || p.dueDate > lastPaid.dueDate))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

  if (sub.canceledAt) {
    if (periodEnd && now < periodEnd && sub.cancelAtPeriodEnd) return { status: 'canceled', currentPeriodEnd: periodEnd, graceUntil: null, firstPaidAt };
    return { status: periodEnd ? 'canceled' : 'canceled', currentPeriodEnd: periodEnd, graceUntil: null, firstPaidAt };
  }
  if (overdue) {
    const graceUntil = new Date(overdue.dueDate.getTime() + graceDays * 86_400_000);
    return { status: now < graceUntil ? 'past_due' : 'expired', currentPeriodEnd: periodEnd, graceUntil, firstPaidAt };
  }
  if (!lastPaid) return { status: 'pending', currentPeriodEnd: null, graceUntil: null, firstPaidAt };
  if (periodEnd && now >= periodEnd) {
    // Período vencido sem nova cobrança registrada: tolerância antes de expirar.
    const graceUntil = new Date(periodEnd.getTime() + graceDays * 86_400_000);
    return { status: now < graceUntil ? 'past_due' : 'expired', currentPeriodEnd: periodEnd, graceUntil, firstPaidAt };
  }
  return { status: 'active', currentPeriodEnd: periodEnd, graceUntil: null, firstPaidAt };
}

export interface AccessGrant { planCode: Exclude<PlanCode, 'free'>; startsAt: Date; endsAt: Date; revokedAt: Date | null }

/** Plano efetivo: melhor entre assinatura vigente e acesso temporário; senão Gratuito (histórico preservado). */
export function effectivePlan(sub: SubscriptionRecord | null, grants: AccessGrant[], now: Date): {
  plan: PlanCode; source: 'free' | 'subscription' | 'grant'; until: Date | null;
} {
  let best: { plan: PlanCode; source: 'free' | 'subscription' | 'grant'; until: Date | null } = { plan: 'free', source: 'free', until: null };
  if (sub) {
    const live =
      (sub.status === 'active' && (!sub.currentPeriodEnd || now < sub.currentPeriodEnd)) ||
      (sub.status === 'past_due' && sub.graceUntil !== null && now < sub.graceUntil) ||
      (sub.status === 'canceled' && sub.cancelAtPeriodEnd && sub.currentPeriodEnd !== null && now < sub.currentPeriodEnd);
    if (live) best = { plan: sub.planCode, source: 'subscription', until: sub.status === 'past_due' ? sub.graceUntil : sub.currentPeriodEnd };
  }
  for (const g of grants) {
    if (g.revokedAt || now < g.startsAt || now >= g.endsAt) continue;
    if (PLAN_RANK[g.planCode] > PLAN_RANK[best.plan]) best = { plan: g.planCode, source: 'grant', until: g.endsAt };
  }
  return best;
}

/** Direito de arrependimento (CDC art. 49): 7 dias desde o primeiro pagamento. */
export function withinWithdrawal(firstPaidAt: Date | null, now: Date, days = 7): boolean {
  return firstPaidAt !== null && now.getTime() - firstPaidAt.getTime() <= days * 86_400_000;
}

export type PlanChange = 'upgrade_immediate' | 'downgrade_at_period_end' | 'same' | 'new';
export function classifyPlanChange(current: PlanCode, target: PlanCode): PlanChange {
  if (current === 'free') return 'new';
  if (current === target) return 'same';
  return PLAN_RANK[target] > PLAN_RANK[current] ? 'upgrade_immediate' : 'downgrade_at_period_end';
}
