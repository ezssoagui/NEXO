import { randomUUID } from 'node:crypto';
import type { DB } from '../db';
import {
  ADDONS,
  CDC_REFUND_WINDOW_DAYS,
  DAY_MS,
  GRACE_PERIOD_DAYS,
  PLANS,
  type AddonCode,
  type PaymentMethod,
  type PlanCode,
} from '../config/plans';
import { QuotasRepository } from './quotas';

/**
 * Repositório Comercial: Payers (separados do estudante), Subscriptions (máquina de estados)
 * e PaymentEvents (idempotência por event_id + proteção contra eventos fora de ordem).
 * FR-006 a FR-010.
 */
export type SubscriptionStatus = 'pending' | 'active' | 'grace_period' | 'canceled_until_end' | 'suspended' | 'refunded';

export interface SubscriptionRow {
  id: string;
  userId: string;
  payerId: string;
  planCode: PlanCode;
  paymentMethod: PaymentMethod;
  status: SubscriptionStatus;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cdcDeadlineAt: number;
  graceUntil: number | null;
  externalSubscriptionId: string | null;
  lastEventTs: number;
  updatedAt: number;
}

export interface PaymentEventInput {
  eventId: string;
  eventType: 'payment_confirmed' | 'payment_failed' | 'refund_confirmed' | 'addon_confirmed' | 'subscription_canceled';
  eventTs: number;
  externalSubscriptionId?: string;
  userId?: string;
  addonCode?: AddonCode;
  payload?: Record<string, unknown>;
}

export function hasActivePedagogicalAccess(sub: SubscriptionRow | null, now = Date.now()): boolean {
  if (!sub) return false;
  if (sub.status === 'active') return true;
  if (sub.status === 'canceled_until_end') return now <= sub.currentPeriodEnd;
  if (sub.status === 'grace_period') return sub.graceUntil !== null && now <= sub.graceUntil;
  return false;
}

export class BillingRepository {
  private quotas: QuotasRepository;
  constructor(private db: DB) {
    this.quotas = new QuotasRepository(db);
  }

  createPayer(input: { externalCustomerId: string; financialEmail: string; payerName: string; isGuardian: boolean; documentLast4?: string }) {
    const id = randomUUID();
    this.db.raw
      .prepare('INSERT INTO payers (id, external_customer_id, financial_email, payer_name, is_guardian, document_last4, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, input.externalCustomerId, input.financialEmail.trim().toLowerCase(), input.payerName.trim(), input.isGuardian ? 1 : 0, input.documentLast4 ?? null, Date.now());
    return id;
  }

  getPayerById(payerId: string) {
    return this.db.raw.prepare('SELECT * FROM payers WHERE id = ?').get(payerId) as any;
  }

  createPendingSubscription(input: {
    userId: string;
    payerId: string;
    planCode: PlanCode;
    paymentMethod: PaymentMethod;
    externalSubscriptionId: string;
    now?: number;
  }): SubscriptionRow {
    const now = input.now ?? Date.now();
    const id = randomUUID();
    const plan = PLANS[input.planCode];
    const periodEnd = now + plan.billingIntervalDays * DAY_MS;
    const cdcDeadline = now + CDC_REFUND_WINDOW_DAYS * DAY_MS;

    this.db.raw
      .prepare(
        `INSERT INTO subscriptions (id, user_id, payer_id, plan_code, payment_method, status, current_period_start, current_period_end, cdc_deadline_at, grace_until, external_subscription_id, last_event_ts, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, NULL, ?, 0, ?)`,
      )
      .run(id, input.userId, input.payerId, input.planCode, input.paymentMethod, now, periodEnd, cdcDeadline, input.externalSubscriptionId, now);

    return this.getById(id)!;
  }

  getById(id: string): SubscriptionRow | null {
    const r = this.db.raw.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id) as any;
    return r ? this.mapSub(r) : null;
  }

  getByExternalId(externalId: string): SubscriptionRow | null {
    const r = this.db.raw.prepare('SELECT * FROM subscriptions WHERE external_subscription_id = ?').get(externalId) as any;
    return r ? this.mapSub(r) : null;
  }

  getLatestForUser(userId: string, now = Date.now()): SubscriptionRow | null {
    const r = this.db.raw.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1').get(userId) as any;
    if (!r) return null;
    const sub = this.mapSub(r);
    return this.reconcileTimeBasedTransitions(sub, now);
  }

  /**
   * Reconcilia transições automáticas por expiração de prazo (fim de grace_period ou fim de canceled_until_end).
   */
  reconcileTimeBasedTransitions(sub: SubscriptionRow, now = Date.now()): SubscriptionRow {
    if (sub.status === 'grace_period' && sub.graceUntil !== null && now > sub.graceUntil) {
      this.db.raw.prepare("UPDATE subscriptions SET status = 'suspended', updated_at = ? WHERE id = ?").run(now, sub.id);
      return { ...sub, status: 'suspended', updatedAt: now };
    }
    if (sub.status === 'canceled_until_end' && now > sub.currentPeriodEnd) {
      this.db.raw.prepare("UPDATE subscriptions SET status = 'suspended', updated_at = ? WHERE id = ?").run(now, sub.id);
      return { ...sub, status: 'suspended', updatedAt: now };
    }
    return sub;
  }

  /**
   * Processamento idempotente de eventos do gateway (FR-008 e FR-009).
   * - Ignora eventos já registrados em payment_events (duplicados).
   * - Ignora eventos de assinatura mais antigos que last_event_ts (fora de ordem).
   */
  processPaymentEvent(ev: PaymentEventInput, now = Date.now()) {
    const existing = this.db.raw.prepare('SELECT event_id FROM payment_events WHERE event_id = ?').get(ev.eventId);
    if (existing) {
      return { processed: false, duplicate: true, outOfOrder: false, subscription: ev.externalSubscriptionId ? this.getByExternalId(ev.externalSubscriptionId) : null };
    }

    // Pacote avulso (add-on)
    if (ev.eventType === 'addon_confirmed') {
      if (!ev.userId || !ev.addonCode || !ADDONS[ev.addonCode]) {
        throw new Error('Evento addon_confirmed inválido: userId e addonCode obrigatórios.');
      }
      const sub = this.getLatestForUser(ev.userId, now);
      this.db.raw.exec('BEGIN');
      try {
        this.db.raw
          .prepare('INSERT INTO payment_events (event_id, subscription_id, event_type, event_ts, payload_json, processed_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(ev.eventId, sub?.id ?? null, ev.eventType, ev.eventTs, JSON.stringify(ev.payload ?? {}), now);
        this.quotas.creditAddon(ev.userId, ev.addonCode, ev.eventId, now);
        this.db.raw.exec('COMMIT');
      } catch (e) {
        this.db.raw.exec('ROLLBACK');
        throw e;
      }
      return { processed: true, duplicate: false, outOfOrder: false, subscription: sub };
    }

    if (!ev.externalSubscriptionId) {
      throw new Error('externalSubscriptionId obrigatório para eventos de assinatura.');
    }
    const sub = this.getByExternalId(ev.externalSubscriptionId);
    if (!sub) {
      return { processed: false, duplicate: false, outOfOrder: false, subscription: null };
    }

    // Proteção contra evento fora de ordem (ex.: payment_confirmed atrasado após refund_confirmed)
    if (ev.eventTs < sub.lastEventTs) {
      this.db.raw
        .prepare('INSERT INTO payment_events (event_id, subscription_id, event_type, event_ts, payload_json, processed_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(ev.eventId, sub.id, `${ev.eventType}:ignored_out_of_order`, ev.eventTs, JSON.stringify(ev.payload ?? {}), now);
      return { processed: false, duplicate: false, outOfOrder: true, subscription: sub };
    }

    let nextStatus: SubscriptionStatus = sub.status;
    let periodStart = sub.currentPeriodStart;
    let periodEnd = sub.currentPeriodEnd;
    let cdcDeadline = sub.cdcDeadlineAt;
    let graceUntil = sub.graceUntil;
    const plan = PLANS[sub.planCode];

    if (ev.eventType === 'payment_confirmed') {
      const wasFirstActivation = sub.status === 'pending';
      nextStatus = 'active';
      periodStart = ev.eventTs;
      periodEnd = ev.eventTs + plan.billingIntervalDays * DAY_MS;
      if (wasFirstActivation) {
        cdcDeadline = ev.eventTs + CDC_REFUND_WINDOW_DAYS * DAY_MS;
      }
      graceUntil = null;
    } else if (ev.eventType === 'payment_failed') {
      if (sub.status === 'active') {
        nextStatus = 'grace_period';
        graceUntil = ev.eventTs + GRACE_PERIOD_DAYS * DAY_MS;
      }
    } else if (ev.eventType === 'refund_confirmed') {
      nextStatus = 'refunded';
      graceUntil = null;
    } else if (ev.eventType === 'subscription_canceled') {
      if (sub.status === 'grace_period') {
        nextStatus = 'suspended';
        graceUntil = null;
      } else if (sub.status === 'active') {
        nextStatus = 'canceled_until_end';
      }
    }

    this.db.raw.exec('BEGIN');
    try {
      this.db.raw
        .prepare('INSERT INTO payment_events (event_id, subscription_id, event_type, event_ts, payload_json, processed_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(ev.eventId, sub.id, ev.eventType, ev.eventTs, JSON.stringify(ev.payload ?? {}), now);

      this.db.raw
        .prepare(
          `UPDATE subscriptions
           SET status = ?, current_period_start = ?, current_period_end = ?, cdc_deadline_at = ?, grace_until = ?, last_event_ts = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(nextStatus, periodStart, periodEnd, cdcDeadline, graceUntil, ev.eventTs, now, sub.id);

      if (ev.eventType === 'payment_confirmed') {
        this.quotas.ensureActiveMonthlyCycle(sub.userId, ev.eventTs);
      }

      this.db.raw.exec('COMMIT');
    } catch (e) {
      this.db.raw.exec('ROLLBACK');
      throw e;
    }

    return { processed: true, duplicate: false, outOfOrder: false, subscription: this.getById(sub.id) };
  }

  /**
   * Cancelamento solicitado pelo assinante:
   * - Dentro de 7 dias da 1ª ativação (CDC): reembolso integral imediato -> `refunded`.
   * - Durante `grace_period`: encerra tentativas e suspende imediatamente -> `suspended`.
   * - Após 7 dias em `active`: encerra renovação mantendo acesso até o fim do período -> `canceled_until_end`.
   */
  requestCancel(userId: string, now = Date.now()) {
    const sub = this.getLatestForUser(userId, now);
    if (!sub) return { ok: false as const, status: 404, message: 'Nenhuma assinatura encontrada.' };
    if (sub.status === 'refunded' || sub.status === 'suspended') {
      return { ok: false as const, status: 400, message: `Assinatura já está no estado ${sub.status}.` };
    }

    if (sub.status === 'active' && now <= sub.cdcDeadlineAt) {
      this.db.raw
        .prepare("UPDATE subscriptions SET status = 'refunded', grace_until = NULL, last_event_ts = ?, updated_at = ? WHERE id = ?")
        .run(Math.max(sub.lastEventTs, now), now, sub.id);
      return { ok: true as const, outcome: 'cdc_refunded' as const, subscription: this.getById(sub.id)! };
    }

    if (sub.status === 'grace_period') {
      this.db.raw
        .prepare("UPDATE subscriptions SET status = 'suspended', grace_until = NULL, last_event_ts = ?, updated_at = ? WHERE id = ?")
        .run(Math.max(sub.lastEventTs, now), now, sub.id);
      return { ok: true as const, outcome: 'suspended_from_grace' as const, subscription: this.getById(sub.id)! };
    }

    this.db.raw
      .prepare("UPDATE subscriptions SET status = 'canceled_until_end', last_event_ts = ?, updated_at = ? WHERE id = ?")
      .run(Math.max(sub.lastEventTs, now), now, sub.id);
    return { ok: true as const, outcome: 'canceled_until_end' as const, subscription: this.getById(sub.id)! };
  }

  /**
   * Upgrade de NEXO Mensal ativo para NEXO Anual preservando histórico, saldo avulso e tempo restante do mês pago.
   */
  upgradeMonthlyToAnnual(userId: string, now = Date.now()) {
    const sub = this.getLatestForUser(userId, now);
    if (!sub || sub.status !== 'active') {
      return { ok: false as const, status: 400, message: 'É necessário ter uma assinatura ativa para migrar ao plano Anual.' };
    }
    if (sub.planCode === 'nexo_annual') {
      return { ok: false as const, status: 400, message: 'Sua assinatura já é NEXO Anual.' };
    }
    const remainingMs = Math.max(0, sub.currentPeriodEnd - now);
    const newPeriodEnd = now + remainingMs + PLANS.nexo_annual.billingIntervalDays * DAY_MS;

    this.db.raw
      .prepare("UPDATE subscriptions SET plan_code = 'nexo_annual', current_period_end = ?, updated_at = ? WHERE id = ?")
      .run(newPeriodEnd, now, sub.id);

    return { ok: true as const, subscription: this.getById(sub.id)! };
  }

  summaryCounts() {
    const rows = this.db.raw.prepare('SELECT status, plan_code, COUNT(*) as n FROM subscriptions GROUP BY status, plan_code').all() as any[];
    const byStatus: Record<string, number> = {};
    const byPlan: Record<string, number> = {};
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + r.n;
      byPlan[r.plan_code] = (byPlan[r.plan_code] ?? 0) + r.n;
    }
    return { byStatus, byPlan };
  }

  private mapSub(r: any): SubscriptionRow {
    return {
      id: r.id,
      userId: r.user_id,
      payerId: r.payer_id,
      planCode: r.plan_code,
      paymentMethod: r.payment_method,
      status: r.status,
      currentPeriodStart: r.current_period_start,
      currentPeriodEnd: r.current_period_end,
      cdcDeadlineAt: r.cdc_deadline_at,
      graceUntil: r.grace_until ?? null,
      externalSubscriptionId: r.external_subscription_id ?? null,
      lastEventTs: r.last_event_ts ?? 0,
      updatedAt: r.updated_at,
    };
  }
}
