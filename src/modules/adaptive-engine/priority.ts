import type { Difficulty, EngineParams, Relevance } from '../mastery/params';
import type { MasteryState } from '../mastery/compute';

/**
 * Motor adaptativo determinístico (15.5). Nenhuma chamada de IA decide a rota (2.13/A.3).
 * Prioridade = 0,30·dificuldade + 0,25·relevância + 0,20·revisão + 0,15·lacuna de cobertura
 * + 0,10·conexões (pesos experimentais), fatores normalizados 0..1; ausência ≠ zero.
 */
export type Category = 'learn' | 'improve' | 'deepen' | 'review';
export type Focus = 'exploration' | 'fundamentals' | 'comprehension' | 'practice' | 'transfer' | 'retention' | 'maintenance' | 'recovery';
export type DifficultyLevel = 'very_high' | 'high' | 'moderate' | 'punctual' | 'maintenance';

export interface SkillSnapshot {
  skillId: string;
  state: MasteryState;
  d: number | null;
  r: number | null;
  c: number | null;
  t: number | null;
  m: number | null;
  easyAccuracy: number | null;
  easyIndependentCount: number;
}

export interface SubtopicSnapshot {
  subtopicId: string;
  name: string;
  areaCode: 'LC' | 'MT' | 'CN' | 'CH';
  relevance: Relevance;
  skills: SkillSnapshot[];
  /** Tentativas mais recentes do subtópico (mais recente primeiro). */
  recentAttempts: { isCorrect: boolean; difficulty: Difficulty | null }[];
  lessonReads: number;
  review: { dueSkills: number; maxOverdueRatio: number };
  /** 0..1 — importância como pré-requisito/conexão (normalizada no currículo). */
  connections: number;
}

export interface PriorityContext {
  daysToExam: number | null;
  /** Ajuste de reta final por área (4.10): ex. { LC: 1.15, CH: 1.15 } antes do 1º dia. */
  areaBoost?: Partial<Record<'LC' | 'MT' | 'CN' | 'CH', number>>;
}

export interface PriorityResult {
  subtopicId: string;
  priority: number;
  factors: { difficulty: number; relevance: number; review: number; coverage: number; connections: number };
  weights: EngineParams['priority']['weights'];
  category: Category;
  focus: Focus;
  level: DifficultyLevel;
  reason: string;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function proximityMultiplier(daysToExam: number | null, params: EngineParams): number {
  if (daysToExam === null || daysToExam < 0) return 1;
  const bands = [...params.priority.proximity].sort((a, b) => a.maxDays - b.maxDays);
  for (const b of bands) if (daysToExam <= b.maxDays) return b.reviewMultiplier;
  return 1;
}

export function effectiveWeights(daysToExam: number | null, params: EngineParams): EngineParams['priority']['weights'] {
  const w = { ...params.priority.weights };
  w.review *= proximityMultiplier(daysToExam, params);
  const sum = w.difficulty + w.relevance + w.review + w.coverage + w.connections;
  return {
    difficulty: w.difficulty / sum, relevance: w.relevance / sum, review: w.review / sum,
    coverage: w.coverage / sum, connections: w.connections / sum,
  };
}

export function difficultyLevel(s: SubtopicSnapshot): DifficultyLevel {
  const assessed = s.skills.filter((k) => k.state !== 'not_assessed');
  if (assessed.length === 0) return 'punctual';
  if (assessed.every((k) => k.state === 'consolidated')) return 'maintenance';
  const recent = s.recentAttempts;
  const errRate = recent.length >= 5 ? recent.filter((a) => !a.isCorrect).length / recent.length : null;
  if (errRate !== null && errRate >= 0.7) return 'very_high';
  const dAvg = avg(assessed.map((k) => k.d).filter((d): d is number => d !== null));
  if (dAvg === null) return 'moderate';
  if (dAvg < 30) return 'very_high';
  if (dAvg < 50) return 'high';
  if (dAvg < 70) return 'moderate';
  if (dAvg < 85) return 'punctual';
  return 'maintenance';
}

function decide(s: SubtopicSnapshot, params: EngineParams): { category: Category; focus: Focus; reason: string } {
  const assessed = s.skills.filter((k) => k.state !== 'not_assessed');
  const total = s.skills.length;
  const pattern = params.priority.recoveryPattern;
  const window = s.recentAttempts.slice(0, pattern.window);
  const errors = window.filter((a) => !a.isCorrect).length;
  const rAvg = avg(assessed.map((k) => k.r).filter((x): x is number => x !== null));
  const cAvg = avg(assessed.map((k) => k.c).filter((x): x is number => x !== null));
  const mAvg = avg(assessed.map((k) => k.m).filter((x): x is number => x !== null));
  const hasR = assessed.some((k) => k.r !== null);
  const hasT = assessed.some((k) => k.t !== null);
  const easyCount = assessed.reduce((n, k) => n + k.easyIndependentCount, 0);
  const easyAcc = avg(assessed.map((k) => k.easyAccuracy).filter((x): x is number => x !== null));

  if (assessed.length === 0 && s.lessonReads === 0) {
    return { category: 'learn', focus: 'exploration', reason: relevanceText(s.relevance, 'ainda não estudado') };
  }
  if (window.length >= pattern.minErrors && errors >= pattern.minErrors) {
    return { category: 'improve', focus: 'recovery', reason: `${errors} erros nas últimas ${window.length} questões deste conteúdo.` };
  }
  if (easyAcc !== null && easyCount >= 2 && easyAcc < 50) {
    return { category: 'improve', focus: 'fundamentals', reason: 'Erros em questões fáceis indicam necessidade de reforçar fundamentos.' };
  }
  if (rAvg !== null && rAvg >= 70 && cAvg !== null && cAvg < 50) {
    return { category: 'improve', focus: 'comprehension', reason: 'Você acerta as questões, mas as explicações mostram compreensão incompleta.' };
  }
  if (!hasR && !hasT && (s.lessonReads > 0 || cAvg !== null)) {
    return { category: 'deepen', focus: 'transfer', reason: 'Teoria estudada sem aplicação em questões: hora de praticar.' };
  }
  if (mAvg !== null && mAvg < params.reviews.successThreshold) {
    return { category: 'review', focus: 'retention', reason: 'Evidências recentes indicam perda de retenção.' };
  }
  if (s.review.dueSkills > 0 && assessed.some((k) => k.state === 'provisional' || k.state === 'consolidated')) {
    return { category: 'review', focus: 'retention', reason: 'Revisão pendente para manter o que você já aprendeu.' };
  }
  if (assessed.length > 0 && assessed.length === total && assessed.every((k) => k.state === 'consolidated')) {
    return { category: 'deepen', focus: 'maintenance', reason: 'Conteúdo consolidado: manutenção e aprofundamento.' };
  }
  if (total > 0 && (total - assessed.length) / total >= 0.5) {
    return { category: 'learn', focus: 'exploration', reason: 'Parte importante deste conteúdo ainda não foi avaliada.' };
  }
  const dAvg = avg(assessed.map((k) => k.d).filter((x): x is number => x !== null));
  if (dAvg !== null && dAvg >= params.mastery.thresholds.provisional) {
    return { category: 'deepen', focus: 'transfer', reason: 'Bom desempenho: aplicações mais complexas para consolidar.' };
  }
  return { category: 'improve', focus: 'practice', reason: 'Prática direcionada para elevar o domínio deste conteúdo.' };
}

function relevanceText(rel: Relevance, tail: string): string {
  const map: Record<Relevance, string> = {
    high: 'Conteúdo de alta relevância no ENEM', medium: 'Conteúdo de relevância média',
    low: 'Conteúdo de base', unknown: 'Conteúdo do currículo',
  };
  return `${map[rel]} ${tail}.`;
}

export function computePriority(s: SubtopicSnapshot, ctx: PriorityContext, params: EngineParams): PriorityResult {
  const assessed = s.skills.filter((k) => k.state !== 'not_assessed');
  const dAvg = avg(assessed.map((k) => k.d).filter((x): x is number => x !== null));
  const recent = s.recentAttempts.slice(0, params.priority.recoveryPattern.window);
  const recentErr = recent.length ? recent.filter((a) => !a.isCorrect).length / recent.length : null;

  let difficulty: number;
  if (dAvg === null) difficulty = params.priority.unknownDifficultyPrior;
  else difficulty = 0.7 * (1 - dAvg / 100) + 0.3 * (recentErr ?? 1 - dAvg / 100);
  const relevance = params.priority.relevanceScore[s.relevance];
  const review = s.review.dueSkills > 0 ? Math.min(1, 0.5 + 0.5 * Math.max(0, s.review.maxOverdueRatio)) : 0;
  const coverage = s.skills.length ? (s.skills.length - assessed.length) / s.skills.length : 0;
  const connections = Math.max(0, Math.min(1, s.connections));

  const weights = effectiveWeights(ctx.daysToExam, params);
  let priority =
    weights.difficulty * difficulty + weights.relevance * relevance + weights.review * review +
    weights.coverage * coverage + weights.connections * connections;
  priority *= ctx.areaBoost?.[s.areaCode] ?? 1;

  const { category, focus, reason } = decide(s, params);
  return {
    subtopicId: s.subtopicId,
    priority: round4(priority),
    factors: {
      difficulty: round4(difficulty), relevance: round4(relevance), review: round4(review),
      coverage: round4(coverage), connections: round4(connections),
    },
    weights,
    category, focus, level: difficultyLevel(s), reason,
  };
}

/** Ordenação determinística com desempate explícito (15.5): prioridade, relevância, id. */
export function rankRecommendations(results: PriorityResult[]): PriorityResult[] {
  return [...results].sort((a, b) =>
    b.priority - a.priority || b.factors.relevance - a.factors.relevance || a.subtopicId.localeCompare(b.subtopicId));
}

/** Janela de reta final (4.10): antes do 1º dia LC/CH; entre os dias MT/CN. Referências a calibrar. */
export function finalStretchBoost(now: Date, day1: Date | null, day2: Date | null): PriorityContext['areaBoost'] {
  if (!day1 || !day2) return undefined;
  const t = now.getTime();
  const days1 = (day1.getTime() - t) / 86_400_000;
  if (days1 > 0 && days1 <= 7) return { LC: 1.15, CH: 1.15 };
  if (t > day1.getTime() && t < day2.getTime()) return { MT: 1.15, CN: 1.15 };
  return undefined;
}
