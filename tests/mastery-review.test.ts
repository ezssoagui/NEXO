import { describe, expect, it } from 'vitest';
import { skillMastery } from '../src/engine/mastery';
import { schedule, scheduleSkill } from '../src/engine/srs';
import { buildInterleaved } from '../src/engine/review';
import { FLASHCARDS } from '../src/data/flashcards';
import { attempt } from './helpers';

const DAY = 86400000;
describe('Radar de Domínio baseado em evidências', () => {
  it('um único acerto não eleva além de "em desenvolvimento"', () => {
    expect(skillMastery([attempt('q01', 'C', 'certeza')], 'fis-potencia').state).toBe('desenvolvimento');
  });
  it('acerto com dúvida pesa menos que acerto confiante, e chute não conta', () => {
    const conf = skillMastery([attempt('q01', 'C', 'certeza')], 'fis-potencia').score;
    const duv = skillMastery([attempt('q01', 'C', 'duvida')], 'fis-potencia').score;
    const ch = skillMastery([attempt('q01', 'C', 'chute')], 'fis-potencia').score;
    expect(conf).toBeGreaterThan(duv); expect(duv).toBeGreaterThan(ch); expect(ch).toBe(0);
  });
  it('acerto frágil é sinalizado', () => {
    const m = skillMastery([attempt('q01', 'C', 'certeza', { ts: 1 }), attempt('q02', 'D', 'duvida', { ts: 2 })], 'fis-potencia');
    expect(m.fragile).toBe(true);
  });
  it('detecta domínio aparente com falha posterior (regressão)', () => {
    const t = Date.now();
    const list = [attempt('q01', 'C', 'certeza', { ts: t - 3 * DAY }), attempt('q02', 'D', 'certeza', { ts: t - 2 * DAY, isTwin: true }), attempt('q31', 'A', 'certeza', { ts: t, isNovel: true })];
    const m = skillMastery(list, 'fis-potencia');
    expect(m.regressed).toBe(true);
  });
});

describe('Revisão espaçada adaptativa', () => {
  it('intervalos crescem com acertos seguros e caem com erros; facilidade é individual', () => {
    let s = schedule(undefined, 'seguro', 0).state; expect(s.interval).toBe(2);
    s = schedule(s, 'seguro', s.due).state; expect(s.interval).toBeGreaterThanOrEqual(4);
    const e = schedule(s, 'errei', s.due).state; expect(e.interval).toBe(0); expect(e.ease!).toBeLessThan(s.ease!);
  });
  it('conteúdo difícil para o aluno recebe intervalo menor', () => {
    const base = schedule(schedule(undefined, 'seguro', 0).state, 'seguro', 2 * DAY);
    const hard = schedule(schedule(undefined, 'seguro', 0).state, 'seguro', 2 * DAY, { difficulty: 1 });
    expect(hard.state.interval!).toBeLessThan(base.state.interval!);
  });
  it('revisão livre não altera a programação', () => {
    const s = schedule(undefined, 'seguro', 0).state;
    const f = schedule(s, 'errei', DAY, { free: true });
    expect(f.state.due).toBe(s.due); expect(f.state.reviews.length).toBe(2);
  });
  it('agenda revisão de habilidade conforme a evidência', () => {
    const wrong = scheduleSkill(undefined, attempt('q01', 'B', 'certeza', { ts: 0 }));
    expect(wrong.review.interval).toBe(1);
    const novel = scheduleSkill(wrong.review, attempt('q02', 'D', 'certeza', { ts: DAY, isTwin: true }));
    expect(novel.review.interval).toBeGreaterThanOrEqual(3);
    const free = scheduleSkill(novel.review, attempt('q31', 'B', 'certeza', { free: true }));
    expect(free.review).toEqual(novel.review);
  });
  it('sessão intercalada mistura questões e cartões alternando disciplinas', () => {
    const now = Date.now();
    const attempts = [attempt('q01', 'B', 'certeza', { ts: now - 5 * DAY }), attempt('q17', 'A', 'certeza', { ts: now - 5 * DAY })];
    const cardStates = Object.fromEntries(FLASHCARDS.slice(0, 6).map((c) => [c.id, schedule(undefined, 'duvida', now - 10 * DAY).state]));
    const items = buildInterleaved({ attempts, cards: FLASHCARDS, cardStates, skillReviews: { 'fis-potencia': { due: now - DAY, interval: 1, ease: 2, lapses: 1 }, 'mat-porcentagem': { due: now - DAY, interval: 1, ease: 2, lapses: 1 } } }, 8, now);
    expect(items.some((i) => i.kind === 'question')).toBe(true); expect(items.some((i) => i.kind === 'card')).toBe(true);
    expect(items.length).toBeLessThanOrEqual(8);
  });
});
