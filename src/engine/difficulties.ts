import type { Attempt, CpeStepId, ErrorCategory, ErrorType } from '../types';
import { ALL_BLOCKS, blockSkills, type FullBlock } from '../data/curriculum';
import { errorCategoryLabel } from '../data/skills';
import { skillName } from './domain';
import { DEFAULT_PARAMS, type Params } from './params';

/** DIFICULDADES por bloco: só são indicadas com erros acumulados, nunca por uma única questão. */
export interface Difficulty { block: FullBlock; errors: number; total: number; rate: number; skills: { id: string; errors: number; total: number }[] }
export function detectDifficulties(attempts: Attempt[], params: Params = DEFAULT_PARAMS): Difficulty[] {
  return ALL_BLOCKS.map((block) => {
    const ids = new Set(blockSkills(block));
    const recent = attempts.filter((a) => ids.has(a.skillId) && !a.assisted).sort((a, b) => a.ts - b.ts).slice(-params.janelaDificuldade);
    const errors = recent.filter((a) => !a.correct).length;
    const skills = [...ids].map((id) => { const xs = recent.filter((a) => a.skillId === id); return { id, errors: xs.filter((a) => !a.correct).length, total: xs.length }; })
      .filter((s) => s.errors > 0).sort((a, b) => b.errors - a.errors || b.errors / b.total - a.errors / a.total);
    return { block, errors, total: recent.length, rate: recent.length ? errors / recent.length : 0, skills };
  }).filter((d) => d.errors >= params.dificuldadeMinErros && d.rate >= params.dificuldadeTaxa).sort((a, b) => b.rate * b.errors - a.rate * a.errors);
}
export const difficultyText = (d: Difficulty) => `Você apresentou ${d.errors} erros em ${d.total} questões recentes.`;
export const difficultySkills = (d: Difficulty) => d.skills.slice(0, 2).map((s) => skillName(s.id).toLowerCase()).join(' e ');

/**
 * PADRÕES DE ERRO (hipóteses): soma a autoclassificação (peso 1) e o erro típico da alternativa (peso 0,35).
 * Um padrão só aparece com o mínimo de erros e a proporção configurada; caso contrário, nada é afirmado.
 */
const FROM_TYPE: Partial<Record<ErrorType, ErrorCategory>> = { lacuna_conceitual: 'conceitual', memorizacao: 'lacuna', interpretacao: 'interpretativa', formula_incorreta: 'aplicacao', grandeza_constante: 'aplicacao', calculo: 'procedimental', unidades: 'procedimental', desatencao: 'atencao' };
export const ALTERNATIVE_WEIGHT = 0.35;
export interface ErrorPattern { label: string; weight: number; count: number; total: number; confidence: 'baixa' | 'moderada' | 'alta'; declared: number; kind: 'categoria' | 'cpe' }
export function errorPatterns(attempts: Attempt[], params: Params = DEFAULT_PARAMS): ErrorPattern[] {
  const wrong = attempts.filter((a) => !a.correct && !a.assisted && a.subject !== 'Linguagens' && a.subject !== 'Humanas').sort((a, b) => a.ts - b.ts).slice(-30);
  const w = new Map<ErrorCategory, { weight: number; count: number; declared: number }>();
  const add = (c: ErrorCategory, x: number, declared: boolean) => { const v = w.get(c) ?? { weight: 0, count: 0, declared: 0 }; w.set(c, { weight: v.weight + x, count: v.count + 1, declared: v.declared + (declared ? 1 : 0) }); };
  wrong.forEach((a) => { if (a.selfCategory && a.selfCategory !== 'nao_sei') add(a.selfCategory, 1, true); else if (a.errorType && FROM_TYPE[a.errorType]) add(FROM_TYPE[a.errorType]!, ALTERNATIVE_WEIGHT, false); });
  const sum = [...w.values()].reduce((s, v) => s + v.weight, 0);
  const cats: ErrorPattern[] = [...w.entries()].filter(([, v]) => v.count >= params.padraoMinErros && v.weight >= 1 && v.weight / sum >= params.padraoProporcao * 0.7).map(([c, v]) => ({
    label: errorCategoryLabel(c), weight: v.weight, count: v.count, total: wrong.length, declared: v.declared, kind: 'categoria',
    confidence: v.declared >= params.padraoMinErros && v.weight / sum >= params.padraoProporcao ? 'alta' : v.declared >= 1 ? 'moderada' : 'baixa',
  }));
  const names: Record<CpeStepId, string> = { comando: 'Comando: compreender o que é pedido', prova: 'Prova: localizar a evidência', eliminacao: 'Eliminação: descartar alternativas próximas' };
  const withCpe = attempts.filter((a) => a.cpe).sort((a, b) => a.ts - b.ts).slice(-20);
  const cpe: ErrorPattern[] = (Object.keys(names) as CpeStepId[]).map((s) => ({ s, n: withCpe.filter((a) => a.cpe![s] === 'dificuldade').length })).filter((x) => x.n >= params.padraoMinErros)
    .map((x) => ({ label: names[x.s], weight: x.n, count: x.n, total: withCpe.length, declared: 0, kind: 'cpe', confidence: x.n / withCpe.length >= params.padraoProporcao ? 'alta' : 'moderada' }));
  return [...cats, ...cpe].sort((a, b) => b.weight - a.weight);
}

/** Etapas do CPE cuja compreensão já foi demonstrada com consistência (podem ser ignoradas). */
export function cpeMastered(attempts: Attempt[]): CpeStepId[] {
  return (['comando', 'prova', 'eliminacao'] as CpeStepId[]).filter((s) => {
    const last = attempts.filter((a) => a.cpe?.[s] && a.cpe[s] !== 'pulada').sort((a, b) => a.ts - b.ts).slice(-2);
    return last.length === 2 && last.every((a) => a.cpe![s] === 'demonstrada');
  });
}
