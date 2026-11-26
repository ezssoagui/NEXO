import type { Difficulty, EngineParams, Relevance } from '../mastery/params';
import type { Category, DifficultyLevel, Focus } from './priority';

/**
 * Composição de sessão antes do início (4.4/4.5/5.8). Uma sessão pode ter uma única atividade.
 * Componentes combináveis, nunca sequência obrigatória (2.3/15.5). Função pura: recebe
 * candidatos disponíveis e devolve o plano a ser congelado.
 */
export interface Candidates {
  questions: { id: string; difficulty: Difficulty | null; seen: boolean }[];
  lessons: { id: string; kind: 'lesson' | 'microlesson' | 'summary' | 'worked_example' | 'visual'; accessible: boolean }[];
  conceptActivities: { id: string; answered: boolean }[];
  flashcardsDue: number;
}

export interface PlannedActivity {
  activityType: 'lesson' | 'question' | 'concept_activity' | 'flashcards' | 'summary';
  refType: 'lesson' | 'question' | 'concept_activity' | 'subtopic';
  refId: string | null;
  meta?: Record<string, unknown>;
}

export interface SessionPlan {
  focus: Focus;
  category: Category;
  level: DifficultyLevel;
  targetQuestions: number;
  activities: PlannedActivity[];
  shortfall: { questions: number; note: string | null };
  alternatives: string[];
}

const DIST: Record<Focus, Partial<Record<Difficulty, number>>> = {
  exploration: { easy: 0.5, medium: 0.35, hard: 0.15 },
  fundamentals: { easy: 0.7, medium: 0.3 },
  comprehension: { medium: 0.6, easy: 0.4 },
  practice: { easy: 0.4, medium: 0.4, hard: 0.2 },
  recovery: { easy: 0.5, medium: 0.4, hard: 0.1 },
  transfer: { medium: 0.5, hard: 0.5 },
  retention: { easy: 0.3, medium: 0.4, hard: 0.3 },
  maintenance: { medium: 0.3, hard: 0.7 },
};

export function questionQuantity(level: DifficultyLevel, relevance: Relevance, focus: Focus, params: EngineParams): number {
  const rel = relevance === 'unknown' ? 'medium' : relevance;
  let n = params.sessionQuantity[level][rel];
  if (focus === 'comprehension') n = Math.min(n, 3);
  return Math.max(0, Math.min(n, params.sessionQuantity.maxQuestionsPerSession));
}

/** Distribui n entre faixas pela proporção (maiores restos), determinístico. */
export function splitByDifficulty(n: number, dist: Partial<Record<Difficulty, number>>): Record<Difficulty, number> {
  const keys: Difficulty[] = ['easy', 'medium', 'hard'];
  const raw = keys.map((k) => ({ k, v: (dist[k] ?? 0) * n }));
  const out: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  let used = 0;
  for (const r of raw) { out[r.k] = Math.floor(r.v); used += out[r.k]; }
  const order = [...raw].sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)) || keys.indexOf(a.k) - keys.indexOf(b.k));
  for (let i = 0; used < n && i < order.length * 2; i++) {
    const r = order[i % order.length]!;
    if ((dist[r.k] ?? 0) > 0) { out[r.k]++; used++; }
  }
  return out;
}

export function selectQuestions(cands: Candidates['questions'], n: number, focus: Focus): { ids: string[]; shortfall: number } {
  const unseen = cands.filter((q) => !q.seen);
  const target = splitByDifficulty(n, DIST[focus]);
  const picked: string[] = [];
  const pool = new Map<Difficulty, typeof unseen>();
  for (const d of ['easy', 'medium', 'hard'] as const) pool.set(d, unseen.filter((q) => (q.difficulty ?? 'medium') === d));
  for (const d of ['easy', 'medium', 'hard'] as const) {
    const list = pool.get(d)!;
    while (target[d] > 0 && list.length) { picked.push(list.shift()!.id); target[d]--; }
  }
  // Completar com faixas vizinhas inéditas (nunca repetir item para transferência — 2.12).
  const rest = [...pool.get('medium')!, ...pool.get('easy')!, ...pool.get('hard')!];
  while (picked.length < n && rest.length) picked.push(rest.shift()!.id);
  return { ids: picked, shortfall: Math.max(0, n - picked.length) };
}

export function planSession(input: {
  focus: Focus;
  category: Category;
  level: DifficultyLevel;
  relevance: Relevance;
  subtopicId: string;
  /** Média de compreensão conhecida (C). Teoria é omitida quando já há compreensão suficiente (4.4). */
  comprehension: number | null;
  candidates: Candidates;
  params: EngineParams;
}): SessionPlan {
  const { focus, candidates } = input;
  const n = questionQuantity(input.level, input.relevance, focus, input.params);
  const comprehended = input.comprehension !== null && input.comprehension >= 70;
  const accessibleLessons = candidates.lessons.filter((l) => l.accessible);
  const pickLesson = (prefer: string[]) => {
    for (const kind of prefer) {
      const l = accessibleLessons.find((x) => x.kind === kind);
      if (l) return l;
    }
    return undefined;
  };

  const theoryKinds: Partial<Record<Focus, string[]>> = {
    exploration: ['microlesson', 'lesson', 'summary'],
    fundamentals: ['lesson', 'microlesson', 'worked_example'],
    comprehension: ['lesson', 'worked_example', 'microlesson'],
    recovery: ['microlesson', 'worked_example', 'summary', 'lesson'],
  };
  const theory = !comprehended && theoryKinds[focus] ? pickLesson(theoryKinds[focus]!) : undefined;
  const concept =
    ['exploration', 'comprehension', 'recovery', 'fundamentals'].includes(focus) && !(input.comprehension !== null && input.comprehension >= 85)
      ? candidates.conceptActivities.find((c) => !c.answered) ?? candidates.conceptActivities[0]
      : undefined;
  const { ids, shortfall } = selectQuestions(candidates.questions, n, focus);

  const lessonAct: PlannedActivity[] = theory ? [{ activityType: 'lesson', refType: 'lesson', refId: theory.id, meta: { kind: theory.kind } }] : [];
  const conceptAct: PlannedActivity[] = concept ? [{ activityType: 'concept_activity', refType: 'concept_activity', refId: concept.id }] : [];
  const questionActs: PlannedActivity[] = ids.map((id) => ({ activityType: 'question', refType: 'question', refId: id }));
  const flashAct: PlannedActivity[] =
    (focus === 'retention' || focus === 'maintenance') && candidates.flashcardsDue > 0
      ? [{ activityType: 'flashcards', refType: 'subtopic', refId: input.subtopicId, meta: { count: Math.min(candidates.flashcardsDue, 20) } }]
      : [];
  const summary = focus === 'retention' ? pickLesson(['summary']) : undefined;
  const summaryAct: PlannedActivity[] = summary ? [{ activityType: 'summary', refType: 'lesson', refId: summary.id }] : [];

  let activities: PlannedActivity[];
  switch (focus) {
    case 'retention':
    case 'maintenance':
      // Recuperação ativa antes de consultar teoria (2.10).
      activities = [...flashAct, ...questionActs, ...summaryAct];
      break;
    case 'comprehension':
      activities = [...lessonAct, ...conceptAct, ...questionActs];
      break;
    case 'recovery':
      activities = [...lessonAct, ...questionActs, ...conceptAct];
      break;
    default:
      activities = [...lessonAct, ...questionActs, ...conceptAct];
  }

  const alternatives: string[] = [];
  let note: string | null = null;
  if (shortfall > 0) {
    note = `Há ${shortfall} questão(ões) oficial(is) inédita(s) a menos que o indicado para este conteúdo.`;
    if (candidates.flashcardsDue > 0) alternatives.push('flashcards');
    if (candidates.conceptActivities.length) alternatives.push('concept_activity');
    if (accessibleLessons.length) alternatives.push('lesson');
  }
  return {
    focus, category: input.category, level: input.level, targetQuestions: n, activities,
    shortfall: { questions: shortfall, note }, alternatives,
  };
}
