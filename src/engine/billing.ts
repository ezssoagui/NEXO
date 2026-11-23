// Controle de assinatura e consumo de IA — SIMULADO (valores ilustrativos, nenhuma cobrança real).
export type Plan = 'free' | 'plus';
export type UsageKind = 'tutor' | 'essay' | 'gen';
export const DEFAULT_LIMITS: Record<Plan, Record<UsageKind, number>> = {
  free: { tutor: 30, essay: 2, gen: 5 },
  plus: { tutor: 600, essay: 12, gen: 120 },
};
export const UNIT_COST: Record<UsageKind, number> = { tutor: 0.004, essay: 0.09, gen: 0.02 }; // R$ estimado por uso (fictício)
export const USAGE_LABEL: Record<UsageKind, string> = { tutor: 'Mensagens com a IA Tutora', essay: 'Correções de redação', gen: 'Questões geradas' };
export const PLANS = [
  { id: 'free' as Plan, name: 'NEXO Free', price: 'Grátis', features: ['Diagnóstico inicial', 'Sessões limitadas de tutoria', 'Questões essenciais', 'Flashcards básicos', 'Participação em desafios'] },
  { id: 'plus' as Plan, name: 'NEXO Plus', price: 'R$ 24,90/mês', features: ['Trilhas avançadas', 'Mais interações com a IA Tutora', 'Correções de redação (limite mensal)', 'Simulados completos', 'Análises aprofundadas e Detetive de Erros'] },
];
export const monthKey = () => new Date().toISOString().slice(0, 7);
export const estimatedCost = (u: Record<UsageKind, number>) => (Object.keys(u) as UsageKind[]).reduce((s, k) => s + u[k] * UNIT_COST[k], 0);
