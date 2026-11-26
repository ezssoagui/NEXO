import type { Difficulty } from '../mastery/params';

/**
 * Simulados (4.11/5.9/8.8): exclusivamente questões oficiais; seleção representativa por área e
 * dificuldade, priorizando itens inéditos. Resultado por acertos/percentuais, sem TRI.
 */
export const OFFICIAL_FORMAT = {
  day1: { areas: ['LC', 'CH'] as const, questions: 90, minutes: 330, essay: true },
  day2: { areas: ['CN', 'MT'] as const, questions: 90, minutes: 300, essay: false },
};

export interface ExamCandidate { id: string; areaCode: string; difficulty: Difficulty | null; seen: boolean; language: string | null }

/** Distribuição de dificuldade de referência do simulado personalizado (proposta, ADR-013). */
const EXAM_DIFFICULTY_MIX: Record<Difficulty, number> = { easy: 0.3, medium: 0.4, hard: 0.3 };

function pickN(pool: ExamCandidate[], n: number): ExamCandidate[] {
  const unseen = pool.filter((c) => !c.seen);
  const seen = pool.filter((c) => c.seen);
  return [...unseen, ...seen].slice(0, n);
}

export function composeCustomExam(input: {
  candidates: ExamCandidate[];
  perArea: Partial<Record<'LC' | 'CH' | 'CN' | 'MT', number>>;
  language: 'en' | 'es' | null;
}): { itemIds: string[]; shortfall: Record<string, number> } {
  const itemIds: string[] = [];
  const shortfall: Record<string, number> = {};
  for (const [area, n] of Object.entries(input.perArea)) {
    if (!n) continue;
    const pool = input.candidates.filter((c) => c.areaCode === area && (c.language === null || c.language === input.language));
    const chosen: ExamCandidate[] = [];
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const target = Math.round(n * EXAM_DIFFICULTY_MIX[d]);
      chosen.push(...pickN(pool.filter((c) => (c.difficulty ?? 'medium') === d && !chosen.includes(c)), target));
    }
    const rest = pickN(pool.filter((c) => !chosen.includes(c)), n - chosen.length);
    chosen.push(...rest);
    const final = chosen.slice(0, n);
    if (final.length < n) shortfall[area] = n - final.length;
    itemIds.push(...final.map((c) => c.id));
  }
  return { itemIds, shortfall };
}

export interface ExamAnswer { questionId: string; areaCode: string; selected: string | null; correct: string | null; annulled: boolean }

/** Acertos/total/percentual por área e geral (8.8). Itens anulados fora do denominador. */
export function scoreExam(answers: ExamAnswer[]) {
  const byArea: Record<string, { correct: number; total: number; answered: number; percent: number | null }> = {};
  let correct = 0, total = 0, answered = 0;
  for (const a of answers) {
    if (a.annulled) continue;
    const s = (byArea[a.areaCode] ??= { correct: 0, total: 0, answered: 0, percent: null });
    s.total++; total++;
    if (a.selected) { s.answered++; answered++; }
    if (a.selected && a.selected === a.correct) { s.correct++; correct++; }
  }
  for (const s of Object.values(byArea)) s.percent = s.total ? Math.round((s.correct / s.total) * 1000) / 10 : null;
  return { correct, total, answered, percent: total ? Math.round((correct / total) * 1000) / 10 : null, byArea };
}
