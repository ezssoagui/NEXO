import { randomUUID } from 'node:crypto';
import type { DB } from '../db';
import { ADDONS, DAY_MS, DEFAULT_MONTHLY_QUOTAS, MONTHLY_CYCLE_DAYS, type AddonCode, type QuotaKind } from '../config/plans';

/**
 * Repositório Atômico de Cotas de IA (FR-011 a FR-017).
 * - Renovação mensal sem acúmulo (inclusive no plano Anual).
 * - Precedência estrita: cota mensal vigente -> pacote avulso válido mais próximo do vencimento.
 * - Transação atômica: reserve -> commit | refund (estorno garantido em falha total de IA).
 */
export interface QuotaSnapshot {
  cycleStart: number;
  cycleEnd: number;
  monthly: Record<QuotaKind, { limit: number; used: number; remaining: number }>;
  addons: Record<QuotaKind, number>;
  totalRemaining: Record<QuotaKind, number>;
}

export interface Reservation {
  ledgerId: string;
  operationId: string;
  kind: QuotaKind;
  source: 'monthly_cycle' | 'addon';
  sourceId: string;
}

const COL_MAP: Record<QuotaKind, { limit: string; used: string }> = {
  essay: { limit: 'essay_limit', used: 'essay_used' },
  tutor: { limit: 'tutor_limit', used: 'tutor_used' },
  question_gen: { limit: 'question_gen_limit', used: 'question_gen_used' },
};

export class QuotasRepository {
  constructor(private db: DB) {}

  ensureActiveMonthlyCycle(userId: string, now = Date.now()) {
    const existing = this.db.raw
      .prepare('SELECT * FROM ai_quota_cycles WHERE user_id = ? AND cycle_start <= ? AND cycle_end > ? ORDER BY cycle_end DESC LIMIT 1')
      .get(userId, now, now) as any;
    if (existing) return existing;

    const id = randomUUID();
    const cycleEnd = now + MONTHLY_CYCLE_DAYS * DAY_MS;
    this.db.raw
      .prepare(
        `INSERT INTO ai_quota_cycles (id, user_id, cycle_start, cycle_end, essay_limit, essay_used, tutor_limit, tutor_used, question_gen_limit, question_gen_used)
         VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?, 0)`,
      )
      .run(id, userId, now, cycleEnd, DEFAULT_MONTHLY_QUOTAS.essay, DEFAULT_MONTHLY_QUOTAS.tutor, DEFAULT_MONTHLY_QUOTAS.question_gen);

    return this.db.raw.prepare('SELECT * FROM ai_quota_cycles WHERE id = ?').get(id) as any;
  }

  getSnapshot(userId: string, now = Date.now()): QuotaSnapshot {
    const c = this.ensureActiveMonthlyCycle(userId, now);
    const addonRows = this.db.raw
      .prepare('SELECT kind, COALESCE(SUM(credits_remaining), 0) AS rem FROM ai_addon_balances WHERE user_id = ? AND expires_at > ? GROUP BY kind')
      .all(userId, now) as any[];
    const addons: Record<QuotaKind, number> = { essay: 0, tutor: 0, question_gen: 0 };
    for (const r of addonRows) addons[r.kind as QuotaKind] = r.rem;

    const monthly = {
      essay: { limit: c.essay_limit, used: c.essay_used, remaining: Math.max(0, c.essay_limit - c.essay_used) },
      tutor: { limit: c.tutor_limit, used: c.tutor_used, remaining: Math.max(0, c.tutor_limit - c.tutor_used) },
      question_gen: { limit: c.question_gen_limit, used: c.question_gen_used, remaining: Math.max(0, c.question_gen_limit - c.question_gen_used) },
    };

    return {
      cycleStart: c.cycle_start,
      cycleEnd: c.cycle_end,
      monthly,
      addons,
      totalRemaining: {
        essay: monthly.essay.remaining + addons.essay,
        tutor: monthly.tutor.remaining + addons.tutor,
        question_gen: monthly.question_gen.remaining + addons.question_gen,
      },
    };
  }

  creditAddon(userId: string, addonCode: AddonCode, paymentEventId: string, now = Date.now()) {
    const def = ADDONS[addonCode];
    const id = randomUUID();
    this.db.raw
      .prepare(
        `INSERT INTO ai_addon_balances (id, user_id, kind, credits_total, credits_remaining, payment_event_id, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, userId, def.kind, def.credits, def.credits, paymentEventId, now + def.validityDays * DAY_MS, now);
    return id;
  }

  /**
   * Reserva atomicamente 1 crédito (primeiro cota mensal, depois pacote avulso mais próximo do vencimento).
   */
  reserve(userId: string, kind: QuotaKind, reason: string, operationId = randomUUID(), now = Date.now()): { ok: true; reservation: Reservation } | { ok: false; error: 'quota_exceeded' } {
    const cycle = this.ensureActiveMonthlyCycle(userId, now);
    const cols = COL_MAP[kind];

    this.db.raw.exec('BEGIN IMMEDIATE');
    try {
      const freshCycle = this.db.raw.prepare('SELECT * FROM ai_quota_cycles WHERE id = ?').get(cycle.id) as any;
      let source: 'monthly_cycle' | 'addon' | null = null;
      let sourceId: string | null = null;

      if (freshCycle[cols.used] < freshCycle[cols.limit]) {
        this.db.raw.prepare(`UPDATE ai_quota_cycles SET ${cols.used} = ${cols.used} + 1 WHERE id = ?`).run(freshCycle.id);
        source = 'monthly_cycle';
        sourceId = freshCycle.id;
      } else {
        const addon = this.db.raw
          .prepare('SELECT id FROM ai_addon_balances WHERE user_id = ? AND kind = ? AND credits_remaining > 0 AND expires_at > ? ORDER BY expires_at ASC LIMIT 1')
          .get(userId, kind, now) as any;
        if (addon) {
          this.db.raw.prepare('UPDATE ai_addon_balances SET credits_remaining = credits_remaining - 1 WHERE id = ?').run(addon.id);
          source = 'addon';
          sourceId = addon.id;
        }
      }

      if (!source || !sourceId) {
        this.db.raw.exec('ROLLBACK');
        return { ok: false, error: 'quota_exceeded' };
      }

      const ledgerId = randomUUID();
      this.db.raw
        .prepare(
          `INSERT INTO ai_quota_ledger (id, user_id, kind, source, source_id, delta, status, operation_id, reason, created_at)
           VALUES (?, ?, ?, ?, ?, -1, 'reserved', ?, ?, ?)`,
        )
        .run(ledgerId, userId, kind, source, sourceId, operationId, reason, now);

      this.db.raw.exec('COMMIT');
      return { ok: true, reservation: { ledgerId, operationId, kind, source, sourceId } };
    } catch (e) {
      this.db.raw.exec('ROLLBACK');
      throw e;
    }
  }

  commit(reservation: Reservation) {
    this.db.raw.prepare("UPDATE ai_quota_ledger SET status = 'committed' WHERE id = ? AND status = 'reserved'").run(reservation.ledgerId);
  }

  /**
   * Estorno automático atômico em falha total dos provedores de IA (FR-017).
   * Restaura exatamente a origem debitada (monthly_cycle ou addon).
   */
  refund(reservation: Reservation, reason = 'provider_total_failure_refund', now = Date.now()) {
    const cols = COL_MAP[reservation.kind];
    this.db.raw.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.raw.prepare('SELECT status FROM ai_quota_ledger WHERE id = ?').get(reservation.ledgerId) as any;
      if (!row || row.status === 'refunded') {
        this.db.raw.exec('COMMIT');
        return;
      }
      if (reservation.source === 'monthly_cycle') {
        this.db.raw.prepare(`UPDATE ai_quota_cycles SET ${cols.used} = MAX(0, ${cols.used} - 1) WHERE id = ?`).run(reservation.sourceId);
      } else {
        this.db.raw.prepare('UPDATE ai_addon_balances SET credits_remaining = credits_remaining + 1 WHERE id = ?').run(reservation.sourceId);
      }
      this.db.raw.prepare("UPDATE ai_quota_ledger SET status = 'refunded', reason = ? WHERE id = ?").run(reason, reservation.ledgerId);
      this.db.raw
        .prepare(
          `INSERT INTO ai_quota_ledger (id, user_id, kind, source, source_id, delta, status, operation_id, reason, created_at)
           SELECT ?, user_id, kind, source, source_id, 1, 'refunded', ?, ?, ? FROM ai_quota_ledger WHERE id = ?`,
        )
        .run(randomUUID(), `${reservation.operationId}:refund`, reason, now, reservation.ledgerId);
      this.db.raw.exec('COMMIT');
    } catch (e) {
      this.db.raw.exec('ROLLBACK');
      throw e;
    }
  }

  /**
   * Ajuste/estorno manual operacional pelo Admin (FR-038), gravado com trilha auditável.
   */
  adminAdjust(userId: string, kind: QuotaKind, delta: number, reason: string, adminUserId: string, now = Date.now()) {
    if (!Number.isInteger(delta) || delta === 0) throw new Error('Delta de ajuste deve ser inteiro diferente de zero.');
    const opId = `admin_adj_${randomUUID()}`;
    this.db.raw.exec('BEGIN IMMEDIATE');
    try {
      let sourceId: string;
      if (delta > 0) {
        sourceId = randomUUID();
        this.db.raw
          .prepare(
            `INSERT INTO ai_addon_balances (id, user_id, kind, credits_total, credits_remaining, payment_event_id, expires_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(sourceId, userId, kind, delta, delta, opId, now + 365 * DAY_MS, now);
      } else {
        const cycle = this.ensureActiveMonthlyCycle(userId, now);
        const cols = COL_MAP[kind];
        sourceId = cycle.id;
        this.db.raw.prepare(`UPDATE ai_quota_cycles SET ${cols.used} = MIN(${cols.limit}, ${cols.used} + ?) WHERE id = ?`).run(Math.abs(delta), cycle.id);
      }
      this.db.raw
        .prepare(
          `INSERT INTO ai_quota_ledger (id, user_id, kind, source, source_id, delta, status, operation_id, reason, created_at)
           VALUES (?, ?, ?, 'admin_grant', ?, ?, 'committed', ?, ?, ?)`,
        )
        .run(randomUUID(), userId, kind, sourceId, delta, opId, reason, now);
      this.db.raw
        .prepare('INSERT INTO admin_audit_logs (id, admin_user_id, action, target_id, reason, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(randomUUID(), adminUserId, 'quota_adjust', userId, reason, JSON.stringify({ kind, delta, operationId: opId }), now);
      this.db.raw.exec('COMMIT');
    } catch (e) {
      this.db.raw.exec('ROLLBACK');
      throw e;
    }
    return this.getSnapshot(userId, now);
  }
}
