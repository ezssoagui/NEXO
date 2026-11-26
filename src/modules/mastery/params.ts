import { z } from 'zod';

/** Parâmetros versionados do motor (engine_parameter_sets.params). Experimentais (2.15/8.10). */
const level = z.object({ easy: z.number().int().min(0), medium: z.number().int().min(0), hard: z.number().int().min(0) });
const rel = <T extends z.ZodTypeAny>(t: T) => z.object({ low: t, medium: t, high: t, unknown: t });

export const engineParamsSchema = z.object({
  mastery: z.object({
    weights: z.object({ resolution: z.number(), comprehension: z.number(), transfer: z.number(), retention: z.number() }),
    difficultyWeights: z.object({ easy: z.number(), medium: z.number(), hard: z.number() }),
    thresholds: z.object({ provisional: z.number(), consolidated: z.number() }),
    minEvidence: rel(level),
    temporalWeights: z.array(z.object({ maxDays: z.number().nullable(), weight: z.number() })).min(1),
    independenceFactors: z.object({ independent: z.number(), assisted: z.number(), repeated: z.number() }),
    retentionMinIntervalDays: z.number().positive(),
    consolidationRequires: z.object({ retention: z.boolean(), comprehensionOrTransfer: z.boolean() }),
  }),
  priority: z.object({
    weights: z.object({ difficulty: z.number(), relevance: z.number(), review: z.number(), coverage: z.number(), connections: z.number() }),
    relevanceScore: rel(z.number()),
    unknownDifficultyPrior: z.number().min(0).max(1),
    proximity: z.array(z.object({ maxDays: z.number(), reviewMultiplier: z.number() })),
    recoveryPattern: z.object({ window: z.number().int().positive(), minErrors: z.number().int().positive() }),
  }),
  sessionQuantity: z.object({
    very_high: z.object({ low: z.number(), medium: z.number(), high: z.number() }),
    high: z.object({ low: z.number(), medium: z.number(), high: z.number() }),
    moderate: z.object({ low: z.number(), medium: z.number(), high: z.number() }),
    punctual: z.object({ low: z.number(), medium: z.number(), high: z.number() }),
    maintenance: z.object({ low: z.number(), medium: z.number(), high: z.number() }),
    maxQuestionsPerSession: z.number().int().positive(),
  }),
  reviews: z.object({
    ladderDays: z.array(z.number().positive()).min(1),
    successThreshold: z.number(),
    relevanceFactor: rel(z.number().positive()),
  }),
});

export type EngineParams = z.infer<typeof engineParamsSchema>;
export type Relevance = 'low' | 'medium' | 'high' | 'unknown';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Dimension = 'resolution' | 'comprehension' | 'transfer' | 'retention';

/** Valores do Documento Mestre usados como padrão em testes (espelham a migração engine-0.1.0). */
export const DEFAULT_ENGINE_PARAMS: EngineParams = {
  mastery: {
    weights: { resolution: 0.5, comprehension: 0.25, transfer: 0.15, retention: 0.1 },
    difficultyWeights: { easy: 0.5, medium: 0.35, hard: 0.15 },
    thresholds: { provisional: 70, consolidated: 85 },
    minEvidence: {
      low: { easy: 3, medium: 1, hard: 1 },
      medium: { easy: 5, medium: 3, hard: 2 },
      high: { easy: 8, medium: 4, hard: 3 },
      unknown: { easy: 5, medium: 3, hard: 2 },
    },
    temporalWeights: [
      { maxDays: 15, weight: 1 },
      { maxDays: 30, weight: 0.75 },
      { maxDays: 60, weight: 0.5 },
      { maxDays: null, weight: 0.25 },
    ],
    independenceFactors: { independent: 1, assisted: 0.5, repeated: 0.25 },
    retentionMinIntervalDays: 7,
    consolidationRequires: { retention: true, comprehensionOrTransfer: true },
  },
  priority: {
    weights: { difficulty: 0.3, relevance: 0.25, review: 0.2, coverage: 0.15, connections: 0.1 },
    relevanceScore: { high: 1, medium: 0.6, low: 0.3, unknown: 0.5 },
    unknownDifficultyPrior: 0.5,
    proximity: [
      { maxDays: 7, reviewMultiplier: 1.75 },
      { maxDays: 30, reviewMultiplier: 1.5 },
      { maxDays: 90, reviewMultiplier: 1.25 },
    ],
    recoveryPattern: { window: 10, minErrors: 5 },
  },
  sessionQuantity: {
    very_high: { low: 5, medium: 10, high: 15 },
    high: { low: 4, medium: 7, high: 12 },
    moderate: { low: 3, medium: 5, high: 10 },
    punctual: { low: 2, medium: 4, high: 6 },
    maintenance: { low: 1, medium: 2, high: 3 },
    maxQuestionsPerSession: 15,
  },
  reviews: {
    ladderDays: [1, 3, 7, 14, 30, 60, 120],
    successThreshold: 70,
    relevanceFactor: { high: 0.8, medium: 1, low: 1.2, unknown: 1 },
  },
};
