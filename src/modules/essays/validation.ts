import { z } from 'zod';

/**
 * Validação estrutural da correção de redação (6.1/7.5/7.8):
 *  - cinco competências, notas em {0,40,...,200}, total = soma (0–1000);
 *  - justificativas citando trechos VERIFICÁVEIS do próprio texto do estudante;
 *  - zero/anulação conforme critérios da cartilha (motivo obrigatório).
 * Resposta inválida não altera domínio nem consome franquia.
 */
export const COMPETENCY_SCORES = [0, 40, 80, 120, 160, 200] as const;
const score = z.number().int().refine((v) => (COMPETENCY_SCORES as readonly number[]).includes(v), 'nota fora de 0..200 em passos de 40');

export const competencyEvaluationSchema = z.object({
  competency: z.number().int().min(1).max(5),
  score,
  justification: z.string().min(20).max(2500),
  citations: z.array(z.string().min(3).max(600)).max(8),
  strengths: z.array(z.string().max(400)).max(6),
  improvements: z.array(z.string().max(400)).max(6),
});

export const ZERO_REASONS = [
  'fuga_total_ao_tema', 'nao_atendimento_tipo_textual', 'texto_insuficiente', 'parte_desconectada',
  'copia_textos_motivadores', 'identificacao_ou_desrespeito', 'outro_criterio_da_cartilha',
] as const;

export const fullEvaluationSchema = z.object({
  zeroed: z.boolean(),
  zero_reason: z.enum(ZERO_REASONS).nullable(),
  competencies: z.array(competencyEvaluationSchema).length(5),
  total: z.number().int().min(0).max(1000),
  overall_feedback: z.string().min(20).max(3000),
  recommendations: z.array(z.string().max(500)).min(1).max(8),
});
export type FullEvaluation = z.infer<typeof fullEvaluationSchema>;

export const partialEvaluationSchema = z.object({
  competency: z.number().int().min(1).max(5),
  improved: z.enum(['yes', 'partially', 'no']),
  estimated_score: score.nullable(),
  justification: z.string().min(20).max(2500),
  citations: z.array(z.string().min(3).max(600)).max(6),
  next_steps: z.array(z.string().max(400)).min(1).max(5),
});
export type PartialEvaluation = z.infer<typeof partialEvaluationSchema>;

export function normalizeForMatch(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[“”«»"]/g, '"')
    .replace(/[‘’`´]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Citações devem existir literalmente (normalizadas) no texto do estudante. */
export function verifyCitations(text: string, citations: string[]): { valid: boolean; invalid: string[] } {
  const hay = normalizeForMatch(text);
  const invalid = citations.filter((c) => {
    const needle = normalizeForMatch(c).replace(/^\.\.\.|\.\.\.$|^…|…$/g, '').trim();
    return needle.length < 3 || !hay.includes(needle);
  });
  return { valid: invalid.length === 0, invalid };
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function validateFullEvaluation(raw: unknown, essayText: string): ValidationResult<FullEvaluation> {
  const parsed = fullEvaluationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  const ev = parsed.data;
  const errors: string[] = [];
  const comps = [...ev.competencies].sort((a, b) => a.competency - b.competency);
  if (comps.map((c) => c.competency).join() !== '1,2,3,4,5') errors.push('competências devem ser exatamente 1..5');
  const sum = comps.reduce((s, c) => s + c.score, 0);
  if (sum !== ev.total) errors.push(`total ${ev.total} difere da soma ${sum}`);
  if (ev.zeroed) {
    if (!ev.zero_reason) errors.push('redação zerada exige motivo');
    if (ev.total !== 0) errors.push('redação zerada exige total 0');
  } else if (ev.zero_reason) errors.push('motivo de zero informado sem zerar');
  for (const c of comps) {
    if (!ev.zeroed && c.citations.length === 0) errors.push(`competência ${c.competency} sem trecho citado`);
    const v = verifyCitations(essayText, c.citations);
    if (!v.valid) errors.push(`competência ${c.competency}: citação não encontrada no texto`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: { ...ev, competencies: comps } };
}

export function validatePartialEvaluation(raw: unknown, text: string, competency: number): ValidationResult<PartialEvaluation> {
  const parsed = partialEvaluationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  const errors: string[] = [];
  if (parsed.data.competency !== competency) errors.push('competência avaliada difere da solicitada');
  if (!verifyCitations(text, parsed.data.citations).valid) errors.push('citação não encontrada no texto');
  return errors.length ? { ok: false, errors } : { ok: true, value: parsed.data };
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/**
 * Indicadores de redação (6.9): última, média, máxima e evolução — geral e por competência.
 * Sem contadores adicionais de erros/reescritas.
 */
export function essayIndicators(evals: { total: number; c: [number, number, number, number, number]; at: Date }[]) {
  const sorted = [...evals].sort((a, b) => a.at.getTime() - b.at.getTime());
  if (!sorted.length) return null;
  const mean = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
  const totals = sorted.map((e) => e.total);
  return {
    last: totals.at(-1)!,
    average: mean(totals),
    max: Math.max(...totals),
    evolution: sorted.map((e) => ({ at: e.at.toISOString(), total: e.total })),
    byCompetency: [0, 1, 2, 3, 4].map((i) => {
      const xs = sorted.map((e) => e.c[i]!);
      return { competency: i + 1, last: xs.at(-1)!, average: mean(xs), max: Math.max(...xs) };
    }),
  };
}
