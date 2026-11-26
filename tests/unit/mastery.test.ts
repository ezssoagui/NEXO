import { describe, expect, it } from 'vitest';
import { combineDimensions, computeMastery, curricularIndicators, temporalWeight, type Evidence } from '@/modules/mastery/compute';
import { DEFAULT_ENGINE_PARAMS as P } from '@/modules/mastery/params';
import { deriveFlashcardEvidence, deriveQuestionEvidence, rubricToScore } from '@/modules/mastery/evidence';

const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n, 12));
let k = 0;
const ev = (dimension: Evidence['dimension'], score: number, difficulty: Evidence['difficulty'], at = day(0), independence: Evidence['independence'] = 'independent'): Evidence =>
  ({ dimension, score, difficulty, independence, itemKey: `i${k++}`, occurredAt: at });
const many = (n: number, score: number, difficulty: Evidence['difficulty'], at = day(0)) => Array.from({ length: n }, () => ev('resolution', score, difficulty, at));

describe('índice ponderado D (8.2/15.6)', () => {
  it('exemplo do mestre: R=80, C=70, T=65, M=75 → D=74,75', () => {
    expect(combineDimensions({ resolution: 80, comprehension: 70, transfer: 65, retention: 75 }, P.mastery.weights)).toBe(74.75);
  });
  it('ausência de dimensão não é zero: redistribui pesos', () => {
    expect(combineDimensions({ resolution: 80, comprehension: null, transfer: null, retention: null }, P.mastery.weights)).toBe(80);
    expect(combineDimensions({ resolution: 80, comprehension: 60, transfer: null, retention: null }, P.mastery.weights)).toBe(73.33);
  });
  it('sem nenhuma evidência: não avaliado e D nulo', () => {
    const r = computeMastery([], P, 'high');
    expect(r.state).toBe('not_assessed');
    expect(r.d).toBeNull();
  });
});

describe('resolução ponderada por dificuldade 50/35/15 (8.3)', () => {
  it('pondera faixas e não trata faixa ausente como erro', () => {
    const r = computeMastery([...many(2, 100, 'easy'), ...many(2, 0, 'hard')], P, 'low');
    // easy 100·0,5 + hard 0·0,15, normalizado por 0,65 → 76,92
    expect(r.r).toBe(76.92);
    expect(r.details.resolutionByDifficulty.medium.accuracy).toBeNull();
  });
});

describe('estados e mínimos de evidência (8.4/8.6)', () => {
  it('acertos acima do limiar sem mínimo de evidência → em aprendizagem', () => {
    const r = computeMastery(many(3, 100, 'easy'), P, 'high');
    expect(r.state).toBe('learning');
    expect(r.details.minEvidenceMet).toBe(false);
  });
  it('mínimo atendido e D≥70 sem retenção → provisório (nunca consolidado)', () => {
    const r = computeMastery([...many(8, 100, 'easy'), ...many(4, 100, 'medium'), ...many(3, 100, 'hard')], P, 'high');
    expect(r.d).toBe(100);
    expect(r.state).toBe('provisional');
  });
  it('consolidado exige D≥85 + retenção + compreensão ou transferência', () => {
    const base = [...many(5, 100, 'easy'), ...many(3, 100, 'medium'), ...many(2, 100, 'hard')];
    const r = computeMastery([...base, ev('comprehension', 100, null), ev('retention', 100, 'medium', day(8))], P, 'medium');
    expect(r.state).toBe('consolidated');
  });
  it('nova evidência negativa pode rebaixar o estado', () => {
    const base = [...many(5, 100, 'easy'), ...many(3, 100, 'medium'), ...many(2, 100, 'hard'), ev('comprehension', 100, null), ev('retention', 100, 'medium', day(8))];
    const after = [...base, ...Array.from({ length: 10 }, () => ev('resolution', 0, 'medium', day(9))), ev('retention', 0, 'medium', day(20))];
    const r = computeMastery(after, P, 'medium');
    expect(r.state === 'learning' || r.state === 'provisional').toBe(true);
    expect(r.d!).toBeLessThan(85);
  });
  it('repetições do mesmo item não inflam os mínimos', () => {
    const rep = Array.from({ length: 20 }, () => ({ ...ev('resolution', 100, 'easy'), itemKey: 'mesmo', independence: 'repeated' as const }));
    expect(computeMastery(rep, P, 'low').details.minEvidenceMet).toBe(false);
  });
  it('mínimos ajustados à disponibilidade real de itens', () => {
    const r = computeMastery([...many(3, 100, 'easy'), ...many(1, 100, 'medium')], P, 'low', { hard: 0 });
    expect(r.details.minEvidence.hard).toBe(0);
    expect(r.details.minEvidenceMet).toBe(true);
  });
});

describe('peso temporal sem penalidade por inatividade (8.5/4.7)', () => {
  it('faixas 15/30/60', () => {
    expect([temporalWeight(10, P), temporalWeight(20, P), temporalWeight(45, P), temporalWeight(90, P)]).toEqual([1, 0.75, 0.5, 0.25]);
  });
  it('domínio idêntico independentemente do tempo decorrido desde a última evidência', () => {
    const e = [...many(5, 100, 'easy', day(0)), ...many(3, 80, 'medium', day(1))];
    const a = computeMastery(e, P, 'medium');
    const b = computeMastery(e, P, 'medium'); // nenhuma dependência do relógio
    expect(a).toEqual(b);
  });
  it('evidência antiga pesa menos quando há evidência nova', () => {
    const r = computeMastery([ev('resolution', 0, 'easy', day(0)), ev('resolution', 100, 'easy', day(100))], P, 'low');
    expect(r.r).toBe(80); // 100·1 + 0·0,25 / 1,25
  });
});

describe('indicadores curriculares (8.7)', () => {
  it('cobertura e domínio curricular separados', () => {
    expect(curricularIndicators(['not_assessed', 'learning', 'provisional', 'consolidated'])).toMatchObject({ coverage: 75, curricularMastery: 25 });
  });
});

describe('derivação de evidências (2.14/A.3.1)', () => {
  const hist = { firstEvidenceAt: day(0), lastEvidenceAt: day(0) };
  it('primeira exposição em dia posterior → resolução + transferência', () => {
    const out = deriveQuestionEvidence({ skillId: 's', itemKey: 'q1', isCorrect: true, difficulty: 'medium', isFirstExposure: true, history: hist, at: day(2), params: P });
    expect(out.map((o) => o.dimension).sort()).toEqual(['resolution', 'transfer']);
  });
  it('repetição do mesmo item não gera transferência', () => {
    const out = deriveQuestionEvidence({ skillId: 's', itemKey: 'q1', isCorrect: true, difficulty: 'medium', isFirstExposure: false, history: hist, at: day(2), params: P });
    expect(out.map((o) => o.dimension)).toEqual(['resolution']);
    expect(out[0]!.independence).toBe('repeated');
  });
  it('após 7 dias gera retenção', () => {
    const out = deriveQuestionEvidence({ skillId: 's', itemKey: 'q2', isCorrect: true, difficulty: 'easy', isFirstExposure: true, history: hist, at: day(8), params: P });
    expect(out.map((o) => o.dimension)).toContain('retention');
  });
  it('primeira evidência da habilidade: só resolução', () => {
    const out = deriveQuestionEvidence({ skillId: 's', itemKey: 'q', isCorrect: false, difficulty: 'easy', isFirstExposure: true, history: { firstEvidenceAt: null, lastEvidenceAt: null }, at: day(0), params: P });
    expect(out).toHaveLength(1);
  });
  it('rubrica 0–3 e flashcard só retenção após intervalo', () => {
    expect(rubricToScore(3)).toBe(100);
    expect(deriveFlashcardEvidence({ skillId: 's', cardId: 'c', rating: 3, elapsedDaysSinceLastReview: 2, params: P })).toEqual([]);
    expect(deriveFlashcardEvidence({ skillId: 's', cardId: 'c', rating: 3, elapsedDaysSinceLastReview: 9, params: P })[0]!.dimension).toBe('retention');
  });
});
