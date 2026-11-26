import type { EngineParams, Relevance } from '../mastery/params';

/**
 * Agenda curricular de revisões, independente do FSRS (2.10/5.10/15.7).
 * Escada de intervalos; avança com evidência de retenção satisfatória, reinicia em falha.
 * Qualquer atividade com evidência válida após o vencimento satisfaz a revisão (estudo livre conta).
 * Sem cronograma obrigatório: a agenda só alimenta a prioridade do motor.
 */
export interface ReviewState {
  dueAt: Date;
  intervalDays: number;
  ladderIndex: number;
}

const DAY_MS = 86_400_000;

export function nextReview(input: {
  current: ReviewState | null;
  evidenceScore: number;
  at: Date;
  relevance: Relevance;
  proximityMultiplier: number;
  params: EngineParams;
}): ReviewState & { satisfiedDue: boolean } {
  const { params } = input;
  const ladder = params.reviews.ladderDays;
  const success = input.evidenceScore >= params.reviews.successThreshold;
  const satisfiedDue = input.current !== null && input.at.getTime() >= input.current.dueAt.getTime();
  let idx: number;
  if (!input.current) idx = 0;
  else if (!success) idx = 0;
  else if (satisfiedDue) idx = Math.min(input.current.ladderIndex + 1, ladder.length - 1);
  else idx = input.current.ladderIndex; // evidência antes do vencimento não acelera a escada
  const factor = params.reviews.relevanceFactor[input.relevance] / Math.max(1, input.proximityMultiplier);
  const intervalDays = Math.max(0.5, Math.round(ladder[idx]! * factor * 100) / 100);
  return { dueAt: new Date(input.at.getTime() + intervalDays * DAY_MS), intervalDays, ladderIndex: idx, satisfiedDue };
}

/** Atraso relativo (0 = no prazo; 1 = um intervalo inteiro de atraso). */
export function overdueRatio(state: ReviewState, now: Date): number {
  const late = (now.getTime() - state.dueAt.getTime()) / DAY_MS;
  if (late < 0) return -1;
  return late / Math.max(0.5, state.intervalDays);
}
