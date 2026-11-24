import type { Attempt, Profile, Question } from '../types';
import { QUESTIONS } from '../data/questions';
import { SKILLS, skillById } from '../data/skills';
import { INCIDENCE, tierOf, type Tier } from '../data/incidence';
import { skillMastery, solid } from './mastery';

/**
 * ESTRATÉGIA DE PREPARAÇÃO: incidência na prova, carga de exercícios, "básico primeiro" e fase do calendário.
 * Regras transparentes; não alteram o domínio, apenas a ordem e a dose do estudo.
 */
const DAY = 86400000;
export type Goal = Profile['goal'];

const TIER_WEIGHT: Record<Tier, number> = { alta: 1.35, media: 1, baixa: 0.7 };
/** Assuntos-base sustentam outros: cada dependente acrescenta um pouco de prioridade. */
const foundationBonus = (id: string) => Math.min(0.15, 0.05 * SKILLS.filter((s) => s.prerequisites?.includes(id)).length);
/** Peso conforme o objetivo. A incidência medida é do ENEM: vale metade em vestibular/combinada e nada em olimpíadas. */
export function priorityWeight(skillId: string, goal: Goal = 'ENEM'): number {
  if (goal === 'Olimpíadas') return skillId === 'mat-teoria-numeros' ? 1.35 : 1;
  const w = TIER_WEIGHT[tierOf(skillId)] + foundationBonus(skillId);
  return +(goal === 'ENEM' ? w : 1 + (w - 1) / 2).toFixed(3);
}

const DISCIPLINE: Record<string, string> = { 'hum-historia': 'História', 'hum-geografia': 'Geografia', 'hum-filosofia': 'Filosofia', 'lin-interpretacao': 'Língua Portuguesa', 'lin-funcoes': 'Língua Portuguesa' };
export function incidenceNote(skillId: string): string | null {
  const x = INCIDENCE[skillId];
  return x ? `${x.topic}: ${x.share.toLocaleString('pt-BR')}% das questões de ${DISCIPLINE[skillId] ?? skillById(skillId)?.subject} no ENEM (2016–2025)` : null;
}

// ---------- Carga de exercícios ----------
const LOAD_EXACT: Record<Tier, [number, number]> = { alta: [15, 50], media: [5, 10], baixa: [1, 5] };
const LOAD_TEXT: Record<Tier, [number, number]> = { alta: [15, 20], media: [5, 10], baixa: [0, 0] };
export interface Load { tier: Tier; min: number; max: number; done: number; enough: boolean; note: string }
/** Dose de exercícios por relevância; a segurança recente encerra a bateria, e o teto evita travar em um assunto só. */
export function exerciseLoad(skillId: string, attempts: Attempt[]): Load {
  const tier = tierOf(skillId); const sub = skillById(skillId)?.subject;
  const [min, max] = (sub === 'Humanas' || sub === 'Linguagens' ? LOAD_TEXT : LOAD_EXACT)[tier];
  const list = attempts.filter((a) => a.skillId === skillId && !a.free).sort((a, b) => a.ts - b.ts);
  const done = list.length; const last = list.slice(-5);
  const confident = last.length === 5 && last.filter(solid).length >= 4;
  const capped = max > 0 && done >= max;
  const enough = (done >= min && (confident || min === 0)) || capped;
  const note = capped && !confident ? 'Teto atingido: registre a pendência e siga; ela volta na revisão.'
    : enough ? 'Dose suficiente por agora: manter com revisões.'
    : done >= min ? 'Dose mínima feita; continue até acertar 4 das últimas 5 com segurança.'
    : `Faltam ${min - done} para a dose mínima (até 15 por dia; o restante nas revisões).`;
  return { tier, min, max, done, enough, note };
}

// ---------- Nível de estudo ----------
export const STUDY_LEVELS = ['A começar', 'Primeiro contato', 'Praticando', 'Aprofundando', 'Dominado'] as const;
export function studyLevel(skillId: string, attempts: Attempt[]): 0 | 1 | 2 | 3 | 4 {
  const m = skillMastery(attempts, skillId);
  if (!m.attempts) return 0;
  if (m.state === 'consistente') return 4;
  if (m.state === 'provisorio') return 3;
  return m.attempts < 3 ? 1 : 2;
}

// ---------- Básico primeiro ----------
const DIFF: Record<Question['difficulty'], number> = { 'Fácil': 0, 'Média': 1, 'Difícil': 2 };
export const byDifficulty = (a: Question, b: Question) => DIFF[a.difficulty] - DIFF[b.difficulty];
/** Próxima questão inédita: da mais fácil para a mais difícil (coerência pesa em provas com TRI). */
export function nextUnseen(skillId: string, attempts: Attempt[]): Question | undefined {
  const seen = new Set(attempts.map((a) => a.qid));
  return QUESTIONS.filter((q) => q.skillId === skillId && !seen.has(q.id) && !q.integrates).sort(byDifficulty)[0];
}

// ---------- Fase da preparação ----------
export type Phase = 'base' | 'consolidacao' | 'reta_final' | 'descanso' | 'pos';
export const PHASE_INFO: Record<Phase, { label: string; tip: string }> = {
  base: { label: 'Construção de base', tip: 'Teoria e questões juntas, começando pelo básico do que mais cai.' },
  consolidacao: { label: 'Consolidação', tip: 'Menos conteúdo novo; mais questões, pendências e revisão ativa.' },
  reta_final: { label: 'Reta final', tip: 'Último mês: só revisão e questões, com simulados em condições de prova.' },
  descanso: { label: 'Dias de prova', tip: 'Descanse a mente. No máximo, uma revisão bem leve.' },
  pos: { label: 'Prova realizada', tip: 'A data prevista já passou: crie um perfil com o próximo ano de prova para recalcular o plano.' },
};
/** Data APROXIMADA do ENEM (primeiro domingo de novembro). Confira sempre o edital. */
export function examDate(year: number): Date { const d = new Date(year, 10, 1); d.setDate(1 + ((7 - d.getDay()) % 7)); return d; }
export function studyPhase(profile: Pick<Profile, 'examYear' | 'goal'> | null, now = Date.now()): { phase: Phase; daysLeft: number | null } {
  if (!profile || profile.goal === 'Olimpíadas' || profile.goal === 'Vestibular') return { phase: 'base', daysLeft: null };
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((examDate(profile.examYear).getTime() - today.getTime()) / DAY);
  // Até 7 dias depois do primeiro domingo ainda há a segunda prova.
  return { phase: daysLeft < -7 ? 'pos' : daysLeft <= 2 ? 'descanso' : daysLeft <= 30 ? 'reta_final' : daysLeft <= 90 ? 'consolidacao' : 'base', daysLeft };
}
