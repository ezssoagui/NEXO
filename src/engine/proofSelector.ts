import type { OfficialEnemQuestionRow } from '../../server/repositories/enem';

/**
 * Motor puro de seleção de questão de comprovação pós-erro (FR-025 e FR-026).
 * Prioriza SEMPRE outra questão oficial inédita do ENEM da mesma habilidade H1–H30
 * com dificuldade TRI (tri_b) mais próxima da questão original.
 * Apenas quando não houver nenhuma candidata oficial retorna officialExhausted = true.
 */
export interface ProofSelectionResult {
  question: OfficialEnemQuestionRow | null;
  officialExhausted: boolean;
  selectionReason: 'official_tri_match' | 'official_skill_match' | 'official_exhausted';
}

export function selectProofQuestion(
  candidates: OfficialEnemQuestionRow[],
  targetTriB: number | null,
): ProofSelectionResult {
  const valid = candidates.filter((q) => q.status === 'active' && q.source === 'official_enem');
  if (valid.length === 0) {
    return { question: null, officialExhausted: true, selectionReason: 'official_exhausted' };
  }

  if (targetTriB === null || Number.isNaN(targetTriB)) {
    return { question: valid[0], officialExhausted: false, selectionReason: 'official_skill_match' };
  }

  const withTri = valid.filter((q) => typeof q.triB === 'number' && !Number.isNaN(q.triB));
  if (withTri.length === 0) {
    return { question: valid[0], officialExhausted: false, selectionReason: 'official_skill_match' };
  }

  withTri.sort((a, b) => Math.abs((a.triB as number) - targetTriB) - Math.abs((b.triB as number) - targetTriB));
  return { question: withTri[0], officialExhausted: false, selectionReason: 'official_tri_match' };
}
