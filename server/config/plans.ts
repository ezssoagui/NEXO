/**
 * Configuração comercial centralizada do NEXO V1 (100% pago, foco ENEM).
 * Valores nominais são parâmetros de negócio ajustáveis sem alterar regras estruturais.
 */
export type PlanCode = 'nexo_monthly' | 'nexo_annual';
export type PaymentMethod = 'credit_card' | 'pix';
export type QuotaKind = 'essay' | 'tutor' | 'question_gen';
export type AddonCode = 'addon_essay_5' | 'addon_tutor_150' | 'addon_question_gen_20';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const CDC_REFUND_WINDOW_DAYS = 7;
export const GRACE_PERIOD_DAYS = 3;
export const MONTHLY_CYCLE_DAYS = 30;
export const ANNUAL_CYCLE_DAYS = 365;
export const ADDON_VALIDITY_DAYS = 365;

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  priceCents: number;
  billingIntervalDays: number;
  monthlyEquivalentCents: number;
  discountPercent: number;
  supportsInstallments: boolean;
  monthlyQuotas: Record<QuotaKind, number>;
}

export interface AddonDefinition {
  code: AddonCode;
  name: string;
  kind: QuotaKind;
  credits: number;
  priceCents: number;
  validityDays: number;
}

export const DEFAULT_MONTHLY_QUOTAS: Record<QuotaKind, number> = {
  essay: +(process.env.NEXO_QUOTA_ESSAY_MONTH || 8),
  tutor: +(process.env.NEXO_QUOTA_TUTOR_MONTH || 300),
  question_gen: +(process.env.NEXO_QUOTA_QGEN_MONTH || 20),
};

export const PLANS: Record<PlanCode, PlanDefinition> = {
  nexo_monthly: {
    code: 'nexo_monthly',
    name: 'NEXO Mensal',
    priceCents: 4990,
    billingIntervalDays: MONTHLY_CYCLE_DAYS,
    monthlyEquivalentCents: 4990,
    discountPercent: 0,
    supportsInstallments: false,
    monthlyQuotas: DEFAULT_MONTHLY_QUOTAS,
  },
  nexo_annual: {
    code: 'nexo_annual',
    name: 'NEXO Anual',
    priceCents: 39900,
    billingIntervalDays: ANNUAL_CYCLE_DAYS,
    monthlyEquivalentCents: 3325,
    discountPercent: 33,
    supportsInstallments: true,
    monthlyQuotas: DEFAULT_MONTHLY_QUOTAS,
  },
};

export const ADDONS: Record<AddonCode, AddonDefinition> = {
  addon_essay_5: {
    code: 'addon_essay_5',
    name: 'Pacote Extra: +5 Correções de Redação',
    kind: 'essay',
    credits: 5,
    priceCents: 1990,
    validityDays: ADDON_VALIDITY_DAYS,
  },
  addon_tutor_150: {
    code: 'addon_tutor_150',
    name: 'Pacote Extra: +150 Interações IA Tutora',
    kind: 'tutor',
    credits: 150,
    priceCents: 1490,
    validityDays: ADDON_VALIDITY_DAYS,
  },
  addon_question_gen_20: {
    code: 'addon_question_gen_20',
    name: 'Pacote Extra: +20 Questões Inéditas IA',
    kind: 'question_gen',
    credits: 20,
    priceCents: 1290,
    validityDays: ADDON_VALIDITY_DAYS,
  },
};
