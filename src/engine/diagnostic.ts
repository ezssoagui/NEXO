import type { Area, Question } from '../types';

const AREAS: Area[] = ['Linguagens', 'Ciências Humanas', 'Ciências da Natureza', 'Matemática'];
/** Seleção equilibrada entre áreas e habilidades (rodízio), sem repetir questões já respondidas enquanto houver inéditas. */
export function diagnosticSet(bank: Question[], target: number, seen: string[] = []) {
  const per = Math.ceil(target / AREAS.length); const done = new Set(seen);
  const byArea = AREAS.map((area) => {
    const groups = new Map<string, Question[]>();
    bank.filter((q) => q.area === area && q.type === 'objetiva' && !q.integrates?.length).sort((a, b) => Number(done.has(a.id)) - Number(done.has(b.id))).forEach((q) => groups.set(q.skillId, [...(groups.get(q.skillId) ?? []), q]));
    const out: Question[] = []; let more = true;
    while (out.length < per && more) { more = false; for (const g of groups.values()) { const q = g.shift(); if (q && out.length < per) { out.push(q); more = true; } } }
    return { area, n: out.length, qids: out.map((q) => q.id) };
  });
  return { byArea, qids: byArea.flatMap((a) => a.qids).slice(0, target) };
}
