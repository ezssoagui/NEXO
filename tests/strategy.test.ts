import { describe, expect, it } from 'vitest';
import { tierOf } from '../src/data/incidence';
import { examDate, exerciseLoad, nextUnseen, priorityWeight, studyLevel, studyPhase } from '../src/engine/strategy';
import { buildSession, weekPlan } from '../src/engine/recommend';
import { evaluateEssay } from '../src/engine/essay';
import { DEMO_ESSAYS, ESSAY_THEMES } from '../src/data/essays';
import { PERSONAS } from '../src/store/seed';
import { attempt } from './helpers';

const DAY = 86400000;
const profile = { ...PERSONAS.iniciante.profile, examYear: 2027 };
const exam = examDate(2027).getTime();
const tries = (n: number, correct: boolean) => Array.from({ length: n }, (_, i) => attempt('q01', 'A', 'certeza', { skillId: 'mat-proporcao', correct, evidence: correct ? 'confianca_declarada' : 'erro_conceitual', ts: 1e12 + i * DAY }));

describe('incidência', () => {
  it('ordena assuntos e depende do objetivo', () => {
    expect(tierOf('bio-ecologia')).toBe('alta'); expect(tierOf('qui-estequiometria')).toBe('alta');
    expect(tierOf('bio-genetica')).toBe('baixa'); expect(tierOf('mat-probabilidade')).toBe('media');
    expect(priorityWeight('bio-ecologia')).toBeGreaterThan(priorityWeight('bio-genetica'));
    expect(priorityWeight('bio-ecologia', 'Olimpíadas')).toBe(1);
  });
});
describe('carga de exercícios', () => {
  it('não encerra cedo, encerra com segurança e respeita o teto', () => {
    expect(exerciseLoad('mat-proporcao', tries(5, true)).enough).toBe(false);
    expect(exerciseLoad('mat-proporcao', tries(15, true)).enough).toBe(true);
    expect(exerciseLoad('mat-proporcao', tries(15, false)).enough).toBe(false);
    expect(exerciseLoad('mat-proporcao', tries(50, false)).enough).toBe(true);
    expect(studyLevel('mat-proporcao', [])).toBe(0);
  });
  it('começa pelas questões mais fáceis', () => { expect(nextUnseen('mat-proporcao', [])?.difficulty).not.toBe('Difícil'); });
});
describe('fases', () => {
  it.each([[120, 'base'], [90, 'consolidacao'], [30, 'reta_final'], [2, 'descanso'], [0, 'descanso'], [-30, 'pos']] as const)('%i dias → %s', (d, p) => {
    expect(studyPhase(profile, exam - d * DAY + 12 * 3600000).phase).toBe(p);
  });
  it('a data estimada é o primeiro domingo de novembro', () => { for (let y = 2025; y < 2035; y++) { expect(examDate(y).getDay()).toBe(0); expect(examDate(y).getDate()).toBeLessThan(8); } });
});
describe('sessão e semana', () => {
  const h = [attempt('q01', 'A', 'duvida', { correct: false, ts: exam - 200 * DAY })];
  it('cabe no tempo em todas as fases', () => {
    for (const min of [5, 10, 20, 40] as const) for (const d of [200, 60, 20, 1]) for (const hist of [[], h]) {
      const s = buildSession(min, hist, profile, exam - d * DAY);
      expect(s.steps.length).toBeGreaterThan(0);
      expect(s.steps.reduce((t, x) => t + x.minutes, 0)).toBeLessThanOrEqual(min + 2);
    }
  });
  it('recorda antes de explicar e não traz aula na reta final', () => {
    expect(buildSession(20, h, { ...profile, difficulties: [] }, exam - 200 * DAY).steps[0].kind).toBe('recordacao');
    expect(buildSession(40, h, profile, exam - 20 * DAY).steps.some((s) => s.kind === 'explicacao')).toBe(false);
    expect(buildSession(40, h, profile, exam - 1 * DAY).steps.map((s) => s.kind)).toEqual(['flashcards']);
  });
  it('sexta é pendência/revisão e domingo é livre', () => {
    const w = weekPlan(profile, h, exam - 200 * DAY);
    expect(w).toHaveLength(7); expect(w[4].tasks[0]).toMatch(/Pendências/); expect(w[6].minutes).toBe(0);
  });
});
describe('redação', () => {
  const th = ESSAY_THEMES[0]; const e = DEMO_ESSAYS.find((x) => x.themeId === th.id)!;
  it('limita C2 quando falta parte do tema', () => {
    const no = evaluateEssay(e.text.replace(/brasil[a-zà-ú]*|nacional|país(es)?/gi, 'local'), th);
    const c2 = no.competencies.find((c) => c.id === 'C2')!;
    expect(c2.score).toBeLessThanOrEqual(120); expect(c2.points.join()).toContain('Brasil');
  });
  it('não aponta partes ausentes em um texto que aborda todo o tema', () => {
    expect(evaluateEssay(e.text, th).competencies.find((c) => c.id === 'C2')!.points.join()).not.toContain('não identificadas');
  });
});
