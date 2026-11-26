import type { Difficulty, Dimension, EngineParams, Relevance } from './params';

/**
 * Cálculo de domínio por habilidade — funções puras (15.6).
 *
 * D = 0,50R + 0,25C + 0,15T + 0,10M (8.2), dimensões 0–100.
 * R ponderada por dificuldade fácil/média/difícil = 50/35/15 (8.3).
 *
 * Regras formalizadas (propostas técnicas reversíveis, ADR-007; A.2 exige calibração):
 *  - Ausência de evidência NÃO é zero: dimensões/faixas sem evidência ficam nulas e seus
 *    pesos são redistribuídos proporcionalmente entre as disponíveis (8.2/8.3).
 *  - Peso temporal (8.5) é calculado em relação à evidência MAIS RECENTE da habilidade,
 *    não ao relógio: a inatividade nunca reduz o domínio (4.7/A.1).
 *  - Repetição/assistência valem menos que aplicação independente (2.14).
 *  - Estados (8.6): provisório e consolidado exigem mínimos de evidência por relevância (8.4),
 *    ajustados à disponibilidade real de itens; consolidado exige ainda evidência de retenção
 *    e de compreensão ou transferência (configurável).
 */
export interface Evidence {
  dimension: Dimension;
  score: number; // 0..100
  difficulty: Difficulty | null;
  independence: 'independent' | 'assisted' | 'repeated';
  itemKey: string;
  occurredAt: Date;
}

export type MasteryState = 'not_assessed' | 'learning' | 'provisional' | 'consolidated';

export interface MasteryResult {
  r: number | null;
  c: number | null;
  t: number | null;
  m: number | null;
  d: number | null;
  state: MasteryState;
  evidenceCount: number;
  details: {
    resolutionByDifficulty: Record<Difficulty, { accuracy: number | null; independentCount: number }>;
    minEvidence: Record<Difficulty, number>;
    minEvidenceMet: boolean;
    missingDimensions: Dimension[];
    stateReason: string;
    referenceTime: string | null;
  };
}

const DAY_MS = 86_400_000;

export function temporalWeight(ageDays: number, params: EngineParams): number {
  for (const band of params.mastery.temporalWeights) {
    if (band.maxDays === null || ageDays <= band.maxDays) return band.weight;
  }
  return params.mastery.temporalWeights.at(-1)!.weight;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function weightedMean(items: { value: number; weight: number }[]): number | null {
  const total = items.reduce((s, i) => s + i.weight, 0);
  if (total <= 0) return null;
  return items.reduce((s, i) => s + i.value * i.weight, 0) / total;
}

/** Média ponderada das dimensões disponíveis, redistribuindo pesos das ausentes. */
export function combineDimensions(
  dims: Record<Dimension, number | null>,
  weights: EngineParams['mastery']['weights'],
): number | null {
  const parts = (Object.keys(weights) as Dimension[])
    .filter((k) => dims[k] !== null)
    .map((k) => ({ value: dims[k]!, weight: weights[k] }));
  const v = weightedMean(parts);
  return v === null ? null : round2(v);
}

export function computeMastery(
  evidence: Evidence[],
  params: EngineParams,
  relevance: Relevance,
  availableItems?: Partial<Record<Difficulty, number>>,
): MasteryResult {
  const p = params.mastery;
  const baseMin = p.minEvidence[relevance];
  // Mínimos ajustados à disponibilidade real de itens (8.4).
  const minEvidence: Record<Difficulty, number> = {
    easy: Math.min(baseMin.easy, availableItems?.easy ?? Infinity),
    medium: Math.min(baseMin.medium, availableItems?.medium ?? Infinity),
    hard: Math.min(baseMin.hard, availableItems?.hard ?? Infinity),
  };

  const empty: MasteryResult = {
    r: null, c: null, t: null, m: null, d: null, state: 'not_assessed', evidenceCount: 0,
    details: {
      resolutionByDifficulty: {
        easy: { accuracy: null, independentCount: 0 },
        medium: { accuracy: null, independentCount: 0 },
        hard: { accuracy: null, independentCount: 0 },
      },
      minEvidence, minEvidenceMet: false,
      missingDimensions: ['resolution', 'comprehension', 'transfer', 'retention'],
      stateReason: 'Sem evidências registradas.', referenceTime: null,
    },
  };
  if (evidence.length === 0) return empty;

  const refTime = Math.max(...evidence.map((e) => e.occurredAt.getTime()));
  const w = (e: Evidence) =>
    temporalWeight(Math.max(0, (refTime - e.occurredAt.getTime()) / DAY_MS), params) * p.independenceFactors[e.independence];

  // Resolução por faixa de dificuldade.
  const byDiff: MasteryResult['details']['resolutionByDifficulty'] = {
    easy: { accuracy: null, independentCount: 0 },
    medium: { accuracy: null, independentCount: 0 },
    hard: { accuracy: null, independentCount: 0 },
  };
  const resolution = evidence.filter((e) => e.dimension === 'resolution');
  for (const d of ['easy', 'medium', 'hard'] as const) {
    const items = resolution.filter((e) => (e.difficulty ?? 'medium') === d);
    const acc = weightedMean(items.map((e) => ({ value: e.score, weight: w(e) })));
    // Conta itens distintos independentes (repetição não infla mínimos — 8.1).
    const distinct = new Set(items.filter((e) => e.independence === 'independent').map((e) => e.itemKey));
    byDiff[d] = { accuracy: acc === null ? null : round2(acc), independentCount: distinct.size };
  }
  const rParts = (['easy', 'medium', 'hard'] as const)
    .filter((d) => byDiff[d].accuracy !== null)
    .map((d) => ({ value: byDiff[d].accuracy!, weight: p.difficultyWeights[d] }));
  const rRaw = weightedMean(rParts);
  const r = rRaw === null ? null : round2(rRaw);

  const dimMean = (dim: Dimension) => {
    const v = weightedMean(evidence.filter((e) => e.dimension === dim).map((e) => ({ value: e.score, weight: w(e) })));
    return v === null ? null : round2(v);
  };
  const c = dimMean('comprehension');
  const t = dimMean('transfer');
  const m = dimMean('retention');
  const dims = { resolution: r, comprehension: c, transfer: t, retention: m };
  const d = combineDimensions(dims, p.weights);
  const missingDimensions = (Object.keys(dims) as Dimension[]).filter((k) => dims[k] === null);

  const minEvidenceMet = (['easy', 'medium', 'hard'] as const).every((k) => byDiff[k].independentCount >= minEvidence[k]);

  let state: MasteryState = 'learning';
  let stateReason: string;
  if (r === null || d === null) {
    stateReason = 'Há evidências, mas ainda sem resolução de questões suficiente para estimar o domínio.';
  } else if (!minEvidenceMet) {
    stateReason = 'Evidências abaixo do mínimo por relevância e dificuldade; domínio ainda não estimável com segurança.';
  } else if (d < p.thresholds.provisional) {
    stateReason = `Índice ${d} abaixo do limiar provisório (${p.thresholds.provisional}).`;
  } else {
    const needsRetention = p.consolidationRequires.retention && m === null;
    const needsCT = p.consolidationRequires.comprehensionOrTransfer && c === null && t === null;
    if (d >= p.thresholds.consolidated && !needsRetention && !needsCT) {
      state = 'consolidated';
      stateReason = `Índice ${d} ≥ ${p.thresholds.consolidated} com evidências mínimas, retenção e compreensão/transferência.`;
    } else {
      state = 'provisional';
      const missing: string[] = [];
      if (d < p.thresholds.consolidated) missing.push(`índice abaixo de ${p.thresholds.consolidated}`);
      if (needsRetention) missing.push('falta evidência de retenção');
      if (needsCT) missing.push('falta evidência de compreensão ou transferência');
      stateReason = `Provisório: ${missing.join('; ')}.`;
    }
  }

  return {
    r, c, t, m, d, state, evidenceCount: evidence.length,
    details: {
      resolutionByDifficulty: byDiff, minEvidence, minEvidenceMet, missingDimensions, stateReason,
      referenceTime: new Date(refTime).toISOString(),
    },
  };
}

/** Indicadores curriculares (8.7): cobertura e domínio curricular com peso visual igual. */
export function curricularIndicators(states: MasteryState[]): {
  eligible: number; assessed: number; consolidated: number; coverage: number | null; curricularMastery: number | null;
} {
  const eligible = states.length;
  const assessed = states.filter((s) => s !== 'not_assessed').length;
  const consolidated = states.filter((s) => s === 'consolidated').length;
  return {
    eligible, assessed, consolidated,
    coverage: eligible === 0 ? null : round2((assessed / eligible) * 100),
    curricularMastery: eligible === 0 ? null : round2((consolidated / eligible) * 100),
  };
}
