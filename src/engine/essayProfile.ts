import type { CompId, Essay, EssayPractice } from '../types';
import { COMP_INFO, ESSAY_SKILLS, essaySkillsOf, type EssaySkill } from '../data/essaySkills';

/**
 * PERFIL DE REDAÇÃO: lê as versões corrigidas (estimativas formativas) e os treinos para indicar o estado de cada habilidade.
 * Uma dificuldade só é recorrente com sinais em pelo menos dois textos; a comprovação exige temas diferentes.
 */
export type EssayState = 'nao_avaliado' | 'dificuldade' | 'em_aprendizagem' | 'comprovada';
export const ESSAY_STATE_LABEL: Record<EssayState, string> = { nao_avaliado: 'Não avaliada', dificuldade: 'Dificuldade recorrente', em_aprendizagem: 'Em aprendizagem', comprovada: 'Comprovada em temas diferentes' };
export interface EssaySkillView { skill: EssaySkill; state: EssayState; signals: { ts: number; themeId: string; status: 'ok' | 'parcial' | 'ausente' }[]; note: string }

export function essayProfile(essays: Essay[], practice: EssayPractice[]): EssaySkillView[] {
  // Só a última versão de cada texto entra como sinal: reescrever o mesmo texto não multiplica a evidência.
  const finals = essays.map((e) => ({ themeId: e.themeId, v: [...e.versions].reverse().find((x) => x.eval) })).filter((x) => x.v).sort((a, b) => a.v!.ts - b.v!.ts);
  return ESSAY_SKILLS.map((skill) => {
    const signals = finals.map((x) => ({ ts: x.v!.ts, themeId: x.themeId, status: skill.signal(x.v!.eval!) })).filter((s): s is { ts: number; themeId: string; status: 'ok' | 'parcial' | 'ausente' } => s.status !== null);
    const verified = practice.filter((p) => p.skillId === skill.id && p.kind === 'verificacao' && p.ok).length;
    const last3 = signals.slice(-3); const weak = last3.filter((s) => s.status !== 'ok').length;
    const okThemes = new Set(signals.filter((s) => s.status === 'ok').map((s) => s.themeId)).size;
    const state: EssayState = !signals.length ? 'nao_avaliado' : okThemes + (verified ? 1 : 0) >= 2 && last3.at(-1)!.status === 'ok' ? 'comprovada' : weak >= 2 ? 'dificuldade' : 'em_aprendizagem';
    const note = !signals.length ? 'Nenhum texto corrigido.' : state === 'dificuldade' ? `Sinal de dificuldade em ${weak} dos últimos ${last3.length} textos.` : state === 'comprovada' ? `Demonstrada em ${okThemes} tema(s)${verified ? ' e em verificação' : ''}.` : `${signals.length} texto(s) avaliado(s).`;
    return { skill, state, signals, note };
  });
}

export interface CompView { id: CompId; name: string; last?: number; avg?: number; n: number; difficulties: EssaySkillView[]; skills: EssaySkillView[] }
export function competencyViews(essays: Essay[], practice: EssayPractice[]): CompView[] {
  const prof = essayProfile(essays, practice);
  const evals = essays.flatMap((e) => { const v = [...e.versions].reverse().find((x) => x.eval); return v ? [{ ts: v.ts, ev: v.eval! }] : []; }).sort((a, b) => a.ts - b.ts);
  return (Object.keys(COMP_INFO) as CompId[]).map((id) => {
    const scores = evals.map((x) => x.ev.competencies.find((c) => c.id === id)!.score);
    const skills = prof.filter((p) => essaySkillsOf(id).some((s) => s.id === p.skill.id));
    return { id, name: COMP_INFO[id].name, n: scores.length, last: scores.at(-1), avg: scores.length ? Math.round(scores.slice(-3).reduce((s, x) => s + x, 0) / Math.min(3, scores.length)) : undefined, skills, difficulties: skills.filter((s) => s.state === 'dificuldade') };
  });
}
/** Competência que mais pede atenção (só com dados suficientes). */
export function essayFocus(essays: Essay[], practice: EssayPractice[]): CompView | null {
  const v = competencyViews(essays, practice).filter((c) => c.n >= 1 && (c.difficulties.length > 0 || (c.n >= 2 && (c.avg ?? 200) <= 120)));
  return v.sort((a, b) => b.difficulties.length - a.difficulties.length || (a.avg ?? 200) - (b.avg ?? 200))[0] ?? null;
}
