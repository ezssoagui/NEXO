import { SKILLS } from '../data/skills';
import { blockSkills, type Block } from '../data/curriculum';
import type { DomainMap, LearnData } from './domain';
import { isSolid } from './domain';
import { DEFAULT_PARAMS, type Params } from './params';

/**
 * Quatro indicadores SEPARADOS (nunca combinados em nota única): cobertura (habilidades com alguma evidência),
 * domínio (consolidadas ÷ total), aproveitamento (acertos recentes) e retenção (verificações após intervalo).
 * `null` = ainda não há dados — diferente de zero.
 */
export interface Indicators { coverage: { value: number; n: number; total: number }; domain: { value: number; n: number; total: number; provisional: number }; accuracy: { value: number | null; n: number }; retention: { value: number | null; n: number } }

export function indicators(data: LearnData, domains: DomainMap, params: Params = DEFAULT_PARAMS, skillIds: string[] = SKILLS.map((s) => s.id)): Indicators {
  const set = new Set(skillIds); const list = skillIds.map((id) => domains.get(id)!).filter(Boolean); const total = list.length;
  const covered = list.filter((d) => d.evaluated).length; const cons = list.filter((d) => d.state === 'consolidado').length;
  const recent = data.attempts.filter((a) => set.has(a.skillId) && !a.assisted).sort((a, b) => a.ts - b.ts).slice(-params.aproveitamentoJanela);
  const ret = list.flatMap((d) => d.evidence.filter((e) => e.dim === 'retencao'));
  return {
    coverage: { value: total ? covered / total : 0, n: covered, total },
    domain: { value: total ? cons / total : 0, n: cons, total, provisional: list.filter((d) => d.state === 'provisorio').length },
    accuracy: { value: recent.length ? recent.filter((a) => a.correct).length / recent.length : null, n: recent.length },
    retention: { value: ret.length ? ret.filter((e) => e.value === 'positiva').length / ret.length : null, n: ret.length },
  };
}
export const blockIndicators = (b: Block, data: LearnData, domains: DomainMap, params?: Params) => indicators(data, domains, params, blockSkills(b));

/** Série semanal da página de desempenho. */
export function weeklySeries(data: LearnData, weeks = 8, now = Date.now()) {
  const WEEK = 7 * 86400000;
  return Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * WEEK; const win = data.attempts.filter((a) => a.ts <= end && a.ts > end - WEEK && !a.assisted); const d = new Date(end);
    return { semana: `${d.getDate()}/${d.getMonth() + 1}`, aproveitamento: win.length ? Math.round((win.filter((a) => a.correct).length / win.length) * 100) : null, solidos: win.filter(isSolid).length, questoes: win.length };
  });
}
