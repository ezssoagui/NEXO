import { env } from '@/config/env';

/**
 * Adaptador Asaas (API v3) — somente servidor (11.8/15.9).
 * - Sandbox por padrão; produção exige ASAAS_ENV=production E ASAAS_ALLOW_PRODUCTION=true.
 * - Pagamento ocorre na fatura hospedada do Asaas (invoiceUrl): o NEXO nunca recebe dados de cartão.
 * STATUS: implementado conforme documentação pública (docs.asaas.com); não testado contra o
 * sandbox por ausência de credenciais. Validar antes do piloto.
 */
export class AsaasNotConfigured extends Error {}

function base(): { url: string; key: string } {
  const e = env();
  if (!e.ASAAS_API_KEY) throw new AsaasNotConfigured('ASAAS_API_KEY ausente');
  if (e.ASAAS_ENV === 'production' && e.ASAAS_ALLOW_PRODUCTION !== 'true') throw new AsaasNotConfigured('Produção Asaas não autorizada');
  return { url: e.ASAAS_ENV === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3', key: e.ASAAS_API_KEY };
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { url, key } = base();
  const res = await fetch(`${url}${path}`, {
    method,
    headers: { access_token: key, 'Content-Type': 'application/json', 'User-Agent': 'nexo-backend' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { errors?: { code: string; description: string }[] };
  if (!res.ok) throw new Error(`asaas_${res.status}:${data.errors?.[0]?.code ?? 'unknown'}`);
  return data;
}

export interface AsaasPayment {
  id: string;
  subscription?: string | null;
  customer: string;
  value: number;
  netValue?: number;
  status: string;
  billingType?: string;
  dueDate: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  confirmedDate?: string | null;
  invoiceUrl?: string;
  externalReference?: string | null;
}

export const asaas = {
  configured(): boolean {
    try { base(); return true; } catch { return false; }
  },
  createCustomer: (input: { name: string; email: string; cpfCnpj: string; externalReference: string }) =>
    call<{ id: string }>('POST', '/customers', { ...input, notificationDisabled: false }),
  createSubscription: (input: { customer: string; value: number; nextDueDate: string; cycle: 'MONTHLY' | 'YEARLY'; description: string; externalReference: string }) =>
    call<{ id: string; status: string }>('POST', '/subscriptions', { ...input, billingType: 'UNDEFINED' }),
  subscriptionPayments: (id: string) => call<{ data: AsaasPayment[] }>('GET', `/subscriptions/${id}/payments`),
  updateSubscriptionValue: (id: string, value: number) => call<{ id: string }>('POST', `/subscriptions/${id}`, { value, updatePendingPayments: false }),
  cancelSubscription: (id: string) => call<{ deleted: boolean }>('DELETE', `/subscriptions/${id}`),
  refundPayment: (id: string) => call<{ id: string; status: string }>('POST', `/payments/${id}/refund`, {}),
};

/** Payload de webhook (campos usados). */
export interface AsaasWebhook {
  id: string;
  event: string;
  dateCreated?: string;
  payment?: AsaasPayment;
  subscription?: { id: string; status?: string; externalReference?: string | null; deleted?: boolean };
}
