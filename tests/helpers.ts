import type { Attempt, Explanation, Question } from '../src/types';
import { questionById } from '../src/data/questions';
import { explainTaskById } from '../src/data/explainTasks';

export const DAY = 86400000;
export const T0 = new Date('2026-08-03T12:00:00').getTime();
let n = 0;
export const Q = (id: string) => questionById(id)! as Question;
export function at(qid: string, correct: boolean, day: number, extra: Partial<Attempt> = {}): Attempt {
  const q = Q(qid); const alt = q.alternatives!.find((a) => !!a.correct === correct)!;
  return { id: `t${n++}`, qid, skillId: q.skillId, subject: q.subject, chosen: alt.letter, correct, confidence: correct ? 'certeza' : 'duvida', ts: T0 + day * DAY + n, mode: 'adaptativo', errorType: correct ? undefined : alt.errorType, ...extra };
}
export function ex(taskId: string, result: Explanation['result'], day: number, extra: Partial<Explanation> = {}): Explanation {
  const t = explainTaskById(taskId)!;
  return { id: `x${n++}`, taskId, skillId: t.skillId, level: t.level, text: '', ts: T0 + day * DAY, result, criteria: [], engine: 'teste', demo: true, ...extra };
}
