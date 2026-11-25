import { z } from 'zod';

/** Esquemas das respostas estruturadas exigidas do modelo. Toda saída é validada antes de chegar ao aluno. */
export const TutorReplySchema = z.object({
  reply: z.string().describe('Resposta ao estudante, em português, curta, com no máximo UMA pergunta orientadora.'),
  diagnosis: z.string().nullable().describe('Dificuldade identificada (ou null).'),
  student_understood: z.boolean().describe('O estudante demonstrou compreensão do ponto em discussão.'),
  uncertain: z.boolean().describe('true se você não tem segurança sobre a resposta e ela precisa de validação.'),
});
export type TutorReply = z.infer<typeof TutorReplySchema>;

const Comp = z.object({
  id: z.enum(['C1', 'C2', 'C3', 'C4', 'C5']),
  score: z.number().int().describe('0, 40, 80, 120, 160 ou 200'),
  justification: z.string(),
  quotes: z.array(z.string()).describe('Trechos copiados LITERALMENTE do texto do estudante que sustentam a avaliação.'),
  problems: z.array(z.string()),
  suggestions: z.array(z.string()),
  exercise: z.string().nullable(),
});
export const EssaySchema = z.object({ competencies: z.array(Comp), general_comment: z.string() });
export type EssayAI = z.infer<typeof EssaySchema>;

export const QuestionSchema = z.object({
  context: z.string(), statement: z.string(),
  alternatives: z.array(z.object({ letter: z.enum(['A', 'B', 'C', 'D', 'E']), text: z.string(), correct: z.boolean(), analysis: z.string() })),
  explanation: z.string(), fast_method: z.string(), hints: z.array(z.string()),
});
export type QuestionAI = z.infer<typeof QuestionSchema>;

export const DiagnoseSchema = z.object({
  cause: z.enum(['conceitual', 'interpretacao', 'calculo', 'formula', 'unidade', 'atencao', 'esquecimento', 'confusao_alternativas', 'lacuna_prerequisito', 'indeterminada']),
  confidence: z.number().describe('0 a 1'),
  quote: z.string().nullable().describe('Trecho literal da justificativa que sustenta a conclusão.'),
});

export const ExplainSchema = z.object({
  criteria: z.array(z.object({ id: z.enum(['correcao', 'completude', 'coerencia', 'relacoes', 'autonomia']), score: z.number().int().describe('0, 1 ou 2'), note: z.string() })),
  found: z.array(z.string()), missing: z.array(z.string()),
  errors: z.array(z.object({ quote: z.string().describe('Trecho LITERAL do estudante.'), why: z.string() })),
});
export type ExplainAI = z.infer<typeof ExplainSchema>;
