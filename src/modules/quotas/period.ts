/**
 * Chaves de período das franquias (15.9). Fuso proposto: America/Sao_Paulo (ADR-010, pendente de aprovação).
 * Dia: 'D:YYYY-MM-DD'; mês: 'M:YYYY-MM'. Franquias não acumulam (13.7).
 */
export const DEFAULT_TZ = 'America/Sao_Paulo';

export function localDate(at: Date, tz = DEFAULT_TZ): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function periodKey(period: 'day' | 'month', at: Date, tz = DEFAULT_TZ): string {
  const d = localDate(at, tz);
  return period === 'day' ? `D:${d}` : `M:${d.slice(0, 7)}`;
}

export type QuotaResource =
  | 'questions' | 'adaptive_sessions' | 'flashcards' | 'explanations' | 'essays' | 'rewrites' | 'discursive' | 'exams';

export const AI_RESOURCES: QuotaResource[] = ['explanations', 'essays', 'rewrites', 'discursive'];
