import type { Difficulty, Dimension, EngineParams } from './params';

/**
 * Derivação de evidências a partir de eventos de aprendizagem (2.14, 8.1, A.3.1).
 * Regras (ADR-008, experimentais):
 *  - Questão oficial gera o MESMO tipo de evidência em qualquer modo (livre, lista, sessão,
 *    simulado, diagnóstico) — A.3.1. Somente a habilidade principal recebe evidência (3.9).
 *  - Primeira exposição ao item = independente; repetição = 'repeated' (vale menos, não prova transferência — 2.12).
 *  - Transferência: primeira exposição a item inédito numa habilidade com evidência prévia de dia anterior.
 *  - Retenção: evidência após intervalo mínimo desde a última evidência da habilidade.
 *  - Leitura de aula NÃO gera evidência de domínio (5.1/8.6).
 *  - CPE ocorre após a correção: compreensão assistida.
 *  - Flashcard gera somente retenção (cartões sozinhos não consolidam — 5.6/8.6).
 */
export interface DerivedEvidence {
  skillId: string;
  dimension: Dimension;
  score: number;
  difficulty: Difficulty | null;
  independence: 'independent' | 'assisted' | 'repeated';
  itemKey: string;
}

export interface SkillHistory {
  /** Primeira evidência registrada na habilidade (qualquer dimensão). */
  firstEvidenceAt: Date | null;
  /** Última evidência registrada na habilidade. */
  lastEvidenceAt: Date | null;
}

const DAY_MS = 86_400_000;

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function retentionEligible(history: SkillHistory, at: Date, params: EngineParams): boolean {
  if (!history.lastEvidenceAt) return false;
  return (at.getTime() - history.lastEvidenceAt.getTime()) / DAY_MS >= params.mastery.retentionMinIntervalDays;
}

export function deriveQuestionEvidence(input: {
  skillId: string;
  itemKey: string;
  isCorrect: boolean;
  difficulty: Difficulty | null;
  isFirstExposure: boolean;
  history: SkillHistory;
  at: Date;
  params: EngineParams;
}): DerivedEvidence[] {
  const score = input.isCorrect ? 100 : 0;
  const independence = input.isFirstExposure ? 'independent' : 'repeated';
  const out: DerivedEvidence[] = [
    { skillId: input.skillId, dimension: 'resolution', score, difficulty: input.difficulty, independence, itemKey: input.itemKey },
  ];
  if (
    input.isFirstExposure &&
    input.history.firstEvidenceAt &&
    startOfUtcDay(input.history.firstEvidenceAt) < startOfUtcDay(input.at)
  ) {
    out.push({ skillId: input.skillId, dimension: 'transfer', score, difficulty: input.difficulty, independence, itemKey: input.itemKey });
  }
  if (retentionEligible(input.history, input.at, input.params)) {
    out.push({ skillId: input.skillId, dimension: 'retention', score, difficulty: input.difficulty, independence, itemKey: input.itemKey });
  }
  return out;
}

/** Rubrica 0–3 (7.4) → 0..100. */
export function rubricToScore(rubric: 0 | 1 | 2 | 3): number {
  return Math.round((rubric / 3) * 10000) / 100;
}

export function deriveConceptEvidence(input: {
  skillId: string;
  activityId: string;
  rubric: 0 | 1 | 2 | 3;
  history: SkillHistory;
  at: Date;
  params: EngineParams;
}): DerivedEvidence[] {
  const score = rubricToScore(input.rubric);
  const itemKey = `ca:${input.activityId}`;
  const out: DerivedEvidence[] = [
    { skillId: input.skillId, dimension: 'comprehension', score, difficulty: null, independence: 'independent', itemKey },
  ];
  if (retentionEligible(input.history, input.at, input.params)) {
    out.push({ skillId: input.skillId, dimension: 'retention', score, difficulty: null, independence: 'independent', itemKey });
  }
  return out;
}

/** Errei/Difícil/Bom/Fácil → retenção, somente após intervalo mínimo desde a revisão anterior. */
export const FLASHCARD_RETENTION_SCORE: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 60, 3: 85, 4: 100 };

export function deriveFlashcardEvidence(input: {
  skillId: string | null;
  cardId: string;
  rating: 1 | 2 | 3 | 4;
  elapsedDaysSinceLastReview: number;
  params: EngineParams;
}): DerivedEvidence[] {
  if (!input.skillId) return [];
  if (input.elapsedDaysSinceLastReview < input.params.mastery.retentionMinIntervalDays) return [];
  return [{
    skillId: input.skillId, dimension: 'retention', score: FLASHCARD_RETENTION_SCORE[input.rating],
    difficulty: null, independence: 'independent', itemKey: `fc:${input.cardId}`,
  }];
}

export function deriveCpeEvidence(input: { skillId: string; attemptId: string; correctSteps: number; totalSteps: number }): DerivedEvidence[] {
  if (input.totalSteps <= 0) return [];
  return [{
    skillId: input.skillId, dimension: 'comprehension',
    score: Math.round((input.correctSteps / input.totalSteps) * 10000) / 100,
    difficulty: null, independence: 'assisted', itemKey: `cpe:${input.attemptId}`,
  }];
}
