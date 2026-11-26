import { env } from '@/config/env';
import { asaas, AsaasNotConfigured, type AsaasPayment, type AsaasWebhook } from '@/integrations/asaas';
import { classifyPlanChange, deriveSubscriptionStatus, withinWithdrawal, type PlanCode } from '@/modules/subscriptions/state';
import { safeEqual } from '@/server/auth/crypto';
import { asService } from '@/server/db';
import { one, type Tx } from '@/server/db/types';
import { AppError, conflict, notFound } from '@/server/http/errors';
import { audit, setting, userPlan } from './core';

export async function plansCatalog(tx: Tx) {
  const plans = await tx.query<{ code: string; name: string; monthly_price_cents: number | null; annual_price_cents: number | null; price_status: string }>(
    'select code, name, monthly_price_cents, annual_price_cents, price_status from plans where active order by rank');
  const limits = await tx.query<{ plan_code: string; resource: string; period: string; limit_value: number | null }>('select plan_code, resource, period, limit_value from plan_limits');
  return plans.map((p) => ({
    ...p,
    // Preço só é exibido quando aprovado pelos sócios (11.10).
    monthly_price_cents: p.price_status === 'approved' ? p.monthly_price_cents : null,
    annual_price_cents: p.price_status === 'approved' ? p.annual_price_cents : null,
    limits: limits.filter((l) => l.plan_code === p.code),
  }));
}

function paymentsUnavailable(): AppError {
  return new AppError(503, 'payments_unavailable', 'Pagamentos ainda não estão habilitados nesta versão. Nenhuma cobrança foi feita.');
}

/** Checkout hospedado (fatura Asaas). CPF é enviado ao Asaas e NÃO é armazenado pelo NEXO (13.1). */
export async function startCheckout(userId: string, input: { plan: 'plus' | 'pro'; cycle: 'monthly' | 'annual'; cpf: string; couponCode?: string }) {
  const prep = await asService(async (tx) => {
    const plan = await one<{ monthly_price_cents: number | null; annual_price_cents: number | null; price_status: string; name: string }>(
      tx, 'select monthly_price_cents, annual_price_cents, price_status, name from plans where code = $1 and active', [input.plan]);
    if (!plan || plan.price_status !== 'approved') throw new AppError(409, 'price_not_defined', 'Os preços dos planos ainda estão em definição. A contratação será liberada após a aprovação.');
    const current = await userPlan(tx, userId);
    const change = classifyPlanChange(current.source === 'subscription' ? current.plan : 'free', input.plan);
    if (change === 'same') throw conflict('Você já possui este plano.');
    if (change === 'downgrade_at_period_end') throw conflict('Para reduzir o plano, use a opção de troca de plano nas configurações.');
    let price = input.cycle === 'monthly' ? plan.monthly_price_cents! : plan.annual_price_cents!;
    if (input.couponCode) {
      const c = await one<{ kind: string; value: number; plan_code: string | null }>(tx,
        `select kind, value, plan_code from coupons where code = $1 and active and kind = 'percent' and (valid_until is null or valid_until > now())
           and (max_redemptions is null or redeemed_count < max_redemptions)`, [input.couponCode.toUpperCase()]);
      if (!c || (c.plan_code && c.plan_code !== input.plan)) throw new AppError(422, 'invalid_coupon', 'Cupom inválido ou expirado.');
      price = Math.round(price * (100 - c.value) / 100);
    }
    const prof = await one<{ display_name: string }>(tx, 'select display_name from profiles where id = $1', [userId]);
    const email = await one<{ email: string }>(tx, 'select email from auth.users where id = $1', [userId]);
    const prevCustomer = await one<{ provider_customer_id: string }>(tx, `select provider_customer_id from subscriptions where user_id = $1 and provider_customer_id is not null order by created_at desc limit 1`, [userId]);
    const [sub] = await tx.query<{ id: string }>(
      `insert into subscriptions (user_id, plan_code, cycle, status, price_cents) values ($1,$2,$3,'pending',$4) returning id`, [userId, input.plan, input.cycle, price]);
    return { subId: sub!.id, price, name: prof?.display_name ?? '', email: email?.email ?? '', customer: prevCustomer?.provider_customer_id ?? null, planName: plan.name, upgrade: change === 'upgrade_immediate' };
  });
  if (!asaas.configured()) {
    await asService((tx) => tx.query(`update subscriptions set status = 'expired' where id = $1`, [prep.subId]));
    throw paymentsUnavailable();
  }
  try {
    const customer = prep.customer ?? (await asaas.createCustomer({ name: prep.name, email: prep.email, cpfCnpj: input.cpf.replace(/\D/g, ''), externalReference: userId })).id;
    const today = new Date().toISOString().slice(0, 10);
    const s = await asaas.createSubscription({ customer, value: prep.price / 100, nextDueDate: today, cycle: input.cycle === 'monthly' ? 'MONTHLY' : 'YEARLY',
      description: `NEXO ${prep.planName} (${input.cycle === 'monthly' ? 'mensal' : 'anual'})`, externalReference: prep.subId });
    const payments = await asaas.subscriptionPayments(s.id);
    const first = payments.data[0];
    await asService(async (tx) => {
      await tx.query('update subscriptions set provider_customer_id = $2, provider_subscription_id = $3 where id = $1', [prep.subId, customer, s.id]);
      if (first) await upsertPayment(tx, first, prep.subId, userId);
      if (input.couponCode) await tx.query(`update coupons set redeemed_count = redeemed_count + 1 where code = $1`, [input.couponCode.toUpperCase()]);
    });
    if (!first?.invoiceUrl) throw new Error('invoice_missing');
    return { checkoutUrl: first.invoiceUrl, subscriptionId: prep.subId };
  } catch (err) {
    await asService((tx) => tx.query(`update subscriptions set status = 'expired' where id = $1 and status = 'pending'`, [prep.subId]));
    if (err instanceof AsaasNotConfigured) throw paymentsUnavailable();
    throw new AppError(502, 'payment_provider_error', 'Não foi possível iniciar o pagamento. Nenhuma cobrança foi feita.');
  }
}

async function upsertPayment(tx: Tx, p: AsaasPayment, subscriptionId: string | null, userId: string | null) {
  const paidAt = p.confirmedDate ?? p.paymentDate ?? p.clientPaymentDate ?? null;
  await tx.query(
    `insert into payments (subscription_id, user_id, provider_payment_id, amount_cents, net_cents, status, billing_type, due_date, paid_at, invoice_url, refunded_at)
     values ($1,$2,$3,$4,$5,$6::text,$7,$8,$9,$10, case when $6::text = 'REFUNDED' then now() end)
     on conflict (provider_payment_id) do update set status = excluded.status, net_cents = excluded.net_cents, paid_at = coalesce(excluded.paid_at, payments.paid_at),
       invoice_url = coalesce(excluded.invoice_url, payments.invoice_url), refunded_at = coalesce(payments.refunded_at, excluded.refunded_at),
       subscription_id = coalesce(payments.subscription_id, excluded.subscription_id), user_id = coalesce(payments.user_id, excluded.user_id)`,
    [subscriptionId, userId, p.id, Math.round(p.value * 100), p.netValue !== undefined ? Math.round(p.netValue * 100) : null, p.status, p.billingType ?? null,
      p.dueDate, paidAt ? new Date(paidAt) : null, p.invoiceUrl ?? null]);
}

/** Recalcula o estado a partir dos pagamentos persistidos (robusto a eventos fora de ordem). */
export async function recomputeSubscription(tx: Tx, subscriptionId: string, now = new Date()) {
  const sub = await one<{ id: string; user_id: string; cycle: 'monthly' | 'annual'; cancel_at_period_end: boolean; canceled_at: Date | null; status: string; scheduled_plan_code: string | null; current_period_end: Date | null; plan_code: string }>(
    tx, 'select id, user_id, cycle, cancel_at_period_end, canceled_at, status, scheduled_plan_code, current_period_end, plan_code from subscriptions where id = $1', [subscriptionId]);
  if (!sub) return;
  const pays = await tx.query<{ status: string; due_date: Date; paid_at: Date | null; refunded_at: Date | null }>(
    'select status, due_date, paid_at, refunded_at from payments where subscription_id = $1', [subscriptionId]);
  const grace = Number(await setting(tx, 'grace_period_days', 3));
  const d = deriveSubscriptionStatus({ cycle: sub.cycle, cancelAtPeriodEnd: sub.cancel_at_period_end, canceledAt: sub.canceled_at },
    pays.map((p) => ({ status: p.status, dueDate: new Date(p.due_date), paidAt: p.paid_at, refundedAt: p.refunded_at })), now, grace);
  // Downgrade agendado entra em vigor na renovação seguinte ao fim do período anterior (13.7).
  const renewed = sub.current_period_end && d.currentPeriodEnd && d.currentPeriodEnd > sub.current_period_end;
  const planCode = renewed && sub.scheduled_plan_code ? sub.scheduled_plan_code : sub.plan_code;
  await tx.query(
    `update subscriptions set status = $2, current_period_end = $3::timestamptz, grace_until = $4::timestamptz, first_paid_at = coalesce(first_paid_at, $5::timestamptz),
       current_period_start = case when $3::timestamptz is not null then coalesce(current_period_start, now()) else current_period_start end,
       plan_code = $6::text, scheduled_plan_code = case when $6::text = scheduled_plan_code then null else scheduled_plan_code end where id = $1`,
    [subscriptionId, d.status, d.currentPeriodEnd, d.graceUntil, d.firstPaidAt, planCode]);
  // Upgrade: ao ativar a nova assinatura, encerra a anterior (cancelamento imediato no provedor).
  if (d.status === 'active') {
    const older = await tx.query<{ id: string; provider_subscription_id: string | null }>(
      `select id, provider_subscription_id from subscriptions where user_id = $1 and id <> $2 and status in ('active','past_due')`, [sub.user_id, subscriptionId]);
    for (const o of older) {
      await tx.query(`update subscriptions set status = 'canceled', canceled_at = now(), replaced_by = $2 where id = $1`, [o.id, subscriptionId]);
      if (o.provider_subscription_id && asaas.configured()) await asaas.cancelSubscription(o.provider_subscription_id).catch(() => undefined);
    }
  }
}

/** Webhook Asaas: token verificado, persistência idempotente e processamento (15.9). */
export async function handleAsaasWebhook(token: string | null, payload: AsaasWebhook): Promise<{ status: string }> {
  const expected = env().ASAAS_WEBHOOK_TOKEN;
  if (!expected || !token || !safeEqual(token, expected)) throw new AppError(401, 'invalid_webhook_token', 'Token de webhook inválido.');
  if (!payload?.id || !payload.event) throw new AppError(400, 'bad_request', 'Evento inválido.');
  return asService(async (tx) => {
    const ins = await tx.query<{ id: string }>(
      `insert into webhook_events (provider, event_id, event_type, payload) values ('asaas', $1, $2, $3) on conflict (provider, event_id) do nothing returning id`,
      [payload.id, payload.event, JSON.stringify(payload)]);
    if (!ins[0]) return { status: 'duplicate' };
    const eventRow = ins[0].id;
    await tx.query('savepoint webhook_processing');
    try {
      let subscriptionId: string | null = null;
      if (payload.payment) {
        const p = payload.payment;
        const sub = await one<{ id: string; user_id: string }>(tx,
          `select id, user_id from subscriptions where provider_subscription_id = $1 or id::text = $2 limit 1`, [p.subscription ?? '', p.externalReference ?? '']);
        if (!sub) {
          await tx.query(`update webhook_events set status = 'ignored', processed_at = now(), error = 'subscription_not_found' where id = $1`, [eventRow]);
          return { status: 'ignored' };
        }
        await upsertPayment(tx, p, sub.id, sub.user_id);
        subscriptionId = sub.id;
      } else if (payload.subscription) {
        const sub = await one<{ id: string }>(tx, 'select id from subscriptions where provider_subscription_id = $1', [payload.subscription.id]);
        if (sub && (payload.event === 'SUBSCRIPTION_DELETED' || payload.event === 'SUBSCRIPTION_INACTIVATED')) {
          await tx.query(`update subscriptions set canceled_at = coalesce(canceled_at, now()) where id = $1`, [sub.id]);
        }
        subscriptionId = sub?.id ?? null;
      }
      if (subscriptionId) await recomputeSubscription(tx, subscriptionId);
      await tx.query(`update webhook_events set status = 'processed', processed_at = now() where id = $1`, [eventRow]);
      return { status: 'processed' };
    } catch (err) {
      await tx.query('rollback to savepoint webhook_processing');
      await tx.query(`update webhook_events set status = 'failed', error = $2 where id = $1`, [eventRow, err instanceof Error ? err.message.slice(0, 200) : 'error']);
      await tx.query(`insert into alerts (kind, severity, message, details) values ('payment_webhook', 'high', 'Falha ao processar webhook de pagamento', $1)`, [JSON.stringify({ event: payload.event })]);
      return { status: 'failed' };
    }
  });
}

/**
 * Cancelamento (13.7): interrompe a renovação e mantém o acesso até o fim do período pago.
 * Dentro de 7 dias do primeiro pagamento: direito de arrependimento com reembolso integral.
 * Cancelar não exclui a conta nem o histórico.
 */
export async function cancelSubscription(userId: string, opts: { withdrawal?: boolean } = {}) {
  const sub = await asService((tx) => one<{ id: string; provider_subscription_id: string | null; first_paid_at: Date | null }>(tx,
    `select id, provider_subscription_id, first_paid_at from subscriptions where user_id = $1 and status in ('active','past_due') order by created_at desc limit 1`, [userId]));
  if (!sub) throw notFound('Assinatura ativa');
  const withdrawalDays = Number(await asService((tx) => setting(tx, 'withdrawal_days', 7)));
  const refund = Boolean(opts.withdrawal) && withinWithdrawal(sub.first_paid_at, new Date(), withdrawalDays);
  if (opts.withdrawal && !refund) throw new AppError(422, 'withdrawal_expired', 'O prazo de arrependimento de 7 dias já terminou. A assinatura pode ser cancelada ao fim do período.');
  if (sub.provider_subscription_id) {
    if (!asaas.configured()) throw paymentsUnavailable();
    await asaas.cancelSubscription(sub.provider_subscription_id);
    if (refund) {
      const paid = await asService((tx) => tx.query<{ provider_payment_id: string }>(
        `select provider_payment_id from payments where subscription_id = $1 and status in ('CONFIRMED','RECEIVED')`, [sub.id]));
      for (const p of paid) await asaas.refundPayment(p.provider_payment_id);
    }
  }
  return asService(async (tx) => {
    if (refund) {
      await tx.query(`update subscriptions set status = 'refunded', canceled_at = now(), cancel_at_period_end = false, current_period_end = now() where id = $1`, [sub.id]);
      await tx.query(`update payments set status = 'REFUND_REQUESTED' where subscription_id = $1 and status in ('CONFIRMED','RECEIVED')`, [sub.id]);
    } else {
      await tx.query(`update subscriptions set canceled_at = now(), cancel_at_period_end = true where id = $1`, [sub.id]);
      await recomputeSubscription(tx, sub.id);
    }
    await audit(tx, userId, 'student', refund ? 'subscription_withdrawal' : 'subscription_cancel', 'subscription', sub.id);
    return { refunded: refund };
  });
}

/** Downgrade Pro→Plus agendado para o fim do período (13.7). */
export async function scheduleDowngrade(userId: string, target: 'plus') {
  return asService(async (tx) => {
    const sub = await one<{ id: string; plan_code: PlanCode; provider_subscription_id: string | null; cycle: string }>(tx,
      `select id, plan_code, provider_subscription_id, cycle from subscriptions where user_id = $1 and status = 'active' order by created_at desc limit 1`, [userId]);
    if (!sub) throw notFound('Assinatura ativa');
    if (classifyPlanChange(sub.plan_code, target) !== 'downgrade_at_period_end') throw conflict('Troca de plano inválida.');
    const plan = await one<{ monthly_price_cents: number | null; annual_price_cents: number | null; price_status: string }>(tx, 'select monthly_price_cents, annual_price_cents, price_status from plans where code = $1', [target]);
    if (!plan || plan.price_status !== 'approved') throw new AppError(409, 'price_not_defined', 'Preço do plano ainda não definido.');
    if (sub.provider_subscription_id) {
      if (!asaas.configured()) throw paymentsUnavailable();
      await asaas.updateSubscriptionValue(sub.provider_subscription_id, (sub.cycle === 'monthly' ? plan.monthly_price_cents! : plan.annual_price_cents!) / 100);
    }
    await tx.query('update subscriptions set scheduled_plan_code = $2 where id = $1', [sub.id, target]);
    return { scheduled: target };
  });
}

/** Reconciliação periódica para eventos atrasados/perdidos (15.9). */
export async function reconcileSubscriptions(): Promise<{ checked: number; skipped: boolean }> {
  if (!asaas.configured()) return { checked: 0, skipped: true };
  const subs = await asService((tx) => tx.query<{ id: string; user_id: string; provider_subscription_id: string }>(
    `select id, user_id, provider_subscription_id from subscriptions where provider_subscription_id is not null and status in ('pending','active','past_due','canceled') and updated_at > now() - interval '400 days'`));
  for (const s of subs) {
    const pays = await asaas.subscriptionPayments(s.provider_subscription_id).catch(() => null);
    if (!pays) continue;
    await asService(async (tx) => {
      for (const p of pays.data) await upsertPayment(tx, p, s.id, s.user_id);
      await recomputeSubscription(tx, s.id);
    });
  }
  // Expiração natural também sem eventos (tolerância esgotada).
  await asService(async (tx) => {
    const live = await tx.query<{ id: string }>(`select id from subscriptions where status in ('active','past_due') and provider_subscription_id is null`);
    for (const l of live) await recomputeSubscription(tx, l.id);
  });
  return { checked: subs.length, skipped: false };
}

export async function redeemCoupon(userId: string, code: string) {
  return asService(async (tx) => {
    const c = await one<{ code: string; kind: string; plan_code: 'plus' | 'pro' | null; grant_days: number | null }>(tx,
      `select code, kind, plan_code, grant_days from coupons where code = $1 and active and (valid_until is null or valid_until > now())
         and (max_redemptions is null or redeemed_count < max_redemptions) for update`, [code.toUpperCase()]);
    if (!c) throw new AppError(422, 'invalid_coupon', 'Cupom inválido ou expirado.');
    if (c.kind !== 'access_grant') throw new AppError(422, 'coupon_checkout_only', 'Este cupom é aplicado no momento da contratação.');
    const ins = await tx.query('insert into coupon_redemptions (coupon_code, user_id) values ($1,$2) on conflict do nothing returning coupon_code', [c.code, userId]);
    if (!ins.length) throw conflict('Cupom já utilizado nesta conta.');
    await tx.query('update coupons set redeemed_count = redeemed_count + 1 where code = $1', [c.code]);
    await tx.query(`insert into access_grants (user_id, plan_code, ends_at, reason, campaign) values ($1,$2, now() + make_interval(days => $3), 'coupon', $4)`,
      [userId, c.plan_code, c.grant_days, c.code]);
    return { plan: c.plan_code, days: c.grant_days };
  });
}

export async function subscriptionOverview(tx: Tx, userId: string) {
  const plan = await userPlan(tx, userId);
  const subs = await tx.query(
    `select id, plan_code, cycle, status, current_period_end, cancel_at_period_end, scheduled_plan_code, grace_until, first_paid_at, created_at
       from subscriptions where user_id = $1 order by created_at desc limit 10`, [userId]);
  const payments = await tx.query(`select provider_payment_id, amount_cents, status, due_date, paid_at, invoice_url from payments where user_id = $1 order by due_date desc limit 24`, [userId]);
  const grants = await tx.query(`select plan_code, starts_at, ends_at, reason from access_grants where user_id = $1 and revoked_at is null order by ends_at desc limit 10`, [userId]);
  return { plan, subscriptions: subs, payments, grants, paymentsEnabled: asaas.configured() };
}
