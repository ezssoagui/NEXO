import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type DB } from '../../server/db';
import { UsersRepository } from '../../server/repositories/users';
import { BillingRepository, hasActivePedagogicalAccess } from '../../server/repositories/billing';
import { QuotasRepository } from '../../server/repositories/quotas';
import { LocalPaymentGateway } from '../../server/gateways/payment';
import { createBillingRoutes } from '../../server/routes/billing';
import { DAY_MS } from '../../server/config/plans';

describe('US1: Ciclo comercial 100% pago, máquina de estados, idempotência e cotas', () => {
  let db: DB;
  let users: UsersRepository;
  let billing: BillingRepository;
  let quotas: QuotasRepository;
  let routes: ReturnType<typeof createBillingRoutes>;

  beforeEach(() => {
    db = openDb(':memory:');
    users = new UsersRepository(db);
    billing = new BillingRepository(db);
    quotas = new QuotasRepository(db);
    routes = createBillingRoutes(db, new LocalPaymentGateway());
  });

  function makeStudent(email = 'aluno@nexo.edu.br', nick = 'Pedro') {
    const r = users.register({ email, password: 'Password123', nickname: nick, isMinor: true, lgpdConsent: true });
    if (!r.ok) throw new Error(r.message);
    return r.user;
  }

  it('bloqueia acesso pedagógico sem assinatura (100% pago, sem free nem trial)', () => {
    const u = makeStudent();
    expect(hasActivePedagogicalAccess(billing.getLatestForUser(u.id))).toBe(false);
  });

  it('ativa plano Anual via Pix com pagador responsável, garante idempotência e protege contra eventos fora de ordem', async () => {
    const u = makeStudent();
    const t0 = 1_700_000_000_000;
    const chk = await routes.checkout(u, {
      planCode: 'nexo_annual',
      paymentMethod: 'pix',
      payer: { name: 'Maria Responsável', financialEmail: 'mae@email.com', isGuardian: true, documentLast4: '9876' },
    });
    expect(chk.status).toBe(201);
    const extId = (chk.body as any).subscription.externalSubscriptionId;

    // 1. Confirmação de pagamento
    const ev1 = billing.processPaymentEvent({ eventId: 'ev-1', eventType: 'payment_confirmed', eventTs: t0, externalSubscriptionId: extId }, t0);
    expect(ev1.processed).toBe(true);
    expect(ev1.subscription?.status).toBe('active');
    expect(hasActivePedagogicalAccess(ev1.subscription, t0)).toBe(true);

    // 2. Evento duplicado é ignorado de forma idempotente
    const dup = billing.processPaymentEvent({ eventId: 'ev-1', eventType: 'payment_confirmed', eventTs: t0, externalSubscriptionId: extId }, t0 + 1000);
    expect(dup.duplicate).toBe(true);
    expect(dup.processed).toBe(false);

    // 3. Reembolso confirmado em t0 + 2 dias
    const ref = billing.processPaymentEvent({ eventId: 'ev-ref', eventType: 'refund_confirmed', eventTs: t0 + 2 * DAY_MS, externalSubscriptionId: extId }, t0 + 2 * DAY_MS);
    expect(ref.subscription?.status).toBe('refunded');
    expect(hasActivePedagogicalAccess(ref.subscription, t0 + 2 * DAY_MS)).toBe(false);

    // 4. Evento antigo fora de ordem (t0 + 1 dia) NÃO pode reativar assinatura já reembolsada
    const late = billing.processPaymentEvent({ eventId: 'ev-late', eventType: 'payment_confirmed', eventTs: t0 + 1 * DAY_MS, externalSubscriptionId: extId }, t0 + 3 * DAY_MS);
    expect(late.outOfOrder).toBe(true);
    expect(billing.getLatestForUser(u.id)?.status).toBe('refunded');
  });

  it('respeita direito de arrependimento CDC (<= 7 dias) e cancelamento pós-7 dias (acesso até fim do ciclo -> suspensa preservando histórico)', async () => {
    const u1 = makeStudent('u1@nexo.edu.br', 'Lia');
    const t0 = 1_700_000_000_000;
    const c1 = await routes.checkout(u1, {
      planCode: 'nexo_monthly',
      paymentMethod: 'credit_card',
      payer: { name: 'Lia', financialEmail: 'u1@nexo.edu.br', isGuardian: false },
    });
    const ext1 = (c1.body as any).subscription.externalSubscriptionId;
    billing.processPaymentEvent({ eventId: 'e1', eventType: 'payment_confirmed', eventTs: t0, externalSubscriptionId: ext1 }, t0);

    // Dia 5 (<= 7 dias) -> CDC refund imediato
    const cancelCdc = await routes.cancel(u1, t0 + 5 * DAY_MS);
    expect(cancelCdc.status).toBe(200);
    expect((cancelCdc.body as any).outcome).toBe('cdc_refunded');
    expect((cancelCdc.body as any).subscription.status).toBe('refunded');
    expect(hasActivePedagogicalAccess(billing.getLatestForUser(u1.id, t0 + 5 * DAY_MS), t0 + 5 * DAY_MS)).toBe(false);

    // Segundo usuário cancela no dia 10 (> 7 dias) -> mantém acesso até o dia 30, depois suspende
    const u2 = makeStudent('u2@nexo.edu.br', 'Caio');
    const c2 = await routes.checkout(u2, {
      planCode: 'nexo_monthly',
      paymentMethod: 'credit_card',
      payer: { name: 'Caio', financialEmail: 'u2@nexo.edu.br', isGuardian: false },
    });
    const ext2 = (c2.body as any).subscription.externalSubscriptionId;
    billing.processPaymentEvent({ eventId: 'e2', eventType: 'payment_confirmed', eventTs: t0, externalSubscriptionId: ext2 }, t0);

    const cancelLate = await routes.cancel(u2, t0 + 10 * DAY_MS);
    expect((cancelLate.body as any).outcome).toBe('canceled_until_end');
    expect(hasActivePedagogicalAccess(billing.getLatestForUser(u2.id, t0 + 20 * DAY_MS), t0 + 20 * DAY_MS)).toBe(true);

    // Após dia 30 -> transita para suspended automaticamente
    const afterPeriod = billing.getLatestForUser(u2.id, t0 + 31 * DAY_MS);
    expect(afterPeriod?.status).toBe('suspended');
    expect(hasActivePedagogicalAccess(afterPeriod, t0 + 31 * DAY_MS)).toBe(false);
  });

  it('aplica janela de tolerância de 3 dias na inadimplência e suspende após expirar ou cancelar na tolerância', async () => {
    const u = makeStudent('grace@nexo.edu.br', 'Iara');
    const t0 = 1_700_000_000_000;
    const c = await routes.checkout(u, {
      planCode: 'nexo_monthly',
      paymentMethod: 'credit_card',
      payer: { name: 'Iara', financialEmail: 'grace@nexo.edu.br', isGuardian: false },
    });
    const ext = (c.body as any).subscription.externalSubscriptionId;
    billing.processPaymentEvent({ eventId: 'g1', eventType: 'payment_confirmed', eventTs: t0, externalSubscriptionId: ext }, t0);

    // Falha de renovação no dia 30 -> grace_period de 3 dias
    const failTs = t0 + 30 * DAY_MS;
    billing.processPaymentEvent({ eventId: 'g2', eventType: 'payment_failed', eventTs: failTs, externalSubscriptionId: ext }, failTs);
    const inGrace = billing.getLatestForUser(u.id, failTs + 2 * DAY_MS);
    expect(inGrace?.status).toBe('grace_period');
    expect(hasActivePedagogicalAccess(inGrace, failTs + 2 * DAY_MS)).toBe(true);

    // Passados 3 dias -> suspended
    const expired = billing.getLatestForUser(u.id, failTs + 4 * DAY_MS);
    expect(expired?.status).toBe('suspended');
    expect(hasActivePedagogicalAccess(expired, failTs + 4 * DAY_MS)).toBe(false);
  });

  it('permite upgrade Mensal -> Anual preservando dias restantes e aplica precedência de cota mensal -> avulso + estorno atômico', async () => {
    const u = makeStudent('up@nexo.edu.br', 'Duda');
    const t0 = 1_700_000_000_000;
    const c = await routes.checkout(u, {
      planCode: 'nexo_monthly',
      paymentMethod: 'credit_card',
      payer: { name: 'Duda', financialEmail: 'up@nexo.edu.br', isGuardian: false },
    });
    const ext = (c.body as any).subscription.externalSubscriptionId;
    billing.processPaymentEvent({ eventId: 'u1', eventType: 'payment_confirmed', eventTs: t0, externalSubscriptionId: ext }, t0);

    const up = routes.upgradeAnnual(u, t0 + 10 * DAY_MS);
    expect(up.status).toBe(200);
    expect((up.body as any).subscription.planCode).toBe('nexo_annual');
    expect((up.body as any).subscription.currentPeriodEnd).toBe(t0 + (30 + 365) * DAY_MS);

    // Compra pacote avulso (+5 redações) e valida idempotência
    billing.processPaymentEvent({ eventId: 'add-1', eventType: 'addon_confirmed', eventTs: t0 + 11 * DAY_MS, userId: u.id, addonCode: 'addon_essay_5' }, t0 + 11 * DAY_MS);
    billing.processPaymentEvent({ eventId: 'add-1', eventType: 'addon_confirmed', eventTs: t0 + 11 * DAY_MS, userId: u.id, addonCode: 'addon_essay_5' }, t0 + 11 * DAY_MS);
    expect(quotas.getSnapshot(u.id, t0 + 11 * DAY_MS).addons.essay).toBe(5);

    // Consome toda a cota mensal (8 redações), depois consome 1 do avulso e estorna atomicamente
    for (let i = 0; i < 8; i++) {
      const res = quotas.reserve(u.id, 'essay', 'essay_eval', `op-${i}`, t0 + 11 * DAY_MS);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.reservation.source).toBe('monthly_cycle');
        quotas.commit(res.reservation);
      }
    }
    const fromAddon = quotas.reserve(u.id, 'essay', 'essay_eval', 'op-addon', t0 + 11 * DAY_MS);
    expect(fromAddon.ok).toBe(true);
    if (fromAddon.ok) {
      expect(fromAddon.reservation.source).toBe('addon');
      expect(quotas.getSnapshot(u.id, t0 + 11 * DAY_MS).addons.essay).toBe(4);
      // Estorno por falha total de IA restaura o avulso!
      quotas.refund(fromAddon.reservation, 'provider_total_failure_refund', t0 + 11 * DAY_MS);
      expect(quotas.getSnapshot(u.id, t0 + 11 * DAY_MS).addons.essay).toBe(5);
    }

    // No mês seguinte (t0 + 35 dias, ainda no plano Anual), cota mensal renova sem acúmulo e saldo avulso permanece intacto
    const nextMonth = quotas.getSnapshot(u.id, t0 + 35 * DAY_MS);
    expect(nextMonth.monthly.essay.used).toBe(0);
    expect(nextMonth.monthly.essay.remaining).toBe(8);
    expect(nextMonth.addons.essay).toBe(5);
  });
});
