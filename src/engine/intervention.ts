import type { Attempt, Confidence, ErrorCause, ErrorType, Evidence, Question, Situation } from '../types';
import { classifyEvidence, isFragile } from './evidence';
import { decide, redecide, type PedagogicalDecision } from './learning';
import { CAUSE_LABELS, INTERVENTION_LABELS } from '../data/skills';

/**
 * Adaptador de compatibilidade: a decisão agora vem do NEXO Learning Engine (learning.ts + diagnosis.ts).
 * Mantém a forma "Hypothesis" usada pelo Ciclo de Domínio e por testes antigos.
 */
export type InterventionKind = 'avancar' | 'explicacao_opcional' | 'cpe' | 'socratico' | 'correcao_etapa' | 'lembrete_breve' | 'perguntar' | 'microaula' | 'aula' | 'dica' | 'reconstrucao' | 'prerequisito';
export interface Hypothesis {
  situation: Situation; evidence: Evidence; intervention: InterventionKind; title: string; rationale: string[]; confidence: number;
  alternatives: Situation[]; fragile: boolean; verifyLater: boolean; step?: 'calculo' | 'formula' | 'unidade' | 'procedimento';
  ask?: { question: string; options: { label: string; situation: Situation }[] }; escalate?: boolean; cause?: ErrorCause; decision?: PedagogicalDecision;
}
export interface ClassifyInput { correct: boolean; confidence: Confidence; hintsUsed: number; justification?: string; chosen: string; timeSec?: number }

export const SITUATION_LABEL: Record<Situation, string> = {
  A: 'Acerto com confiança', B: 'Acerto frágil', C: 'Erro de interpretação', D: 'Erro conceitual', E: 'Erro matemático ou procedimental', F: 'Desatenção', AMB: 'Causa ainda indeterminada',
};
export const AMB_ASK = { question: 'Em uma frase: como você pensou? (ou escolha o que mais se parece)', options: [
  { label: 'Li rápido ou me distraí', situation: 'F' as Situation },
  { label: 'Não sabia (ou confundi) o conceito', situation: 'D' as Situation },
  { label: 'Errei uma conta, fórmula ou unidade', situation: 'E' as Situation },
  { label: 'Fiquei em dúvida entre duas alternativas', situation: 'C' as Situation },
] };
export const causeForSituation = (s: Situation): ErrorCause => ({ C: 'confusao_alternativas', D: 'conceitual', E: 'calculo', F: 'atencao' } as Record<string, ErrorCause>)[s] ?? 'indeterminada';
const KIND: Record<string, InterventionKind> = { nenhuma: 'avancar', A: 'dica', B: 'socratico', C: 'microaula', D: 'aula', E: 'correcao_etapa', F: 'reconstrucao', G: 'prerequisito' };

export function toHypothesis(d: PedagogicalDecision, evidence: Evidence): Hypothesis {
  const kind: InterventionKind = d.cpe ? 'cpe' : d.situation === 'B' && d.intervention === 'E' ? 'explicacao_opcional' : d.situation === 'F' ? 'lembrete_breve' : d.situation === 'AMB' ? 'perguntar' : KIND[d.intervention];
  const c = d.diagnosis.cause;
  return {
    situation: d.situation, evidence, intervention: kind, decision: d, cause: c,
    title: d.situation === 'A' ? 'Correto' : d.situation === 'B' ? (d.diagnosis.outcome === 'acerto_tentativa' ? 'Acertou por tentativa' : d.diagnosis.outcome === 'acerto_raciocinio_incorreto' ? 'Acertou, mas vale revisar o raciocínio' : 'Acertou — registrado como acerto frágil') : c ? CAUSE_LABELS[c].label : SITUATION_LABEL[d.situation],
    rationale: d.diagnosis.evidence.filter((e) => e.source !== 'resposta').map((e) => e.text), confidence: d.diagnosis.confidence,
    alternatives: [], fragile: d.situation === 'B', verifyLater: d.review.needed && d.situation === 'B' && (d.diagnosis.outcome !== 'acerto_duvida' || d.diagnosis.evidence.some((e) => e.source === 'historico')),
    step: c === 'calculo' ? 'calculo' : c === 'unidade' ? 'unidade' : c === 'formula' ? 'formula' : undefined,
    ask: d.diagnosis.needsJustification ? AMB_ASK : undefined, escalate: d.intervention === 'D',
  };
}

export function classifyResponse(q: Question, r: ClassifyInput, history: Attempt[] = []): Hypothesis {
  const d = decide({ q, response: r, history });
  const errorType = r.correct ? undefined : d.diagnosis.errorType;
  return toHypothesis(d, classifyEvidence(q, { ...r, errorType }));
}

/** O aluno corrige a classificação: vira evidência forte (relato do aluno) e a decisão é recalculada. */
export function reclassify(h: Hypothesis, situation: Exclude<Situation, 'AMB'>, q?: Question, r?: ClassifyInput, history: Attempt[] = []): Hypothesis {
  if (q && r) { const d = redecide({ q, response: r, history }, { studentReport: causeForSituation(situation) }); return toHypothesis(d, h.evidence); }
  return { ...h, situation, title: SITUATION_LABEL[situation], confidence: 0.9, ask: undefined };
}

export const errorTypeForSituation = (s: Situation): ErrorType | undefined => ({ C: 'interpretacao', D: 'lacuna_conceitual', E: 'calculo', F: 'desatencao' } as Record<string, ErrorType>)[s];
export { isFragile, INTERVENTION_LABELS };
