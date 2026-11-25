import { randomUUID } from 'node:crypto';
import type { DB } from '../db';
import { ADDONS, PLANS, type AddonCode, type PaymentMethod, type PlanCode } from '../config/plans';
import { BillingRepository, hasActivePedagogicalAccess } from '../repositories/billing';
import { QuotasRepository } from '../repositories/quotas';
import type { PaymentGateway } from '../gateways/payment';
import type { AuthUserV1 } from '../repositories/users';
import type { RouteResult } from './auth';

export function createBillingRoutes(db: DB, gateway: PaymentGateway) {
  const billing = new BillingRepository(db);
  const quotas = new QuotasRepository(db);

  return {
    plans: (): RouteResult => ({
      status: 200,
      body: {
        model: 'paid_only',
        plans: Object.values(PLANS),
        addons: Object.values(ADDONS),
        gatewayMode: gateway.isLocalSimulator ? 'local_simulated' : 'live',
      },
    }),

    checkout: async (user: AuthUserV1 | null, body: any): Promise<RouteResult> => {
      if (!user) return { status: 401, body: { error: 'unauthorized' } };
      const planCode = body?.planCode as PlanCode;
      const paymentMethod = body?.paymentMethod as PaymentMethod;
      const payer = body?.payer ?? {};

      if (!PLANS[planCode]) return { status: 400, body: { error: 'bad_request', message: 'Plano inválido (use nexo_monthly ou nexo_annual).' } };
      if (paymentMethod !== 'credit_card' && paymentMethod !== 'pix') {
        return { status: 400, body: { error: 'bad_request', message: 'Meio de pagamento inválido (use credit_card ou pix).' } };
      }
      if (!payer?.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payer?.financialEmail ?? ''))) {
        return { status: 400, body: { error: 'bad_request', message: 'Informe nome e e-mail financeiro do pagador.' } };
      }

      const gw = await gateway.createSubscriptionCheckout({
        userId: user.id,
        planCode,
        paymentMethod,
        payer: {
          name: String(payer.name),
          financialEmail: String(payer.financialEmail),
          isGuardian: !!payer.isGuardian,
          documentLast4: payer.documentLast4 ? String(payer.documentLast4).slice(-4) : undefined,
        },
      });

      const payerId = billing.createPayer({
        externalCustomerId: gw.externalCustomerId,
        financialEmail: String(payer.financialEmail),
        payerName: String(payer.name),
        isGuardian: !!payer.isGuardian,
        documentLast4: payer.documentLast4 ? String(payer.documentLast4).slice(-4) : undefined,
      });

      const sub = billing.createPendingSubscription({
        userId: user.id,
        payerId,
        planCode,
        paymentMethod,
        externalSubscriptionId: gw.externalSubscriptionId,
      });

      return { status: 201, body: { subscription: sub, checkout: gw } };
    },

    addonCheckout: async (user: AuthUserV1 | null, body: any): Promise<RouteResult> => {
      if (!user) return { status: 401, body: { error: 'unauthorized' } };
      const sub = billing.getLatestForUser(user.id);
      if (!hasActivePedagogicalAccess(sub)) {
        return { status: 402, body: { error: 'subscription_required', message: 'Assinatura ativa necessária para comprar pacotes avulsos.' } };
      }
      const addonCode = body?.addonCode as AddonCode;
      const paymentMethod = (body?.paymentMethod ?? 'pix') as PaymentMethod;
      if (!ADDONS[addonCode]) return { status: 400, body: { error: 'bad_request', message: 'Pacote avulso inválido.' } };
      const payer = billing.getPayerById(sub!.payerId);
      const gw = await gateway.createAddonCheckout({
        userId: user.id,
        addonCode,
        paymentMethod,
        externalCustomerId: payer?.external_customer_id ?? 'local_cus',
      });
      return { status: 201, body: { addon: ADDONS[addonCode], checkout: gw } };
    },

    cancel: async (user: AuthUserV1 | null, now = Date.now()): Promise<RouteResult> => {
      if (!user) return { status: 401, body: { error: 'unauthorized' } };
      const r = billing.requestCancel(user.id, now);
      if (!r.ok) return { status: r.status, body: { error: 'bad_request', message: r.message } };
      if (r.subscription.externalSubscriptionId) {
        if (r.outcome === 'cdc_refunded') {
          await gateway.refundSubscription(r.subscription.externalSubscriptionId, 'cdc_7_days');
        } else {
          await gateway.cancelRecurring(r.subscription.externalSubscriptionId);
        }
      }
      return { status: 200, body: { outcome: r.outcome, subscription: r.subscription } };
    },

    upgradeAnnual: (user: AuthUserV1 | null, now = Date.now()): RouteResult => {
      if (!user) return { status: 401, body: { error: 'unauthorized' } };
      const r = billing.upgradeMonthlyToAnnual(user.id, now);
      if (!r.ok) return { status: r.status, body: { error: 'bad_request', message: r.message } };
      return { status: 200, body: { subscription: r.subscription } };
    },

    webhook: (body: any, now = Date.now()): RouteResult => {
      if (!body?.eventId || !body?.eventType) {
        return { status: 400, body: { error: 'bad_request', message: 'eventId e eventType são obrigatórios.' } };
      }
      const res = billing.processPaymentEvent(
        {
          eventId: String(body.eventId),
          eventType: body.eventType,
          eventTs: Number(body.eventTs ?? now),
          externalSubscriptionId: body.externalSubscriptionId,
          userId: body.userId,
          addonCode: body.addonCode,
          payload: body.payload,
        },
        now,
      );
      return { status: 200, body: res };
    },

    devSimulate: (user: AuthUserV1 | null, body: any): RouteResult => {
      if (!gateway.isLocalSimulator || process.env.NODE_ENV === 'production') {
        return { status: 403, body: { error: 'forbidden', message: 'Simulador local desabilitado fora de desenvolvimento.' } };
      }
      if (!user) return { status: 401, body: { error: 'unauthorized' } };
      const action = String(body?.action ?? '');
      const sub = billing.getLatestForUser(user.id);
      const now = Number(body?.now ?? Date.now());
      const eventId = String(body?.eventId ?? `sim_${action}_${randomUUID().slice(0, 8)}`);

      if (action === 'confirm_payment') {
        if (!sub?.externalSubscriptionId) return { status: 404, body: { error: 'not_found', message: 'Nenhuma assinatura encontrada.' } };
        const res = billing.processPaymentEvent({ eventId, eventType: 'payment_confirmed', eventTs: now, externalSubscriptionId: sub.externalSubscriptionId }, now);
        return { status: 200, body: { ...res, quotas: quotas.getSnapshot(user.id, now) } };
      }
      if (action === 'fail_renewal') {
        if (!sub?.externalSubscriptionId) return { status: 404, body: { error: 'not_found' } };
        const res = billing.processPaymentEvent({ eventId, eventType: 'payment_failed', eventTs: now, externalSubscriptionId: sub.externalSubscriptionId }, now);
        return { status: 200, body: res };
      }
      if (action === 'confirm_addon') {
        const addonCode = body?.addonCode as AddonCode;
        const res = billing.processPaymentEvent({ eventId, eventType: 'addon_confirmed', eventTs: now, userId: user.id, addonCode }, now);
        return { status: 200, body: { ...res, quotas: quotas.getSnapshot(user.id, now) } };
      }
      return { status: 400, body: { error: 'bad_request', message: `Ação de simulação desconhecida: ${action}` } };
    },
  };
}
