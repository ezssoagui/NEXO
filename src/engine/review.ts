import type { Attempt, CardState, Flashcard, SkillReview } from '../types';
import { QUESTIONS } from '../data/questions';
import { isDue, retention } from './srs';
import { allMastery } from './mastery';
import { detectPatterns } from './detective';

/**
 * SESSÃO DE REVISÃO ESPAÇADA E INTERCALADA
 * Combina flashcards vencidos, questões inéditas e de recuperação das habilidades com revisão vencida,
 * conteúdos dominados há tempo sem contato e erros recorrentes. Alterna disciplinas e mistura conteúdos recentes e antigos.
 */
export type ReviewItem =
  | { kind: 'card'; id: string; subject: string; reason: string }
  | { kind: 'question'; qid: string; subject: string; reason: 'inedita' | 'recuperacao' | 'erro_recorrente' | 'dominado_antigo' };
export const REVIEW_REASON: Record<string, string> = { inedita: 'Questão inédita da habilidade em revisão', recuperacao: 'Recuperação de conceito (revisão vencida)', erro_recorrente: 'Erro recorrente (Detetive de Erros)', dominado_antigo: 'Conteúdo dominado sem contato há mais de 7 dias' };
const DAY = 86400000;

export function buildInterleaved(input: { attempts: Attempt[]; cards: Flashcard[]; cardStates: Record<string, CardState>; skillReviews: Record<string, SkillReview> }, size = 8, now = Date.now()): ReviewItem[] {
  const { attempts, cards, cardStates, skillReviews } = input;
  const seen = new Set(attempts.map((a) => a.qid));
  const lastTouch = (sk: string) => Math.max(0, ...attempts.filter((a) => a.skillId === sk).map((a) => a.ts));
  const used = new Set<string>();
  const pickQ = (sk: string): { qid: string; novel: boolean } | null => {
    const qs = QUESTIONS.filter((q) => (q.skillId === sk) && q.type === 'objetiva' && !used.has(q.id));
    const unseen = qs.find((q) => !seen.has(q.id));
    if (unseen) return { qid: unseen.id, novel: true };
    // recuperação: questão já vista há mais de 3 dias (não a mais recente)
    const old = qs.map((q) => ({ q, t: Math.max(0, ...attempts.filter((a) => a.qid === q.id).map((a) => a.ts)) })).filter((x) => now - x.t > 3 * DAY).sort((a, b) => a.t - b.t)[0];
    return old ? { qid: old.q.id, novel: false } : null;
  };
  const questions: ReviewItem[] = [];
  const pushQ = (sk: string, reason: Exclude<Extract<ReviewItem, { kind: 'question' }>['reason'], 'inedita' | 'recuperacao'> | 'auto') => {
    const p = pickQ(sk); if (!p) return; used.add(p.qid);
    const q = QUESTIONS.find((x) => x.id === p.qid)!;
    questions.push({ kind: 'question', qid: p.qid, subject: q.subject, reason: reason === 'auto' ? (p.novel ? 'inedita' : 'recuperacao') : reason });
  };
  Object.entries(skillReviews).filter(([, r]) => r.due <= now).sort((a, b) => a[1].due - b[1].due).forEach(([sk]) => pushQ(sk, 'auto'));
  detectPatterns(attempts).filter((i) => i.skillId).slice(0, 2).forEach((i) => pushQ(i.skillId!, 'erro_recorrente'));
  allMastery(attempts).filter((m) => (m.state === 'provisorio' || m.state === 'consistente') && now - lastTouch(m.skillId) > 7 * DAY).forEach((m) => pushQ(m.skillId, 'dominado_antigo'));

  const due = cards.filter((c) => cardStates[c.id] && isDue(cardStates[c.id], now)).sort((a, b) => (retention(cardStates[a.id], now) ?? 1) - (retention(cardStates[b.id], now) ?? 1));
  const fresh = cards.filter((c) => !cardStates[c.id]);
  const cardItems: ReviewItem[] = [...due, ...fresh.slice(0, 3)].map((c) => ({ kind: 'card', id: c.id, subject: c.subject, reason: cardStates[c.id] ? 'Flashcard vencido' : 'Flashcard novo' }));

  const nQ = Math.min(questions.length, Math.max(2, Math.round(size * 0.4)));
  const pool = [...questions.slice(0, nQ), ...cardItems.slice(0, size - Math.min(nQ, questions.length))].slice(0, size);
  // Intercalar: evitar duas seguidas da mesma disciplina e alternar cartões e questões.
  const out: ReviewItem[] = [];
  while (pool.length) {
    const prev = out[out.length - 1];
    let i = pool.findIndex((x) => !prev || (x.subject !== prev.subject && x.kind !== prev.kind));
    if (i < 0) i = pool.findIndex((x) => !prev || x.subject !== prev.subject);
    if (i < 0) i = 0;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
