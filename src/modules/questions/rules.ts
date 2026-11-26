import type { Difficulty } from '../mastery/params';

/**
 * CPE — Comando, Prova, Eliminação (2.6): SOMENTE em erro de questão média/difícil de
 * Linguagens ou Humanas, quando pertinente. Nunca em fácil, acerto, Matemática ou Natureza.
 */
export function cpeEligible(q: { areaCode: string; difficulty: Difficulty | null; isCorrect: boolean; cpeApplicable?: boolean }): boolean {
  if (q.isCorrect) return false;
  if (q.areaCode !== 'LC' && q.areaCode !== 'CH') return false;
  if (q.difficulty !== 'medium' && q.difficulty !== 'hard') return false;
  return q.cpeApplicable !== false;
}

/** Classificação opcional de erro (2.7) apenas em Matemática/Natureza. */
export function errorClassificationOffered(q: { areaCode: string; isCorrect: boolean }): boolean {
  return !q.isCorrect && (q.areaCode === 'MT' || q.areaCode === 'CN');
}

export const ERROR_CAUSES = ['knowledge_gap', 'conceptual', 'interpretive', 'application', 'procedural', 'attention', 'unknown'] as const;

/**
 * Dificuldade a partir do parâmetro oficial NU_PARAM_B (3.7): tercis por área no acervo
 * (ADR-009, proposta reversível). Sem parâmetro → classificação pedagógica provisória.
 */
export function terciles(values: number[]): [number, number] | null {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length < 3) return null;
  const q = (p: number) => {
    const pos = (xs.length - 1) * p;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return xs[lo]! + (xs[hi]! - xs[lo]!) * (pos - lo);
  };
  return [q(1 / 3), q(2 / 3)];
}

export function difficultyFromParamB(b: number, cuts: [number, number]): Difficulty {
  if (b <= cuts[0]) return 'easy';
  if (b <= cuts[1]) return 'medium';
  return 'hard';
}

/** Correção conforme modalidade (2.4): avulsa após confirmar; lista/prova ao final. */
export function revealPolicy(mode: 'single' | 'list' | 'session' | 'exam' | 'diagnostic'): 'after_submit' | 'after_finish' {
  return mode === 'single' || mode === 'session' ? 'after_submit' : 'after_finish';
}
