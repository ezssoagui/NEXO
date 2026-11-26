import { describe, expect, it } from 'vitest';
import { computePriority, effectiveWeights, rankRecommendations, type SkillSnapshot, type SubtopicSnapshot } from '@/modules/adaptive-engine/priority';
import { planSession, questionQuantity, splitByDifficulty } from '@/modules/adaptive-engine/composition';
import { DEFAULT_ENGINE_PARAMS as P } from '@/modules/mastery/params';

const skill = (o: Partial<SkillSnapshot> = {}): SkillSnapshot => ({
  skillId: 's' + Math.random(), state: 'not_assessed', d: null, r: null, c: null, t: null, m: null, easyAccuracy: null, easyIndependentCount: 0, ...o,
});
const sub = (o: Partial<SubtopicSnapshot> = {}): SubtopicSnapshot => ({
  subtopicId: 'st', name: 'X', areaCode: 'CN', relevance: 'high', skills: [skill(), skill()], recentAttempts: [], lessonReads: 0,
  review: { dueSkills: 0, maxOverdueRatio: -1 }, connections: 0, ...o,
});
const decide = (s: SubtopicSnapshot) => computePriority(s, { daysToExam: null }, P);

describe('casos pedagógicos (15.12)', () => {
  it('conteúdo nunca estudado → Aprender/exploração', () => {
    expect(decide(sub())).toMatchObject({ category: 'learn', focus: 'exploration' });
  });
  it('erro em questões fáceis → fundamentos', () => {
    const r = decide(sub({ skills: [skill({ state: 'learning', d: 30, r: 30, easyAccuracy: 20, easyIndependentCount: 3 }), skill({ state: 'learning', d: 40, r: 40 })] }));
    expect(r).toMatchObject({ category: 'improve', focus: 'fundamentals' });
  });
  it('acerto com explicação incorreta → compreensão', () => {
    const r = decide(sub({ skills: [skill({ state: 'provisional', d: 72, r: 85, c: 33 }), skill({ state: 'learning', d: 70, r: 80, c: 33 })] }));
    expect(r).toMatchObject({ category: 'improve', focus: 'comprehension' });
  });
  it('teoria sem aplicação → transferência', () => {
    const r = decide(sub({ lessonReads: 2, skills: [skill({ state: 'learning', c: 80 }), skill({ state: 'learning', c: 70 })] }));
    expect(r).toMatchObject({ focus: 'transfer' });
  });
  it('perda de retenção demonstrada → revisão', () => {
    const r = decide(sub({ skills: [skill({ state: 'provisional', d: 75, r: 90, m: 20 }), skill({ state: 'provisional', d: 75, r: 90, m: 30 })] }));
    expect(r).toMatchObject({ category: 'review', focus: 'retention' });
  });
  it('domínio alto → manutenção/aprofundamento', () => {
    const r = decide(sub({ skills: [skill({ state: 'consolidated', d: 92, r: 95, c: 90, m: 90 }), skill({ state: 'consolidated', d: 90, r: 92, c: 88, m: 85 })] }));
    expect(r).toMatchObject({ category: 'deepen', focus: 'maintenance', level: 'maintenance' });
  });
  it('padrão de erros recentes (5 de 10) → recuperação', () => {
    const recent = Array.from({ length: 10 }, (_, i) => ({ isCorrect: i % 2 === 0, difficulty: 'medium' as const }));
    const r = decide(sub({ recentAttempts: recent, skills: [skill({ state: 'learning', d: 50, r: 50 }), skill({ state: 'learning', d: 55, r: 55 })] }));
    expect(r).toMatchObject({ category: 'improve', focus: 'recovery' });
  });
  it('ausência prolongada → retomada normal (motor não depende do relógio)', () => {
    const s = sub({ skills: [skill({ state: 'learning', d: 60, r: 60 }), skill({ state: 'learning', d: 62, r: 62 })] });
    expect(decide(s)).toEqual(decide(s));
    expect(decide(s).focus).toBe('practice');
  });
});

describe('prioridade (15.5)', () => {
  it('pesos 30/25/20/15/10 e ausência de evidência usa prior, não zero', () => {
    const r = decide(sub());
    expect(r.factors.difficulty).toBe(0.5);
    expect(r.priority).toBeCloseTo(0.3 * 0.5 + 0.25 * 1 + 0.15 * 1, 4);
  });
  it('proximidade da prova aumenta o peso de revisão e renormaliza', () => {
    const w = effectiveWeights(5, P);
    expect(w.review).toBeGreaterThan(0.2);
    expect(w.difficulty + w.relevance + w.review + w.coverage + w.connections).toBeCloseTo(1, 6);
  });
  it('relevância desconhecida não é tratada como baixa', () => {
    expect(decide(sub({ relevance: 'unknown' })).factors.relevance).toBeGreaterThan(decide(sub({ relevance: 'low' })).factors.relevance);
  });
  it('ordenação determinística com desempate', () => {
    const a = { ...decide(sub({ subtopicId: 'b' })) };
    const b = { ...decide(sub({ subtopicId: 'a' })) };
    expect(rankRecommendations([a, b]).map((x) => x.subtopicId)).toEqual(['a', 'b']);
  });
});

describe('composição da sessão (4.4/4.5)', () => {
  const qs = (n: number, difficulty: 'easy' | 'medium' | 'hard', seen = false) => Array.from({ length: n }, (_, i) => ({ id: `${difficulty}${i}${seen}`, difficulty, seen }));
  it('matriz experimental de quantidade', () => {
    expect(questionQuantity('very_high', 'high', 'practice', P)).toBe(15);
    expect(questionQuantity('maintenance', 'low', 'maintenance', P)).toBe(1);
    expect(questionQuantity('high', 'high', 'comprehension', P)).toBe(3);
  });
  it('divisão por dificuldade soma n', () => {
    const s = splitByDifficulty(7, { easy: 0.5, medium: 0.35, hard: 0.15 });
    expect(s.easy + s.medium + s.hard).toBe(7);
  });
  it('omite teoria quando já há compreensão suficiente', () => {
    const plan = planSession({ focus: 'exploration', category: 'learn', level: 'punctual', relevance: 'high', subtopicId: 'st', comprehension: 90,
      candidates: { questions: qs(10, 'easy'), lessons: [{ id: 'L', kind: 'microlesson', accessible: true }], conceptActivities: [], flashcardsDue: 0 }, params: P });
    expect(plan.activities.some((a) => a.activityType === 'lesson')).toBe(false);
  });
  it('transferência usa apenas itens inéditos e registra falta', () => {
    const plan = planSession({ focus: 'transfer', category: 'deepen', level: 'moderate', relevance: 'high', subtopicId: 'st', comprehension: null,
      candidates: { questions: [...qs(3, 'hard'), ...qs(10, 'medium', true)], lessons: [], conceptActivities: [], flashcardsDue: 4 }, params: P });
    expect(plan.activities.filter((a) => a.activityType === 'question')).toHaveLength(3);
    expect(plan.shortfall.questions).toBe(7);
    expect(plan.alternatives).toContain('flashcards');
  });
  it('sessão conceitual pode não ter questões e aceita atividade única', () => {
    const plan = planSession({ focus: 'comprehension', category: 'improve', level: 'high', relevance: 'low', subtopicId: 'st', comprehension: 20,
      candidates: { questions: [], lessons: [], conceptActivities: [{ id: 'C', answered: false }], flashcardsDue: 0 }, params: P });
    expect(plan.activities).toEqual([{ activityType: 'concept_activity', refType: 'concept_activity', refId: 'C' }]);
  });
  it('revisão: recuperação ativa antes da teoria', () => {
    const plan = planSession({ focus: 'retention', category: 'review', level: 'punctual', relevance: 'medium', subtopicId: 'st', comprehension: 80,
      candidates: { questions: qs(5, 'medium'), lessons: [{ id: 'S', kind: 'summary', accessible: true }], conceptActivities: [], flashcardsDue: 6 }, params: P });
    expect(plan.activities[0]!.activityType).toBe('flashcards');
    expect(plan.activities.at(-1)!.activityType).toBe('summary');
  });
});
