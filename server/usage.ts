import { PRICES } from './providers';

/** Controle de consumo e custos por usuário (memória do processo; em produção, banco de dados). */
export type Kind = 'tutor' | 'essay' | 'questions';
export const DAILY_LIMITS: Record<Kind, number> = {
  tutor: +(process.env.NEXO_LIMIT_TUTOR_DAY || 60), essay: +(process.env.NEXO_LIMIT_ESSAY_DAY || 4), questions: +(process.env.NEXO_LIMIT_QUESTIONS_DAY || 10),
};
export const DAILY_TOKEN_BUDGET = +(process.env.NEXO_TOKENS_USER_DAY || 150_000);
export const MONTHLY_BUDGET_USD = +(process.env.NEXO_MONTHLY_BUDGET_USD || 50);

interface Usage { day: string; calls: Record<Kind, number>; tokens: number }
const users = new Map<string, Usage>();
let month = { key: '', usd: 0 };
const today = () => new Date().toISOString().slice(0, 10);

export function check(user: string, kind: Kind): { ok: true } | { ok: false; reason: string } {
  const m = new Date().toISOString().slice(0, 7); if (month.key !== m) month = { key: m, usd: 0 };
  if (month.usd >= MONTHLY_BUDGET_USD) return { ok: false, reason: 'Orçamento mensal de IA da plataforma atingido.' };
  const u = get(user);
  if (u.calls[kind] >= DAILY_LIMITS[kind]) return { ok: false, reason: `Limite diário de ${kind} atingido para este usuário.` };
  if (u.tokens >= DAILY_TOKEN_BUDGET) return { ok: false, reason: 'Limite diário de tokens atingido para este usuário.' };
  return { ok: true };
}
export function record(user: string, kind: Kind, model: string, usage: { input: number; output: number }) {
  const u = get(user); u.calls[kind]++; u.tokens += usage.input + usage.output;
  const p = PRICES[model] ?? PRICES['claude-opus-5-5'];
  const usd = (usage.input * p.in + usage.output * p.out) / 1e6; month.usd += usd;
  return { usd: +usd.toFixed(5), tokensToday: u.tokens };
}
function get(user: string): Usage { const d = today(); let u = users.get(user); if (!u || u.day !== d) { u = { day: d, calls: { tutor: 0, essay: 0, questions: 0 }, tokens: 0 }; users.set(user, u); } return u; }
export function resetUsage() { users.clear(); month = { key: '', usd: 0 }; }
export function monthSpend() { return +month.usd.toFixed(4); }
