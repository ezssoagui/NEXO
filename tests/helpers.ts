import type { Attempt, Question } from '../src/types';
import { questionById } from '../src/data/questions';
import { classifyResponse } from '../src/engine/intervention';

let n = 0;
export const Q = (id: string) => questionById(id)! as Question;
/** Cria uma tentativa como o QuestionPlayer faria (com evidência e situação do motor). */
export function attempt(id: string, chosen: string, confidence: Attempt['confidence'], extra: Partial<Attempt> = {}, history: Attempt[] = []): Attempt {
  const q = Q(id);
  const correct = q.type === 'aberta' ? Math.abs(+chosen - q.openAnswer!.value) < 1e-6 : !!q.alternatives!.find((a) => a.letter === chosen)?.correct;
  const h = classifyResponse(q, { correct, confidence, hintsUsed: extra.hintsUsed ?? 0, justification: extra.justification, chosen, timeSec: extra.timeSec }, history);
  return { id: `t${n++}`, qid: id, skillId: q.skillId, subject: q.subject, chosen, correct, confidence, hintsUsed: 0, ts: Date.now(), mode: 'tutoria', evidence: h.evidence, situation: h.situation, errorType: correct ? undefined : q.alternatives?.find((a) => a.letter === chosen)?.errorType, ...extra };
}
