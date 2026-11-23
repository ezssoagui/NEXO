import type { Attempt, MasteryState, XPEvent } from '../types';
import { LEAGUES, MIN_PARTICIPANTS, SCHOOLS } from '../data/demo';
import { allMastery } from './mastery';

const DAY = 86400000;
export const DAILY_PRACTICE_XP_CAP = 120;
/**
 * XP por APRENDIZAGEM demonstrada (não por volume). Regras:
 *  - repetir a mesma questão em menos de 24 h não gera XP; cada questão rende XP no máximo 3 vezes;
 *  - acerto por chute e erros não geram XP de prática (o XP vem de corrigir a dificuldade depois);
 *  - acerto em questão inédita após erro ("dificuldade corrigida") e marcos de domínio valem mais;
 *  - teto diário de XP de prática: depois dele, a plataforma sugere pausa (sem incentivo a estudo compulsivo);
 *  - XP não pode ser comprado.
 */
export function xpForAttempt(a: Attempt, prev: Attempt[], before: MasteryState, after: MasteryState, practiceXpToday = 0): XPEvent[] {
  const same = prev.filter((p) => p.qid === a.qid);
  const ev: XPEvent[] = [];
  const key = `${a.qid}:${a.ts}`;
  if (a.free) return [{ ts: a.ts, amount: 0, reason: 'Revisão livre (sem XP, sem alterar a programação)', key }];
  if (same.some((p) => a.ts - p.ts < DAY) || same.length >= 3) return [{ ts: a.ts, amount: 0, reason: 'Repetição recente da mesma questão (antifraude: sem XP)', key }];
  const capped = practiceXpToday >= DAILY_PRACTICE_XP_CAP;
  if (a.correct && a.confidence !== 'chute' && a.confidence !== 'nao_consegui') {
    const amount = capped ? 0 : a.confidence === 'certeza' && a.hintsUsed === 0 ? 10 : 6;
    ev.push({ ts: a.ts, amount, reason: capped ? 'Meta diária de prática atingida — descansar também é aprender' : amount === 10 ? 'Acerto com segurança' : 'Acerto', key });
  } else if (a.correct) ev.push({ ts: a.ts, amount: 0, reason: 'Acerto por chute: sem XP até a comprovação', key });
  else ev.push({ ts: a.ts, amount: 0, reason: 'Tentativa registrada (o XP vem ao corrigir a dificuldade)', key });
  const priorErr = prev.some((p) => p.skillId === a.skillId && !p.correct);
  if (a.correct && (a.isTwin || a.isNovel) && a.confidence !== 'chute' && a.confidence !== 'nao_consegui') ev.push({ ts: a.ts, amount: priorErr ? 20 : 12, reason: priorErr ? 'Dificuldade corrigida: acerto em questão inédita' : 'Aprendizado comprovado em questão inédita', key: key + ':twin' });
  const order: MasteryState[] = ['nao_estudado', 'desenvolvimento', 'provisorio', 'consistente'];
  if (order.indexOf(after) > order.indexOf(before) && order.indexOf(after) >= 2) ev.push({ ts: a.ts, amount: after === 'consistente' ? 50 : 25, reason: `Novo marco: ${after === 'consistente' ? 'domínio consistente' : 'domínio provisório'}`, key: key + ':m' });
  // Regularidade sustentável: estudou em 3+ dias diferentes nos últimos 7 (no máximo uma vez por dia).
  const days = new Set([...prev, a].filter((p) => a.ts - p.ts < 7 * DAY).map((p) => Math.floor(p.ts / DAY)));
  const today = Math.floor(a.ts / DAY);
  if (days.size >= 3 && !prev.some((p) => Math.floor(p.ts / DAY) === today)) ev.push({ ts: a.ts, amount: 10, reason: 'Regularidade sustentável (3+ dias na semana)', key: `reg-${today}` });
  return ev;
}

export const totalXP = (ev: XPEvent[]) => ev.reduce((s, e) => s + e.amount, 0);
export function levelInfo(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 40)) + 1;
  const cur = 40 * (level - 1) ** 2; const next = 40 * level ** 2;
  return { level, progress: (xp - cur) / (next - cur), toNext: next - xp };
}
export function masteryPoints(attempts: Attempt[]) {
  return allMastery(attempts).reduce((s, m) => s + (m.state === 'consistente' ? 2 : m.state === 'provisorio' ? 1 : 0), 0);
}
export function leagueOf(points: number) {
  let l = LEAGUES[0]; LEAGUES.forEach((x) => { if (points >= x.min) l = x; });
  const idx = LEAGUES.indexOf(l); return { ...l, next: LEAGUES[idx + 1], idx };
}

/** Ranking de escolas normalizado: taxas, não totais — reduz a vantagem de escolas com muitos usuários. */
export function schoolRanking(category?: string) {
  return SCHOOLS.filter((s) => !category || s.category === category).map((s) => {
    const score = Math.round((0.4 * s.accuracy + 0.25 * Math.min(1, s.growth / 0.25) + 0.2 * s.participation + 0.15 * s.regularity) * 1000);
    return { ...s, score, eligible: s.activeStudents >= MIN_PARTICIPANTS };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);
}

export function achievements(attempts: Attempt[], xp: number, reviews: number, essays: number) {
  const m = allMastery(attempts);
  return [
    { id: 'a1', name: 'Primeiro passo', desc: 'Resolver a primeira questão', got: attempts.length >= 1 },
    { id: 'a2', name: 'Detetive do erro', desc: 'Errar e acertar a questão gêmea em seguida', got: attempts.some((a) => a.isTwin && a.correct) },
    { id: 'a3', name: 'Honestidade intelectual', desc: 'Marcar "chutei" ou "não consegui" 3 vezes', got: attempts.filter((a) => a.confidence === 'chute' || a.confidence === 'nao_consegui').length >= 3 },
    { id: 'a4', name: 'Domínio consistente', desc: 'Atingir domínio consistente em uma habilidade', got: m.some((x) => x.state === 'consistente') },
    { id: 'a5', name: 'Memória em dia', desc: 'Revisar 20 flashcards', got: reviews >= 20 },
    { id: 'a6', name: 'Autor(a) em evolução', desc: 'Reescrever uma redação', got: essays >= 1 },
    { id: 'a7', name: 'Multidisciplinar', desc: 'Domínio provisório em 3 disciplinas', got: new Set(m.filter((x) => x.state !== 'nao_estudado' && x.state !== 'desenvolvimento').map((x) => x.skill.subject)).size >= 3 },
    { id: 'a8', name: 'Nível 5', desc: 'Alcançar o nível 5', got: levelInfo(xp).level >= 5 },
  ];
}
