import type { Attempt, CardState, Explanation, Flashcard, SkillReview } from '../types';
import { SKILLS, prerequisitesOf } from '../data/skills';
import { tierOf } from '../data/incidence';
import { comparisonsForSkill } from '../data/comparisons';
import { tasksForSkill } from '../data/explainTasks';
import { isSolid, skillName, type DomainMap } from './domain';
import { DEFAULT_PARAMS, type Params } from './params';
import { nextUnseen, priorityWeight, studyPhase } from './strategy';
import { isDue, retrievability } from './fsrs';

/**
 * REVISÃO DE HABILIDADES: intervalos próprios por habilidade, conforme desempenho, incidência e proximidade da prova.
 * Atividades livres também contam: qualquer evidência independente suficiente reagenda (substitui) a revisão.
 */
const DAY = 86400000;
export function scheduleSkill(prev: SkillReview | undefined, skillId: string, outcome: 'forte' | 'media' | 'fraca', ts: number, params: Params = DEFAULT_PARAMS, daysLeft: number | null = null): SkillReview {
  const base = prev ?? { due: ts, interval: 0, ease: 2, lapses: 0 };
  let { ease, interval, lapses } = base;
  if (outcome === 'fraca') { lapses++; ease = Math.max(1.3, ease - 0.2); interval = 1; }
  else if (outcome === 'media') { interval = Math.max(2, Math.round(Math.max(1, interval) * 1.2)); }
  else { interval = interval <= 1 ? params.revisaoInicialDias : Math.round(interval * ease); ease = Math.min(2.8, ease + 0.05); }
  const tier = tierOf(skillId);
  interval = Math.max(1, Math.round(interval * (tier === 'alta' ? 0.9 : tier === 'baixa' ? 1.15 : 1)));
  if (daysLeft !== null && daysLeft > 3) interval = Math.min(interval, Math.max(2, Math.floor(daysLeft / 3)));
  interval = Math.min(interval, 90);
  return { due: ts + interval * DAY, interval, ease: +ease.toFixed(2), last: ts, lapses };
}
export const outcomeOfAttempt = (a: Attempt): 'forte' | 'media' | 'fraca' | null => (a.assisted ? null : !a.correct ? 'fraca' : !isSolid(a) ? null : a.confidence === 'duvida' ? 'media' : 'forte');
export const outcomeOfExplanation = (x: Explanation): 'forte' | 'media' | 'fraca' | null => (x.assisted || x.result === 'inconclusiva' ? null : x.result === 'demonstrada' ? 'forte' : x.result === 'parcial' ? 'media' : 'fraca');

export interface SkillReviewItem { skillId: string; due: number; overdueDays: number; reason: string; priority: number; options: { kind: 'inedita' | 'explicacao' | 'recordacao' | 'comparacao'; label: string; to: string }[] }
/** Fila de revisão de habilidades, com a atividade de recuperação ativa sugerida primeiro. */
export function dueSkillReviews(reviews: Record<string, SkillReview>, domains: DomainMap, attempts: Attempt[], now = Date.now()): SkillReviewItem[] {
  return Object.entries(reviews).filter(([id, r]) => r.due <= now && domains.has(id)).map(([skillId, r]) => {
    const d = domains.get(skillId)!; const overdueDays = Math.floor((now - r.due) / DAY);
    const q = nextUnseen(skillId, attempts); const cmp = comparisonsForSkill(skillId)[0];
    const options: SkillReviewItem['options'] = [];
    if (tasksForSkill(skillId).length) options.push({ kind: 'explicacao', label: 'Explicar', to: `/explicar/${skillId}` });
    if (q) options.push({ kind: 'inedita', label: 'Questão inédita', to: `/questoes/${q.id}` });
    if (cmp) options.push({ kind: 'comparacao', label: 'Comparar conceitos', to: `/comparar/${cmp.id}` });
    options.push({ kind: 'recordacao', label: 'Recordar', to: `/conteudos/habilidade/${skillId}?recordar=1` });
    const weakPre = prerequisitesOf(skillId).find((p) => { const pd = domains.get(p); return pd?.evaluated && pd.state === 'em_aprendizagem'; });
    const reason = d.dims.retencao.status === 'negativa' ? 'Falhou na última verificação após intervalo.' : r.lapses > 0 ? 'Houve erro recente nesta habilidade.' : weakPre ? `Pré-requisito em aprendizagem: ${skillName(weakPre)}.` : d.dims.retencao.status === 'sem_evidencia' ? 'Falta demonstrar retenção.' : 'Revisão programada.';
    return { skillId, due: r.due, overdueDays, reason, options, priority: priorityWeight(skillId) * (1 + Math.min(1, overdueDays / 14)) * (1 + Math.min(0.6, r.lapses * 0.2)) };
  }).sort((a, b) => b.priority - a.priority);
}

export interface StrategicPlan { kind: 'semanal' | 'mensal' | 'final'; title: string; when: string; focus: { skillId: string; why: string }[]; tasks: string[] }
/** REVISÃO ESTRATÉGICA: semanal, mensal e final, priorizando incidência, dificuldade, retenção e pré-requisitos. */
export function strategicPlans(input: { domains: DomainMap; attempts: Attempt[]; cards: Flashcard[]; cardStates: Record<string, CardState>; examYear: number; now?: number }): StrategicPlan[] {
  const now = input.now ?? Date.now();
  const { daysLeft, phase } = studyPhase({ examYear: input.examYear }, now);
  const within = (days: number) => new Set(input.attempts.filter((a) => now - a.ts <= days * DAY).map((a) => a.skillId));
  const score = (id: string) => { const d = input.domains.get(id)!; const weak = d.dims.resolucao.status === 'negativa' || d.regressed ? 1.6 : d.state === 'em_aprendizagem' ? 1.3 : d.dims.retencao.status === 'negativa' ? 1.5 : 1; return priorityWeight(id) * weak; };
  const why = (id: string) => { const d = input.domains.get(id)!; return d.regressed ? 'perdeu domínio demonstrado' : d.dims.resolucao.status === 'negativa' ? 'erros recentes' : d.dims.retencao.status === 'sem_evidencia' ? 'retenção ainda não verificada' : tierOf(id) === 'alta' ? 'alta incidência' : 'manutenção'; };
  const top = (ids: string[], n: number) => ids.filter((id) => input.domains.has(id)).sort((a, b) => score(b) - score(a)).slice(0, n).map((skillId) => ({ skillId, why: why(skillId) }));
  const evaluated = SKILLS.map((s) => s.id).filter((id) => input.domains.get(id)?.evaluated);
  const lowCards = input.cards.filter((c) => { const r = retrievability(input.cardStates[c.id], now); return isDue(input.cardStates[c.id], now) || (r !== null && r < 0.8); }).length;
  const tasks = ['Recordar cada item sem consultar; depois conferir.', 'Resolver uma questão inédita ou explicar em voz própria.', ...(lowCards ? [`Rever ${lowCards} flashcard(s) com risco de esquecimento.`] : [])];
  const plans: StrategicPlan[] = [
    { kind: 'semanal', title: 'Revisão da semana', when: 'O que você estudou nos últimos 7 dias', focus: top([...within(7)], 5), tasks },
    { kind: 'mensal', title: 'Revisão do mês', when: 'O que você estudou nos últimos 30 dias', focus: top([...within(30)], 8), tasks },
    { kind: 'final', title: 'Revisão final personalizada', when: daysLeft === null || daysLeft < 0 ? 'Data da prova não definida' : phase === 'reta_final' ? `Reta final: cerca de ${daysLeft} dias` : `Disponível a partir de 30 dias da prova (faltam cerca de ${daysLeft})`, focus: top(evaluated, 12), tasks: ['Intercalar blocos por incidência e fragilidade.', 'Um simulado em condições de prova por semana.', 'Revisão final cerca de três dias antes; véspera para descansar.'] },
  ];
  return plans;
}
