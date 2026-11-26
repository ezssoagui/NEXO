/**
 * Gamificação (9.2–9.5): independente da pedagogia (9.8).
 * Convenção de fronteira (9.3): nível 1 começa em 0 XP; nível n cobre [(n−1)·500, n·500).
 * Classe a cada cinco níveis; Lendário a partir do nível 31.
 */
export const XP_PER_LEVEL = 500;
export const CLASSES = ['Bronze', 'Prata', 'Ouro', 'Platina', 'Diamante', 'Mestre', 'Lendário'] as const;
export type ClassName = (typeof CLASSES)[number];

export function levelFor(totalXp: number): { level: number; className: ClassName; xpIntoLevel: number; xpForNext: number } {
  const xp = Math.max(0, Math.floor(totalXp));
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const classIdx = Math.min(Math.floor((level - 1) / 5), CLASSES.length - 1);
  return { level, className: CLASSES[classIdx]!, xpIntoLevel: xp % XP_PER_LEVEL, xpForNext: XP_PER_LEVEL - (xp % XP_PER_LEVEL) };
}

/**
 * Sequência de dias consecutivos de estudo válido (9.5). `days` em 'YYYY-MM-DD' no fuso do produto.
 * Se ainda não estudou hoje, a sequência até ontem continua válida. Interrupção reinicia sem perda de XP.
 */
export function currentStreak(days: string[], today: string): number {
  const set = new Set(days);
  const prev = (d: string) => {
    const dt = new Date(`${d}T12:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() - 1);
    return dt.toISOString().slice(0, 10);
  };
  let cursor = set.has(today) ? today : prev(today);
  let n = 0;
  while (set.has(cursor)) { n++; cursor = prev(cursor); }
  return n;
}

export function longestStreak(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0, run = 0, last: number | null = null;
  for (const d of sorted) {
    const t = Date.parse(`${d}T12:00:00Z`);
    run = last !== null && t - last === 86_400_000 ? run + 1 : 1;
    best = Math.max(best, run);
    last = t;
  }
  return best;
}

/** Chave de idempotência do XP: evita duplicidade e repetições artificiais (9.7). */
export function xpSourceKey(activity: string, entityId: string, day?: string): string {
  return day ? `${activity}:${entityId}:${day}` : `${activity}:${entityId}`;
}
