import type { Attempt, Question } from '../types';
import { QUESTIONS } from '../data/questions';
import { generate, hasGenerator } from './generator';

/**
 * QUESTÕES GÊMEAS — inéditas para o estudante, mesma habilidade, outra situação.
 * Nível 1 aplicação direta · nível 2 transferência contextual · nível 3 integração de habilidades.
 * Geradas por modelo paramétrico só entram se a validação automática recalcular o gabarito; nunca são chamadas de "revisadas".
 * Sem questão confiável e inédita, nada é apresentado.
 */
export type TwinLevel = 1 | 2 | 3;
export const TWIN_LEVEL_LABEL: Record<TwinLevel, string> = { 1: 'Aplicação direta', 2: 'Transferência contextual', 3: 'Integração de habilidades' };
export interface TwinPick { q: Question; level: TwinLevel; kind: 'banco' | 'gerada'; note: string }
export interface TwinNone { none: true; reason: string }

/** Nível conforme o histórico: erro recente reduz, acerto em gêmea avança. */
export function chooseLevel(skillId: string, attempts: Attempt[]): TwinLevel {
  const mine = attempts.filter((a) => a.skillId === skillId).sort((a, b) => a.ts - b.ts);
  const lastTwin = [...mine].reverse().find((a) => a.isTwin && a.twinLevel);
  if (lastTwin) return (lastTwin.correct ? Math.min(3, lastTwin.twinLevel! + 1) : Math.max(1, lastTwin.twinLevel! - 1)) as TwinLevel;
  return mine.slice(-3).filter((a) => !a.correct).length >= 2 ? 1 : 2;
}

export function selectTwin(skillId: string, level: TwinLevel, history: Attempt[], opts: { seed?: number; originId?: string; exclude?: string[] } = {}): TwinPick | TwinNone {
  const seen = new Set([...history.map((a) => a.qid), ...(opts.exclude ?? []), ...(opts.originId ? [opts.originId] : [])]);
  const l2 = QUESTIONS.filter((x) => x.skillId === skillId && !x.integrates?.length && x.type === 'objetiva' && !seen.has(x.id));
  const l3 = QUESTIONS.filter((x) => x.integrates?.length && (x.skillId === skillId || x.integrates.includes(skillId)) && !seen.has(x.id));
  const gen = (): TwinPick | null => {
    if (!hasGenerator(skillId)) return null;
    for (let i = 0; i < 3; i++) { const g = generate(skillId, { seed: opts.seed ? opts.seed + i : undefined, request: `Gêmea de ${opts.originId ?? skillId}` }); if (g?.status === 'aprovada') return { q: g.q, level: 1, kind: 'gerada', note: 'Gerada por modelo paramétrico; gabarito recalculado automaticamente, sem revisão humana.' }; }
    return null;
  };
  const bank = (list: Question[], lv: TwinLevel): TwinPick | null => (list[0] ? { q: list[0], level: lv, kind: 'banco', note: lv === 3 ? 'Combina esta habilidade com outra.' : 'Mesma habilidade, outra situação.' } : null);
  const order = level === 1 ? [gen, () => bank(l2, 2), () => bank(l3, 3)] : level === 2 ? [() => bank(l2, 2), gen, () => bank(l3, 3)] : [() => bank(l3, 3), () => bank(l2, 2), gen];
  for (const f of order) { const r = f(); if (r) return r; }
  return { none: true, reason: 'Não há, no momento, uma questão inédita e confiável para esta habilidade. A comprovação fica para a revisão.' };
}
export const isNone = (x: TwinPick | TwinNone): x is TwinNone => 'none' in x;
