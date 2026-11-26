import { describe, expect, it } from 'vitest';
import { currentStreak, levelFor, longestStreak } from '@/modules/gamification/levels';
import { localDate, periodKey } from '@/modules/quotas/period';
import { essayIndicators, validateFullEvaluation, validatePartialEvaluation, verifyCitations } from '@/modules/essays/validation';
import { scrubPII } from '@/modules/ai/pii';
import { cpeEligible, difficultyFromParamB, errorClassificationOffered, revealPolicy, terciles } from '@/modules/questions/rules';
import { composeCustomExam, scoreExam } from '@/modules/simulations/compose';
import { classifyPlanChange, deriveSubscriptionStatus, effectivePlan, withinWithdrawal } from '@/modules/subscriptions/state';
import { structuralChecks, twinApproved } from '@/modules/twins/checks';
import { nextReview } from '@/modules/reviews/schedule';
import { DEFAULT_ENGINE_PARAMS as P } from '@/modules/mastery/params';
import { newCard, reviewCard } from '@/modules/flashcards/fsrs';

describe('gamificação (9.3/9.5)', () => {
  it('fronteiras de nível e classe', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, className: 'Bronze' });
    expect(levelFor(499).level).toBe(1);
    expect(levelFor(500).level).toBe(2);
    expect(levelFor(2499)).toMatchObject({ level: 5, className: 'Bronze' });
    expect(levelFor(2500)).toMatchObject({ level: 6, className: 'Prata' });
    expect(levelFor(15000)).toMatchObject({ level: 31, className: 'Lendário' });
  });
  it('streak reinicia após interrupção e conta até ontem', () => {
    expect(currentStreak(['2026-03-01', '2026-03-02', '2026-03-03'], '2026-03-03')).toBe(3);
    expect(currentStreak(['2026-03-01', '2026-03-02'], '2026-03-03')).toBe(2);
    expect(currentStreak(['2026-03-01'], '2026-03-03')).toBe(0);
    expect(longestStreak(['2026-03-01', '2026-03-02', '2026-03-05'])).toBe(2);
  });
});

describe('períodos de franquia (15.9)', () => {
  it('virada de dia no fuso de São Paulo', () => {
    const at = new Date('2026-03-02T02:30:00Z'); // 23:30 do dia 1 em SP
    expect(localDate(at)).toBe('2026-03-01');
    expect(periodKey('day', at)).toBe('D:2026-03-01');
    expect(periodKey('month', new Date('2026-04-01T02:00:00Z'))).toBe('M:2026-03');
  });
});

describe('redação: validação estrutural (6.1/7.8)', () => {
  const text = 'A sociedade brasileira enfrenta desafios. Portanto, é necessário que o Estado promova políticas públicas eficazes.';
  const comp = (n: number, score: number) => ({ competency: n, score, justification: 'Justificativa detalhada suficiente para a competência.', citations: ['é necessário que o Estado promova'], strengths: [], improvements: [] });
  const valid = { zeroed: false, zero_reason: null, competencies: [1, 2, 3, 4, 5].map((n) => comp(n, 160)), total: 800, overall_feedback: 'Texto consistente, com pontos a desenvolver.', recommendations: ['Aprofundar repertório.'] };
  it('aceita correção coerente', () => {
    expect(validateFullEvaluation(valid, text).ok).toBe(true);
  });
  it('rejeita nota fora dos incrementos de 40', () => {
    expect(validateFullEvaluation({ ...valid, competencies: [comp(1, 150), ...valid.competencies.slice(1)] }, text).ok).toBe(false);
  });
  it('rejeita total incoerente', () => {
    expect(validateFullEvaluation({ ...valid, total: 840 }, text).ok).toBe(false);
  });
  it('rejeita citação inexistente no texto', () => {
    const bad = { ...valid, competencies: valid.competencies.map((c) => ({ ...c, citations: ['frase inventada pela IA'] })) };
    expect(validateFullEvaluation(bad, text).ok).toBe(false);
  });
  it('zero exige motivo e total 0', () => {
    expect(validateFullEvaluation({ ...valid, zeroed: true, zero_reason: null }, text).ok).toBe(false);
  });
  it('citações normalizam espaços/aspas/caixa', () => {
    expect(verifyCitations('O “Estado”   deve agir.', ['o "estado" deve agir']).valid).toBe(true);
  });
  it('parcial exige mesma competência', () => {
    const p = { competency: 3, improved: 'yes', estimated_score: 160, justification: 'Melhorou a progressão argumentativa claramente.', citations: [], next_steps: ['Manter.'] };
    expect(validatePartialEvaluation(p, text, 3).ok).toBe(true);
    expect(validatePartialEvaluation(p, text, 4).ok).toBe(false);
  });
  it('indicadores: última, média, máxima', () => {
    const r = essayIndicators([
      { total: 600, c: [120, 120, 120, 120, 120], at: new Date('2026-01-01') },
      { total: 800, c: [160, 160, 160, 160, 160], at: new Date('2026-02-01') },
    ]);
    expect(r).toMatchObject({ last: 800, average: 700, max: 800 });
  });
});

describe('privacidade nas chamadas de IA (13.4)', () => {
  it('remove e-mail, CPF, telefone e nome', () => {
    const r = scrubPII('Sou Maria Souza, maria@ex.com, CPF 123.456.789-09, tel (27) 99999-1234.', { names: ['Maria Souza'] });
    expect(r.text).not.toMatch(/maria|Souza|@|123\.456|99999/i);
  });
});

describe('regras de questões (2.4/2.6/2.7/3.7)', () => {
  it('CPE somente em erro médio/difícil de LC/CH', () => {
    expect(cpeEligible({ areaCode: 'LC', difficulty: 'hard', isCorrect: false })).toBe(true);
    expect(cpeEligible({ areaCode: 'CH', difficulty: 'easy', isCorrect: false })).toBe(false);
    expect(cpeEligible({ areaCode: 'MT', difficulty: 'hard', isCorrect: false })).toBe(false);
    expect(cpeEligible({ areaCode: 'LC', difficulty: 'hard', isCorrect: true })).toBe(false);
  });
  it('classificação opcional somente em MT/CN', () => {
    expect(errorClassificationOffered({ areaCode: 'CN', isCorrect: false })).toBe(true);
    expect(errorClassificationOffered({ areaCode: 'LC', isCorrect: false })).toBe(false);
  });
  it('tercis de NU_PARAM_B', () => {
    const cuts = terciles([-1, 0, 1, 2, 3, 4])!;
    expect(difficultyFromParamB(-1, cuts)).toBe('easy');
    expect(difficultyFromParamB(4, cuts)).toBe('hard');
  });
  it('correção por modalidade', () => {
    expect(revealPolicy('single')).toBe('after_submit');
    expect(revealPolicy('list')).toBe('after_finish');
    expect(revealPolicy('exam')).toBe('after_finish');
  });
});

describe('simulados (5.9/8.8)', () => {
  it('prioriza inéditas e respeita idioma', () => {
    const cands = [
      { id: 'a', areaCode: 'LC', difficulty: 'easy' as const, seen: true, language: null },
      { id: 'b', areaCode: 'LC', difficulty: 'easy' as const, seen: false, language: null },
      { id: 'c', areaCode: 'LC', difficulty: 'medium' as const, seen: false, language: 'es' },
    ];
    const r = composeCustomExam({ candidates: cands, perArea: { LC: 2 }, language: 'en' });
    expect(r.itemIds).toEqual(['b', 'a']);
  });
  it('pontuação por acertos, anuladas fora do total, sem TRI', () => {
    const r = scoreExam([
      { questionId: '1', areaCode: 'MT', selected: 'A', correct: 'A', annulled: false },
      { questionId: '2', areaCode: 'MT', selected: 'B', correct: 'C', annulled: false },
      { questionId: '3', areaCode: 'MT', selected: null, correct: 'C', annulled: true },
    ]);
    expect(r).toMatchObject({ correct: 1, total: 2, percent: 50 });
    expect(Object.keys(r)).not.toContain('tri');
  });
});

describe('assinaturas (13.7/15.9)', () => {
  const now = new Date('2026-05-10T12:00:00Z');
  const pay = (status: string, due: string, paid?: string) => ({ status, dueDate: new Date(due), paidAt: paid ? new Date(paid) : null, refundedAt: null });
  const sub = { cycle: 'monthly' as const, cancelAtPeriodEnd: false, canceledAt: null };
  it('pagamento confirmado ativa até o fim do ciclo', () => {
    expect(deriveSubscriptionStatus(sub, [pay('CONFIRMED', '2026-05-01', '2026-05-01')], now, 3)).toMatchObject({ status: 'active' });
  });
  it('eventos fora de ordem produzem o mesmo estado', () => {
    const a = deriveSubscriptionStatus(sub, [pay('CONFIRMED', '2026-04-01', '2026-04-01'), pay('CONFIRMED', '2026-05-01', '2026-05-01')], now, 3);
    const b = deriveSubscriptionStatus(sub, [pay('CONFIRMED', '2026-05-01', '2026-05-01'), pay('CONFIRMED', '2026-04-01', '2026-04-01')], now, 3);
    expect(a).toEqual(b);
  });
  it('vencida: tolerância de 3 dias e depois expira', () => {
    const p = [pay('CONFIRMED', '2026-04-01', '2026-04-01'), pay('OVERDUE', '2026-05-08')];
    expect(deriveSubscriptionStatus(sub, p, now, 3).status).toBe('past_due');
    expect(deriveSubscriptionStatus(sub, p, new Date('2026-05-12T00:00:00Z'), 3).status).toBe('expired');
  });
  it('plano efetivo: acesso temporário e cancelamento ao fim do período', () => {
    const grant = { planCode: 'pro' as const, startsAt: new Date('2026-05-01'), endsAt: new Date('2026-06-01'), revokedAt: null };
    expect(effectivePlan(null, [grant], now)).toMatchObject({ plan: 'pro', source: 'grant' });
    const canceled = { planCode: 'plus' as const, cycle: 'monthly' as const, status: 'canceled' as const, currentPeriodEnd: new Date('2026-06-01'), cancelAtPeriodEnd: true, canceledAt: now, graceUntil: null };
    expect(effectivePlan(canceled, [], now).plan).toBe('plus');
    expect(effectivePlan(canceled, [], new Date('2026-06-02')).plan).toBe('free');
  });
  it('arrependimento 7 dias e tipo de troca de plano', () => {
    expect(withinWithdrawal(new Date('2026-05-05'), now)).toBe(true);
    expect(withinWithdrawal(new Date('2026-04-20'), now)).toBe(false);
    expect(classifyPlanChange('plus', 'pro')).toBe('upgrade_immediate');
    expect(classifyPlanChange('pro', 'plus')).toBe('downgrade_at_period_end');
  });
});

describe('gêmeas (7.6)', () => {
  const draft = { statement: 'Um corpo de massa 2 kg parte do repouso e sofre força resultante constante de 10 N durante 3 s. Qual é a velocidade final?', alternatives: ['5 m/s', '10 m/s', '15 m/s', '20 m/s', '30 m/s'].map((t, i) => ({ letter: 'ABCDE'[i] as 'A', text: t })), correct: 'C' as const, solution: 'a = F/m = 5 m/s²; v = a·t = 15 m/s. Alternativa C.', difficulty: 'easy' as const };
  it('checagens estruturais e aprovação exige validação independente', () => {
    const s = structuralChecks(draft, 'Texto oficial completamente diferente sobre ecologia e biomas brasileiros.');
    expect(s.ok).toBe(true);
    const v = { verdict: 'approved' as const, unique_correct_answer: true, answer_matches_key: true, same_skill_and_reasoning: true, statement_clear: true, solution_correct: true, issues: [] };
    expect(twinApproved(s, v)).toBe(true);
    expect(twinApproved(s, { ...v, unique_correct_answer: false })).toBe(false);
  });
  it('rejeita cópia da questão de origem', () => {
    expect(structuralChecks(draft, draft.statement).checks.not_copy_of_origin).toBe(false);
  });
});

describe('revisões curriculares e FSRS (15.7)', () => {
  it('escada avança com sucesso após vencimento e reinicia em falha', () => {
    const at = new Date('2026-01-01T00:00:00Z');
    const first = nextReview({ current: null, evidenceScore: 100, at, relevance: 'medium', proximityMultiplier: 1, params: P });
    expect(first.intervalDays).toBe(1);
    const second = nextReview({ current: first, evidenceScore: 100, at: new Date(first.dueAt.getTime() + 1000), relevance: 'medium', proximityMultiplier: 1, params: P });
    expect(second).toMatchObject({ ladderIndex: 1, satisfiedDue: true });
    const fail = nextReview({ current: second, evidenceScore: 0, at: new Date(second.dueAt.getTime() + 1000), relevance: 'medium', proximityMultiplier: 1, params: P });
    expect(fail.ladderIndex).toBe(0);
  });
  it('FSRS: Bom agenda para o futuro; Errei gera lapso', async () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const c = await newCard(now);
    const good = await reviewCard(c, 'good', now);
    expect(new Date(good.card.dueAt).getTime()).toBeGreaterThan(now.getTime());
    const again = await reviewCard(good.card, 'again', new Date('2026-01-06T00:00:00Z'));
    expect(again.card.lapses).toBe(1);
    expect(again.elapsedDays).toBeCloseTo(5, 3);
  });
});
