import { describe, expect, it } from 'vitest';
import { selectProofQuestion } from '../../src/engine/proofSelector';
import type { OfficialEnemQuestionRow } from '../../server/repositories/enem';

function makeQ(id: string, triB: number | null, status: 'active' | 'annulled' = 'active'): OfficialEnemQuestionRow {
  return {
    id,
    year: 2023,
    questionIndex: 1,
    bookletColor: 'AZUL',
    area: 'MT',
    discipline: 'matematica',
    language: null,
    skillId: 'MT-H19',
    inepItemCode: 100,
    triA: 1.2,
    triB,
    triC: 0.2,
    contextMd: 'Contexto',
    alternativesIntro: 'Pergunta',
    alternatives: [],
    correctAlternative: 'A',
    assets: [],
    status,
    source: 'official_enem',
  };
}

describe('US2: Seletor de comprovação pós-erro (oficial primário por H1–H30 + TRI)', () => {
  it('seleciona a questão oficial ativa com tri_b mais próximo e ignora anuladas', () => {
    const candidates = [makeQ('q-far', 2.4), makeQ('q-annulled', 0.5, 'annulled'), makeQ('q-best', 0.62), makeQ('q-mid', -0.8)];
    const res = selectProofQuestion(candidates, 0.55);
    expect(res.officialExhausted).toBe(false);
    expect(res.selectionReason).toBe('official_tri_match');
    expect(res.question?.id).toBe('q-best');
  });

  it('sinaliza officialExhausted quando todas as oficiais ativas foram esgotadas', () => {
    const res = selectProofQuestion([makeQ('q-only-annulled', 0.5, 'annulled')], 0.5);
    expect(res.officialExhausted).toBe(true);
    expect(res.question).toBeNull();
    expect(res.selectionReason).toBe('official_exhausted');
  });
});
