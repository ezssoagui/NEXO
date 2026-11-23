import type { Attempt, CardRating, CardState, SkillReview } from '../types';
import { evidenceOf, solid } from './mastery';

const DAY = 86400000;
/** Compatibilidade: nomes das "caixas" exibidas na interface (nível de estabilidade do cartão). */
export const BOX_INTERVALS = [0, 1, 3, 7, 14, 30, 60];

/**
 * PARÂMETROS CONFIGURÁVEIS do algoritmo de repetição espaçada (editáveis no painel administrativo).
 * Valores iniciais EXPERIMENTAIS, inspirados no SM-2 — não são regras científicas definitivas e devem ser
 * calibrados com dados reais de retenção.
 */
export interface SrsConfig { initialEase: number; minEase: number; maxEase: number; easePenaltyNaoSei: number; easePenaltyQuaseSei: number; easeBonusSei: number; firstIntervalSei: number; secondIntervalSei: number; quaseSeiGrowth: number; relearnMinutes: number; lateBonusMax: number; difficultyReduction: number; maxIntervalDays: number }
export const DEFAULT_SRS: SrsConfig = { initialEase: 2.3, minEase: 1.3, maxEase: 3, easePenaltyNaoSei: 0.2, easePenaltyQuaseSei: 0.05, easeBonusSei: 0.05, firstIntervalSei: 2, secondIntervalSei: 3, quaseSeiGrowth: 1.2, relearnMinutes: 10, lateBonusMax: 0.5, difficultyReduction: 0.3, maxIntervalDays: 120 };
let CFG: SrsConfig = { ...DEFAULT_SRS };
export const setSrsConfig = (c: Partial<SrsConfig>) => { CFG = { ...DEFAULT_SRS, ...c }; };
export const getSrsConfig = () => CFG;
/** Rótulos apresentados ao aluno para as classificações internas. */
export const RATING_LABEL: Record<CardRating, string> = { errei: 'Não sei', duvida: 'Quase sei', seguro: 'Sei' };

/**
 * Repetição espaçada ADAPTATIVA e explicável (inspirada no SM-2, simplificada):
 *  - cada cartão tem facilidade própria (ease) e intervalo; não há intervalos fixos iguais para todos;
 *  - "errei" reduz a facilidade e reinicia o intervalo; "dúvida" cresce pouco; "segurança" multiplica pela facilidade;
 *  - acertar com segurança uma revisão ATRASADA dá bônus (a memória resistiu mais tempo);
 *  - conteúdos difíceis para o aluno (domínio baixo) recebem intervalos menores;
 *  - revisão livre não altera a programação.
 */
export interface ScheduleCtx { difficulty?: number; free?: boolean }
export function schedule(prev: CardState | undefined, rating: CardRating, now = Date.now(), ctx: ScheduleCtx = {}): { state: CardState; explanation: string } {
  const reviews = [...(prev?.reviews ?? []), { ts: now, rating, free: ctx.free || undefined }];
  if (ctx.free && prev) return { state: { ...prev, reviews }, explanation: 'Revisão livre: registrada no histórico, sem alterar sua programação adaptativa.' };
  const C = CFG;
  let ease = prev?.ease ?? C.initialEase; const prevInt = prev?.interval ?? 0; let lapses = prev?.lapses ?? 0;
  const overdue = prev?.last && prevInt > 0 ? Math.max(0, (now - prev.due) / (prevInt * DAY)) : 0;
  const diff = Math.max(0, Math.min(1, ctx.difficulty ?? 0));
  let interval: number; let why: string;
  if (rating === 'errei') {
    ease = Math.max(C.minEase, ease - C.easePenaltyNaoSei); lapses++; interval = 0;
    why = `“Não sei”: o cartão volta em ~${C.relearnMinutes} minutos e passa a aparecer com mais frequência.`;
  } else if (rating === 'duvida') {
    ease = Math.max(C.minEase, ease - C.easePenaltyQuaseSei); interval = Math.max(1, Math.round(Math.max(1, prevInt) * C.quaseSeiGrowth));
    why = `“Quase sei”: o intervalo cresce pouco — próxima revisão em ${interval} dia(s).`;
  } else {
    const bonus = 1 + C.lateBonusMax * Math.min(1, overdue);
    interval = prevInt <= 0 ? (prev?.reviews.some((r) => r.rating === 'seguro' && !r.free) ? C.secondIntervalSei : C.firstIntervalSei) : Math.round(prevInt * ease * bonus);
    ease = Math.min(C.maxEase, ease + C.easeBonusSei);
    why = `“Sei”: próxima revisão em ${interval} dia(s)${bonus > 1 ? ' (bônus por lembrar mesmo com a revisão atrasada)' : ''}.`;
  }
  if (diff > 0 && interval > 1) { const adj = Math.max(1, Math.round(interval * (1 - C.difficultyReduction * diff))); if (adj < interval) { why += ` Ajustado para ${adj} dia(s) porque este conteúdo ainda está em desenvolvimento para você.`; interval = adj; } }
  interval = Math.min(interval, C.maxIntervalDays);
  const due = interval === 0 ? now + C.relearnMinutes * 60000 : now + interval * DAY;
  const box = rating === 'errei' ? 0 : Math.min(6, interval <= 1 ? 1 : interval <= 3 ? 2 : interval <= 7 ? 3 : interval <= 14 ? 4 : interval <= 30 ? 5 : 6);
  return { state: { box, due, last: now, reviews, ease: +ease.toFixed(2), interval, lapses }, explanation: why };
}

/** Previsão de retenção (não é medida direta de memória): R = exp(-t / S), com S proporcional ao intervalo e à facilidade. */
export function retention(state: CardState | undefined, now = Date.now()) {
  if (!state?.last) return null;
  const stability = Math.max(0.6, (state.interval ?? BOX_INTERVALS[state.box] ?? 1) * ((state.ease ?? CFG.initialEase) / CFG.initialEase));
  return Math.exp(-((now - state.last) / DAY) / stability);
}
export const isDue = (s: CardState | undefined, now = Date.now()) => !s || s.due <= now;

/**
 * Revisão de HABILIDADES (questões): agenda quando revisar uma habilidade, combinando desempenho, evidência,
 * confiança, questão inédita e tempo decorrido. Revisões livres não alteram a programação.
 */
export function scheduleSkill(prev: SkillReview | undefined, a: Attempt, now = a.ts): { review: SkillReview; explanation: string } {
  const base: SkillReview = prev ?? { due: now, interval: 0, ease: 2.2, lapses: 0 };
  if (a.free) return { review: base, explanation: 'Revisão livre: programação mantida.' };
  const e = evidenceOf(a);
  let { ease, interval, lapses } = base; let why: string;
  if (!a.correct) {
    lapses++; ease = Math.max(1.3, ease - 0.2); interval = e === 'erro_desatencao' || e === 'erro_procedimental' ? 2 : 1;
    why = `Erro registrado: habilidade volta à revisão em ${interval} dia(s).`;
  } else if (!solid(a)) {
    interval = 1; why = 'Acerto frágil (chute, dicas ou raciocínio incorreto): verificação amanhã.';
  } else {
    const novel = a.isNovel || a.isTwin;
    const growth = e === 'acerto_duvida' || e === 'acerto_eliminacao' ? 1.3 : novel ? ease * 1.2 : ease;
    interval = Math.max(e === 'acerto_duvida' ? 2 : 3, Math.round(Math.max(1, interval) * growth));
    ease = Math.min(3, ease + (novel ? 0.1 : 0.03));
    why = `Acerto ${novel ? 'em questão inédita' : 'sólido'}: próxima revisão da habilidade em ${interval} dia(s).`;
  }
  interval = Math.min(interval, 90);
  return { review: { due: now + interval * DAY, interval, ease: +ease.toFixed(2), last: now, lapses }, explanation: why };
}
