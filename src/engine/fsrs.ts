import type { CardRating, CardState } from '../types';

/**
 * REVISÃO DE MEMÓRIA — implementação EXPERIMENTAL do FSRS (equações da versão 4.5, pesos padrão públicos).
 * Não calibrada com dados do estudante. S = estabilidade (dias); D = dificuldade (1–10); R = probabilidade de lembrar.
 */
export const FSRS_LABEL = 'FSRS 4.5 · implementação experimental com pesos padrão';
const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5, FACTOR = 19 / 81, DAY = 86400000;
const clampD = (d: number) => Math.min(10, Math.max(1, d));
const initD = (g: CardRating) => clampD(W[4] - (g - 3) * W[5]);
export const retrievability = (c: CardState | undefined, now = Date.now()) => (c ? Math.pow(1 + (FACTOR * Math.max(0, (now - c.last) / DAY)) / c.s, DECAY) : null);
export const intervalFor = (s: number, target: number) => Math.max(1, Math.min(365, Math.round((s / FACTOR) * (Math.pow(target, 1 / DECAY) - 1))));
export const RATING_LABEL: Record<CardRating, string> = { 1: 'Errei', 2: 'Difícil', 3: 'Bom', 4: 'Fácil' };

export function review(prev: CardState | undefined, g: CardRating, now = Date.now(), target = 0.9): CardState {
  let s: number, d: number;
  if (!prev) { s = W[g - 1]; d = initD(g); } else {
    const r = retrievability(prev, now)!;
    d = clampD(W[7] * initD(3) + (1 - W[7]) * (prev.d - W[6] * (g - 3)));
    s = g === 1
      ? Math.max(0.1, Math.min(prev.s, W[11] * Math.pow(prev.d, -W[12]) * (Math.pow(prev.s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r))))
      : prev.s * (1 + Math.exp(W[8]) * (11 - prev.d) * Math.pow(prev.s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1));
  }
  const days = intervalFor(s, target);
  return { s: +s.toFixed(3), d: +d.toFixed(3), last: now, due: g === 1 ? now + 10 * 60000 : now + days * DAY, reps: (prev?.reps ?? 0) + 1, lapses: (prev?.lapses ?? 0) + (g === 1 ? 1 : 0), reviews: [...(prev?.reviews ?? []).slice(-49), { ts: now, rating: g }] };
}
/** Prévia dos intervalos de cada botão. */
export const preview = (c: CardState | undefined, now = Date.now(), target = 0.9) => ([1, 2, 3, 4] as CardRating[]).map((g) => ({ g, label: g === 1 ? '10 min' : `${Math.round((review(c, g, now, target).due - now) / DAY)} d` }));
export const isDue = (c: CardState | undefined, now = Date.now()) => !!c && c.due <= now;
