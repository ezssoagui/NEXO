import type { Attempt, Question } from '../types';
import { QUESTIONS } from '../data/questions';
import { SKILLS } from '../data/skills';
import { disciplineOf } from '../data/curriculum';
import { INCIDENCE, tierOf, type Tier } from '../data/incidence';
import { isSolid } from './domain';

/**
 * PRIORIZAÇÃO ESTRATÉGICA: incidência, carga de exercícios (intensidade sobre relevância), básico primeiro e fase do calendário.
 * Altera apenas a ordem e a dose do estudo; nunca o domínio. Pesos experimentais.
 */
const DAY = 86400000;
const TIER_WEIGHT: Record<Tier, number> = { alta: 1.35, media: 1, baixa: 0.7 };
/** Assuntos-base sustentam outros: cada dependente acrescenta um pouco de prioridade. */
const foundationBonus = (id: string) => Math.min(0.15, 0.05 * SKILLS.filter((s) => s.prerequisites.includes(id)).length);
export const priorityWeight = (skillId: string) => +(TIER_WEIGHT[tierOf(skillId)] + foundationBonus(skillId)).toFixed(3);

export function incidenceNote(skillId: string): string | null {
  const x = INCIDENCE[skillId];
  return x ? `${x.topic}: ${x.share.toLocaleString('pt-BR')}% das questões de ${disciplineOf(skillId)}` : null;
}
export const TIER_LABEL: Record<Tier, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

// ---------- Carga de exercícios ----------
const LOAD_EXACT: Record<Tier, [number, number]> = { alta: [15, 50], media: [5, 10], baixa: [1, 5] };
const LOAD_TEXT: Record<Tier, [number, number]> = { alta: [15, 20], media: [5, 10], baixa: [0, 0] };
export interface Load { tier: Tier; min: number; max: number; done: number; enough: boolean; note: string }
/** Dose por relevância; a segurança recente encerra a bateria e o teto evita travar em um assunto. Quantidade não é domínio. */
export function exerciseLoad(skillId: string, attempts: Attempt[]): Load {
  const tier = tierOf(skillId); const area = SKILLS.find((s) => s.id === skillId)?.area;
  const [min, max] = (area === 'Ciências Humanas' || area === 'Linguagens' ? LOAD_TEXT : LOAD_EXACT)[tier];
  const list = attempts.filter((a) => a.skillId === skillId).sort((a, b) => a.ts - b.ts);
  const done = list.length; const last = list.slice(-5);
  const confident = last.length === 5 && last.filter(isSolid).length >= 4;
  const capped = max > 0 && done >= max;
  const enough = (done >= min && (confident || min === 0)) || capped;
  const note = capped && !confident ? 'Teto atingido: registre a pendência e siga; ela volta na revisão.' : enough ? 'Dose suficiente por agora: manter com revisões.' : done >= min ? 'Dose mínima feita; continue até acertar 4 das últimas 5 com segurança.' : `Faltam ${min - done} para a dose mínima sugerida.`;
  return { tier, min, max, done, enough, note };
}

// ---------- Básico primeiro ----------
const DIFF: Record<Question['difficulty'], number> = { 'Fácil': 0, 'Média': 1, 'Difícil': 2 };
export const byDifficulty = (a: Question, b: Question) => DIFF[a.difficulty] - DIFF[b.difficulty];
export function unseenFor(skillId: string, attempts: Attempt[], opts: { integrates?: boolean } = {}): Question[] {
  const seen = new Set(attempts.map((a) => a.qid));
  return QUESTIONS.filter((q) => q.type === 'objetiva' && !seen.has(q.id) && (opts.integrates ? !!q.integrates && (q.skillId === skillId || q.integrates.includes(skillId)) : q.skillId === skillId && !q.integrates)).sort(byDifficulty);
}
/** Próxima questão inédita: da mais fácil para a mais difícil. */
export const nextUnseen = (skillId: string, attempts: Attempt[]): Question | undefined => unseenFor(skillId, attempts)[0];

// ---------- Fase da preparação ----------
export type Phase = 'base' | 'consolidacao' | 'reta_final' | 'descanso' | 'pos';
export const PHASE_INFO: Record<Phase, { label: string; tip: string }> = {
  base: { label: 'Construção de base', tip: 'Teoria e questões juntas, começando pelo básico do que mais cai.' },
  consolidacao: { label: 'Consolidação', tip: 'Menos conteúdo novo; mais questões, pendências e revisão ativa.' },
  reta_final: { label: 'Reta final', tip: 'Último mês: revisão, questões e simulados em condições de prova.' },
  descanso: { label: 'Dias de prova', tip: 'Descanse a mente. No máximo, uma revisão bem leve.' },
  pos: { label: 'Prova realizada', tip: 'A data prevista já passou: atualize o ano da prova em Configurações.' },
};
/** Data APROXIMADA do ENEM (primeiro domingo de novembro). Confira sempre o edital. */
export function examDate(year: number): Date { const d = new Date(year, 10, 1); d.setDate(1 + ((7 - d.getDay()) % 7)); return d; }
export function studyPhase(profile: { examYear: number } | null, now = Date.now()): { phase: Phase; daysLeft: number | null } {
  if (!profile) return { phase: 'base', daysLeft: null };
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((examDate(profile.examYear).getTime() - today.getTime()) / DAY);
  return { phase: daysLeft < -7 ? 'pos' : daysLeft <= 2 ? 'descanso' : daysLeft <= 30 ? 'reta_final' : daysLeft <= 90 ? 'consolidacao' : 'base', daysLeft };
}
