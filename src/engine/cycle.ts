import type { Attempt, CycleStage, MasteryCycle, Situation } from '../types';
import type { Hypothesis } from './intervention';

/**
 * CICLO DE DOMÍNIO NEXO: Diagnóstico → Investigação → Ensino → Comprovação → Consolidação.
 * Funções puras (testáveis). Nem todo aluno passa por todas as etapas; o aluno pode adiar ou interromper.
 */
const now = () => Date.now();
const log = (c: MasteryCycle, stage: CycleStage, note: string): MasteryCycle => ({ ...c, stage, updatedAt: now(), history: [...c.history, { ts: now(), stage, note }] });

/** Decide se uma resposta abre um ciclo. Acertos confiantes não abrem; acertos frágeis só com evidência de dificuldade. */
export function needsCycle(h: Hypothesis) { return h.situation !== 'A' && (h.situation !== 'B' || h.verifyLater); }

export function startCycle(qid: string, skillId: string, h: Hypothesis): MasteryCycle {
  const t = now();
  const c: MasteryCycle = { id: `cy-${t}-${Math.random().toString(36).slice(2, 6)}`, skillId, originQid: qid, situation: h.situation, stage: 'diagnostico', status: 'ativo', createdAt: t, updatedAt: t, twinLevel: 1, twinAttempts: [], history: [{ ts: t, stage: 'diagnostico', note: `${h.title} (confiança ${Math.round(h.confidence * 100)}%)` }] };
  if (h.situation === 'AMB') return log(c, 'investigacao', 'Classificação incerta: perguntar ao aluno.');
  if (h.situation === 'B') return log(c, 'comprovacao', 'Acerto frágil com evidência de dificuldade: verificar com questão inédita.');
  return log(c, 'ensino', `Intervenção: ${h.intervention}.`);
}

export function reclassifyCycle(c: MasteryCycle, s: Situation): MasteryCycle { return log({ ...c, situation: s }, 'ensino', `Aluno ajustou a classificação para ${s}.`); }
export function finishTeaching(c: MasteryCycle, outcome: 'compreendeu' | 'revelou_resposta'): MasteryCycle { return log(c, 'comprovacao', outcome === 'compreendeu' ? 'Intervenção concluída: aluno demonstrou compreensão.' : 'Explicação direta solicitada.'); }
export function postpone(c: MasteryCycle): MasteryCycle { return { ...log(c, c.stage, 'Adiado pelo aluno.'), status: 'adiado' }; }
export function resume(c: MasteryCycle): MasteryCycle { return { ...log(c, c.stage, 'Retomado.'), status: 'ativo' }; }
export function interrupt(c: MasteryCycle): MasteryCycle { return { ...log(c, c.stage, 'Tutoria interrompida pelo aluno; comprovação fica para a revisão.'), status: 'interrompido' }; }

/** Registra a comprovação (questão gêmea). Acerto sólido → consolidação; erro → volta ao ensino com nível ajustado. */
export function recordTwin(c: MasteryCycle, a: Attempt, level: number): MasteryCycle {
  const ok = a.correct && a.confidence !== 'chute' && a.confidence !== 'nao_consegui';
  const twinAttempts = [...c.twinAttempts, { qid: a.qid, correct: ok, level, ts: a.ts }];
  const next: MasteryCycle = { ...c, twinAttempts, twinLevel: (ok ? Math.min(3, level + 1) : Math.max(1, level - 1)) as 1 | 2 | 3, status: 'ativo' };
  if (ok) return log(next, 'consolidacao', `Aprendizado comprovado em questão inédita (nível ${level}). Revisão espaçada agendada.`);
  const fails = twinAttempts.filter((t) => !t.correct).length;
  return log(next, 'ensino', fails >= 2 ? 'Duas comprovações sem sucesso: recomenda-se microaula antes de nova tentativa.' : `Comprovação não atingida (nível ${level}). Nova intervenção.`);
}

/** Consolidação concluída quando há acerto sólido posterior em outro dia (revisão). */
export function checkConsolidation(c: MasteryCycle, attempts: Attempt[]): MasteryCycle {
  if (c.stage !== 'consolidacao') return c;
  const proof = c.twinAttempts.filter((t) => t.correct).at(-1); if (!proof) return c;
  const later = attempts.find((a) => a.skillId === c.skillId && a.ts > proof.ts + 20 * 3600000 && a.correct && a.confidence !== 'chute' && !a.free);
  return later ? { ...log(c, 'concluido', 'Revisão posterior confirmada: ciclo concluído.'), status: 'concluido' } : c;
}

export const STAGE_LABEL: Record<CycleStage, string> = { diagnostico: 'Diagnóstico', investigacao: 'Investigação', ensino: 'Ensino', comprovacao: 'Comprovação', consolidacao: 'Consolidação', concluido: 'Concluído' };
export const STAGES: CycleStage[] = ['diagnostico', 'investigacao', 'ensino', 'comprovacao', 'consolidacao'];
