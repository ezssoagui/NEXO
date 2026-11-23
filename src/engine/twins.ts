import type { Attempt, Question, Situation } from '../types';
import { QUESTIONS } from '../data/questions';
import { generate, hasGenerator } from './generator';

/**
 * QUESTÕES GÊMEAS INTELIGENTES
 * Nível 1 — aplicação direta (situação semelhante, novos dados e narrativa: gerador validado);
 * Nível 2 — transferência contextual (questão curada do banco, outro contexto);
 * Nível 3 — integração (combina o conceito com outra habilidade).
 * Prioriza questões revisadas. Gerada só entra se passar na validação. Se não houver questão confiável e inédita,
 * NÃO apresenta nada como validado — devolve o motivo.
 */
export type TwinLevel = 1 | 2 | 3;
export const TWIN_LEVEL_LABEL: Record<TwinLevel, string> = { 1: 'Nível 1 — aplicação direta', 2: 'Nível 2 — transferência contextual', 3: 'Nível 3 — integração' };
export interface TwinPick { q: Question; level: TwinLevel; kind: 'banco' | 'gerada'; reviewed: boolean; note: string }
export interface TwinNone { none: true; reason: string; level: TwinLevel }

/** Nível inicial conforme a situação e o histórico de comprovações do ciclo. */
export function chooseLevel(situation: Situation | undefined, twinHistory: { correct: boolean; level: number }[] = []): TwinLevel {
  const last = twinHistory[twinHistory.length - 1];
  if (last) return (last.correct ? Math.min(3, last.level + 1) : Math.max(1, last.level - 1)) as TwinLevel;
  if (situation === 'D' || situation === 'E' || situation === 'F') return 1;
  return 2; // C (interpretação pede outro texto), B (verificação) e demais
}

const isIntegration = (q: Question) => !!q.integrates?.length;

export function selectTwin(origin: Question, level: TwinLevel, history: Attempt[], opts: { seed?: number } = {}): TwinPick | TwinNone {
  const seen = new Set(history.map((a) => a.qid)); seen.add(origin.id);
  const skill = origin.skillId;
  const bankL2 = QUESTIONS.filter((x) => x.skillId === skill && !isIntegration(x) && x.type === origin.type && !seen.has(x.id));
  const bankL3 = QUESTIONS.filter((x) => isIntegration(x) && (x.skillId === skill || x.integrates!.includes(skill)) && !seen.has(x.id));
  const gen = (): TwinPick | null => {
    if (!hasGenerator(skill)) return null;
    for (let i = 0; i < 3; i++) { // tenta até 3 gerações; só aceita as aprovadas na validação
      const g = generate(skill, { seed: opts.seed ? opts.seed + i : undefined, request: `Gêmea nível 1 de ${origin.id}` });
      if (g && g.status === 'aprovada') return { q: g.q, level: 1, kind: 'gerada', reviewed: false, note: 'Gerada agora com novos dados e narrativa; aprovada na validação automática (sem revisão humana).' };
    }
    return null;
  };
  const fromBank = (list: Question[], lv: TwinLevel): TwinPick | null => list[0] ? { q: list[0], level: lv, kind: 'banco', reviewed: true, note: lv === 3 ? `Combina com ${list[0].integrates!.join(', ')}.` : 'Questão curada do banco, em outro contexto.' } : null;

  const order: (() => TwinPick | null)[] = level === 1 ? [gen, () => fromBank(bankL2, 2), () => fromBank(bankL3, 3)]
    : level === 2 ? [() => fromBank(bankL2, 2), gen, () => fromBank(bankL3, 3)]
    : [() => fromBank(bankL3, 3), () => fromBank(bankL2, 2), gen];
  for (const f of order) { const r = f(); if (r) return r; }
  return { none: true, level, reason: 'Não há, no momento, uma questão inédita e confiável para esta habilidade. Para não apresentar uma questão possivelmente incorreta como validada, a comprovação foi agendada para a revisão.' };
}
export const isNone = (x: TwinPick | TwinNone): x is TwinNone => 'none' in x;
