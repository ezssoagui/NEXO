import { useMemo } from 'react';
import { FLASHCARDS } from '../data/flashcards';
import { allDomains } from '../engine/domain';
import { indicators } from '../engine/indicators';
import { recommend, type RecInput } from '../engine/recommender';
import { useStore } from './useStore';

/** Derivações memorizadas do estado (o armazenamento guarda só fatos). */
export function useDomains() {
  const attempts = useStore((s) => s.attempts); const explanations = useStore((s) => s.explanations); const params = useStore((s) => s.params);
  return useMemo(() => allDomains({ attempts, explanations }, params), [attempts, explanations, params]);
}
export function useIndicators() {
  const domains = useDomains(); const attempts = useStore((s) => s.attempts); const explanations = useStore((s) => s.explanations); const params = useStore((s) => s.params);
  return useMemo(() => indicators({ attempts, explanations }, domains, params), [attempts, explanations, domains, params]);
}
export function useAllCards() { const custom = useStore((s) => s.customCards); return useMemo(() => [...FLASHCARDS, ...custom], [custom]); }
export function useRecInput(): RecInput {
  const s = useStore(); const cards = useAllCards(); const domains = useDomains();
  return { attempts: s.attempts, explanations: s.explanations, skillReviews: s.skillReviews, cards, cardStates: s.cardStates, essays: s.essays, essayPractice: s.essayPractice, pendings: s.pendings, examYear: s.profile?.examYear, params: s.params, domains };
}
export function useRecommendations(limit = 6) {
  const x = useRecInput();
  return useMemo(() => recommend(x, limit), [x.attempts, x.explanations, x.skillReviews, x.cardStates, x.essays, x.essayPractice, x.pendings, x.domains, x.examYear, limit]); // eslint-disable-line react-hooks/exhaustive-deps
}
