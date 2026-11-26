import { DefaultScheduler, Rating } from 'ts-fsrs';

/**
 * Adaptador FSRS (15.7): estados individuais por cartão, histórico e agendamento.
 * Errei/Difícil/Bom/Fácil → Rating.Again/Hard/Good/Easy. Sem fuzzing para reprodutibilidade.
 * A versão registrada em cada estado permite migração de parâmetros e reprocessamento.
 */
export const FSRS_VERSION = 'ts-fsrs@6.0.1/default';

export type UserRating = 'again' | 'hard' | 'good' | 'easy';
export const RATING_VALUE: Record<UserRating, 1 | 2 | 3 | 4> = { again: 1, hard: 2, good: 3, easy: 4 };

export interface StoredCard {
  stability: number;
  difficulty: number;
  state: number;
  dueAt: string | Date;
  lastReviewAt: string | Date | null;
  reps: number;
  lapses: number;
  scheduledDays: number;
  [k: string]: unknown;
}

type Scheduler = Awaited<ReturnType<typeof DefaultScheduler>>;
let schedulerPromise: Promise<Scheduler> | undefined;
function scheduler(): Promise<Scheduler> {
  schedulerPromise ??= DefaultScheduler({});
  return schedulerPromise;
}

function revive(card: StoredCard): never {
  return {
    ...card,
    dueAt: new Date(card.dueAt),
    lastReviewAt: card.lastReviewAt ? new Date(card.lastReviewAt) : null,
  } as never;
}

export async function newCard(now: Date): Promise<StoredCard> {
  const s = await scheduler();
  return JSON.parse(JSON.stringify(s.newCard({ now }))) as StoredCard;
}

export interface ReviewOutcome {
  card: StoredCard;
  revlog: Record<string, unknown>;
  elapsedDays: number;
  stateBefore: number;
}

export async function reviewCard(card: StoredCard, rating: UserRating, now: Date): Promise<ReviewOutcome> {
  const s = await scheduler();
  const grade = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy }[rating];
  const result = s.review({ card: revive(card), grade, now } as never) as { card: unknown; revlog: unknown };
  const last = card.lastReviewAt ? new Date(card.lastReviewAt).getTime() : null;
  return {
    card: JSON.parse(JSON.stringify(result.card)) as StoredCard,
    revlog: JSON.parse(JSON.stringify(result.revlog)) as Record<string, unknown>,
    elapsedDays: last === null ? 0 : Math.max(0, (now.getTime() - last) / 86_400_000),
    stateBefore: card.state,
  };
}
