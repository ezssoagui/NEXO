import { randomUUID } from 'node:crypto';
import type { AddonCode, PaymentMethod, PlanCode } from '../config/plans';

/**
 * ADR-0002: Interface desacoplada de gateway de pagamento (Brasil: Cartão recorrente/parcelado + Pix).
 * No V1 local, utiliza LocalPaymentGateway para testar 100% da máquina de estados comercial
 * sem dependência externa. Em produção, plugar Asaas/Pagar.me/Mercado Pago/Stripe.
 */
export interface CheckoutInput {
  userId: string;
  planCode: PlanCode;
  paymentMethod: PaymentMethod;
  payer: {
    name: string;
    financialEmail: string;
    isGuardian: boolean;
    documentLast4?: string;
  };
}

export interface CheckoutResult {
  externalCustomerId: string;
  externalSubscriptionId: string;
  checkoutUrl?: string;
  pixCopyPaste?: string;
  mode: 'local_simulated' | 'live';
}

export interface AddonCheckoutInput {
  userId: string;
  addonCode: AddonCode;
  paymentMethod: PaymentMethod;
  externalCustomerId: string;
}

export interface AddonCheckoutResult {
  externalPaymentId: string;
  pixCopyPaste?: string;
  mode: 'local_simulated' | 'live';
}

export interface RefundResult {
  refundId: string;
  status: 'refunded';
}

export interface PaymentGateway {
  readonly name: string;
  readonly isLocalSimulator: boolean;
  createSubscriptionCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  createAddonCheckout(input: AddonCheckoutInput): Promise<AddonCheckoutResult>;
  cancelRecurring(externalSubscriptionId: string): Promise<void>;
  refundSubscription(externalSubscriptionId: string, reason: string): Promise<RefundResult>;
}

export class LocalPaymentGateway implements PaymentGateway {
  readonly name = 'local';
  readonly isLocalSimulator = true;

  async createSubscriptionCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const externalCustomerId = `local_cus_${randomUUID().slice(0, 12)}`;
    const externalSubscriptionId = `local_sub_${randomUUID().slice(0, 12)}`;
    return {
      externalCustomerId,
      externalSubscriptionId,
      checkoutUrl: `/planos?checkout=${externalSubscriptionId}`,
      pixCopyPaste: input.paymentMethod === 'pix' ? `000201NEXO-LOCAL-PIX-${externalSubscriptionId}` : undefined,
      mode: 'local_simulated',
    };
  }

  async createAddonCheckout(input: AddonCheckoutInput): Promise<AddonCheckoutResult> {
    const externalPaymentId = `local_pay_${randomUUID().slice(0, 12)}`;
    return {
      externalPaymentId,
      pixCopyPaste: input.paymentMethod === 'pix' ? `000201NEXO-LOCAL-ADDON-${externalPaymentId}` : undefined,
      mode: 'local_simulated',
    };
  }

  async cancelRecurring(_externalSubscriptionId: string): Promise<void> {
    return;
  }

  async refundSubscription(externalSubscriptionId: string, _reason: string): Promise<RefundResult> {
    return { refundId: `local_ref_${externalSubscriptionId.slice(-8)}_${Date.now()}`, status: 'refunded' };
  }
}

export function paymentGatewayFromEnv(): PaymentGateway {
  const mode = (process.env.NEXO_PAYMENT_GATEWAY || 'local').toLowerCase();
  if (mode === 'local') return new LocalPaymentGateway();
  throw new Error(`PaymentGateway "${mode}" ainda não configurado. Utilize NEXO_PAYMENT_GATEWAY=local no V1.`);
}
