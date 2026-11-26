import { z } from 'zod';

/**
 * Questões gêmeas (2.12/5.5/7.6): último recurso. Checagens estruturais em código antes da
 * segunda chamada independente de validação. Nunca entram no banco oficial.
 */
export const twinDraftSchema = z.object({
  statement: z.string().min(40).max(4000),
  alternatives: z.array(z.object({ letter: z.enum(['A', 'B', 'C', 'D', 'E']), text: z.string().min(1).max(800) })).length(5),
  correct: z.enum(['A', 'B', 'C', 'D', 'E']),
  solution: z.string().min(40).max(4000),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});
export type TwinDraft = z.infer<typeof twinDraftSchema>;

export const twinValidationSchema = z.object({
  verdict: z.enum(['approved', 'rejected']),
  unique_correct_answer: z.boolean(),
  answer_matches_key: z.boolean(),
  same_skill_and_reasoning: z.boolean(),
  statement_clear: z.boolean(),
  solution_correct: z.boolean(),
  issues: z.array(z.string().max(400)).max(10),
});
export type TwinValidation = z.infer<typeof twinValidationSchema>;

function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((t) => t.length > 2));
}

export function jaccard(a: string, b: string): number {
  const A = tokens(a), B = tokens(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export function structuralChecks(draft: TwinDraft, originStatement: string): { ok: boolean; checks: Record<string, boolean> } {
  const letters = draft.alternatives.map((a) => a.letter);
  const texts = draft.alternatives.map((a) => a.text.trim().toLowerCase());
  const checks = {
    five_distinct_letters: new Set(letters).size === 5 && letters.join('') === 'ABCDE',
    distinct_alternatives: new Set(texts).size === 5,
    correct_in_alternatives: letters.includes(draft.correct),
    not_copy_of_origin: jaccard(draft.statement, originStatement) < 0.85,
    solution_mentions_answer: new RegExp(`\\b${draft.correct}\\b`).test(draft.solution) ||
      draft.solution.toLowerCase().includes(draft.alternatives.find((a) => a.letter === draft.correct)!.text.toLowerCase().slice(0, 30)),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

/** Aprovação exige checagens estruturais E veredito independente favorável em todos os critérios. */
export function twinApproved(structural: { ok: boolean }, v: TwinValidation): boolean {
  return structural.ok && v.verdict === 'approved' && v.unique_correct_answer && v.answer_matches_key &&
    v.same_skill_and_reasoning && v.statement_clear && v.solution_correct;
}
