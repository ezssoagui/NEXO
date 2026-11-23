import type { Confidence, ErrorType, Evidence, Question } from '../types';
import { readJustification } from './concepts';

/**
 * Lê uma resposta e infere a EVIDÊNCIA pedagógica que ela fornece.
 * É uma hipótese: confiança declarada não prova domínio e dúvida não prova desconhecimento.
 */
export interface ResponseInput { correct: boolean; confidence: Confidence; hintsUsed: number; justification?: string; errorType?: ErrorType }

const ELIMINATION = /elimin|descart|sobrou|por exclus[aã]o|as outras (estavam|eram) erradas/i;

export function classifyEvidence(q: Question, r: ResponseInput): Evidence {
  if (r.confidence === 'nao_consegui') return 'nao_resolveu';
  const j = readJustification(q.skillId, r.justification ?? '');
  if (r.correct) {
    if (r.confidence === 'chute') return 'acerto_chute';
    if (j.wrong) return 'acerto_raciocinio_incorreto';
    if (r.hintsUsed >= 2) return 'acerto_com_dicas';
    if (ELIMINATION.test(r.justification ?? '')) return 'acerto_eliminacao';
    if (j.shown.length >= 1 && r.confidence === 'certeza') return 'compreensao_demonstrada';
    if (r.confidence === 'certeza') return 'confianca_declarada';
    if (r.confidence === 'nao_informada') return j.shown.length >= 1 ? 'compreensao_demonstrada' : 'acerto_sem_confianca';
    return j.shown.length >= 2 ? 'compreensao_demonstrada' : 'acerto_duvida';
  }
  switch (r.errorType) {
    case 'interpretacao': case 'alternativas_plausiveis': return 'erro_interpretativo';
    case 'formula_incorreta': case 'calculo': case 'unidades': return 'erro_procedimental';
    case 'desatencao': return 'erro_desatencao';
    default: return 'erro_conceitual';
  }
}

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  compreensao_demonstrada: 'Acerto com compreensão demonstrada',
  confianca_declarada: 'Acerto com confiança declarada',
  acerto_duvida: 'Acerto com dúvida',
  acerto_com_dicas: 'Acerto após dicas',
  acerto_eliminacao: 'Acerto por eliminação parcial',
  acerto_raciocinio_incorreto: 'Acerto com raciocínio incorreto identificado',
  acerto_chute: 'Acerto por tentativa (chute)',
  acerto_sem_confianca: 'Acerto (confiança não informada)',
  erro_conceitual: 'Erro conceitual',
  erro_interpretativo: 'Erro interpretativo',
  erro_procedimental: 'Erro procedimental',
  erro_desatencao: 'Erro por desatenção',
  nao_resolveu: 'Não conseguiu resolver',
};

/** Peso de cada evidência no Radar de Domínio (0–1). */
export const EVIDENCE_WEIGHT: Record<Evidence, number> = {
  compreensao_demonstrada: 1, confianca_declarada: 0.85, acerto_duvida: 0.6, acerto_eliminacao: 0.55, acerto_com_dicas: 0.45,
  acerto_raciocinio_incorreto: 0.25, acerto_chute: 0, acerto_sem_confianca: 0.75, erro_conceitual: 0, erro_interpretativo: 0, erro_procedimental: 0.1, erro_desatencao: 0.2, nao_resolveu: 0,
};

export const isFragile = (e?: Evidence) => e === 'acerto_duvida' || e === 'acerto_eliminacao' || e === 'acerto_com_dicas' || e === 'acerto_raciocinio_incorreto' || e === 'acerto_chute';
