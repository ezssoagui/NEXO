import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDbForTests, asService, asUser } from '@/server/db';
import { seedDevelopment } from '@/server/db/seed';
import type { Database } from '@/server/db/types';
import { freshDb, createAuthUser } from './helpers';
import { completeOnboarding, deleteAccount, gamificationSummary, masteryMap, performanceOverview, requiredDocuments, setRanking } from '@/server/services/account';
import { processQuestionAnswer } from '@/server/services/learning';
import { currentRecommendations } from '@/server/services/recommendations';
import { answerSessionQuestion, createSession, startSession } from '@/server/services/sessions';
import { createList, finishList, saveListAnswer, serveQuestion, submitSingle, getCpe, submitCpeStep } from '@/server/services/questions';
import { reviewFlashcard, submitConceptResponse, dueCards, completeLesson } from '@/server/services/content';
import { createEssay, saveDraft, submitEssay } from '@/server/services/essays';
import { createCustomExam, finishExam, saveExamAnswer, startExam, getAttempt, createDiagnostic } from '@/server/services/exams';
import { handleAsaasWebhook, redeemCoupon } from '@/server/services/commerce';
import { userPlan } from '@/server/services/core';
import { setAiTransportForTests } from '@/server/services/ai';
import { resetEnvCache } from '@/config/env';

let db: Database;

async function student(email: string, birthDate = '2000-05-05') {
  const id = await createAuthUser(db, email);
  const docs = await asService((tx) => requiredDocuments(tx));
  await completeOnboarding(id, { displayName: 'Fulana Exemplar', enemTargetYear: 2027, birthDate, foreignLanguage: 'en', acceptedDocumentIds: docs.map((d) => d.id), guardianEmail: 'resp@example.com' });
  return id;
}

async function questionsOf(subtopicName: string) {
  return db.query<{ id: string; correct_alternative: string; difficulty: string; area_code: string }>(
    `select q.id, q.correct_alternative, q.difficulty, q.area_code from questions q join subtopics st on st.id = q.primary_subtopic_id
      where st.name = $1 and q.publication_status = 'published' order by q.difficulty, q.id`, [subtopicName]);
}

const wrong = (c: string) => (c === 'A' ? 'B' : 'A') as 'A' | 'B';

beforeAll(async () => {
  process.env.NEXO_ENV = 'test';
  resetEnvCache();
  db = await freshDb();
  await seedDevelopment(db);
  setDbForTests(db);
  await db.query(`insert into ai_models (purpose, model_id, status, input_usd_per_mtok, output_usd_per_mtok) values
    ('nano','modelo-teste-nano','approved',0.1,0.4), ('mini','modelo-teste-mini','approved',0.25,2), ('essay','modelo-teste-essay','approved',1,8)`);
});

afterAll(async () => {
  setAiTransportForTests(undefined);
  setDbForTests(undefined);
  await db.close();
});

describe('seed e dados de referência', () => {
  it('currículo oficial carregado e conteúdo sintético identificado', async () => {
    const [c] = await db.query<{ subtopics: number; official: number; synthetic: number; nonsynthetic: number }>(
      `select (select count(*)::int from subtopics) as subtopics, (select count(*)::int from official_skills) as official,
              (select count(*)::int from questions where is_synthetic) as synthetic, (select count(*)::int from questions where not is_synthetic) as nonsynthetic`);
    expect(c!.subtopics).toBe(407);
    expect(c!.official).toBe(120);
    expect(c!.synthetic).toBeGreaterThan(50);
    expect(c!.nonsynthetic).toBe(0);
  });
});

describe('pipeline de evidências (A.3.1/2.14)', () => {
  it('registra tentativa, evidência, domínio, caderno de erros e XP sem duplicar', async () => {
    const u = await student('pipe@example.com');
    const qs = await questionsOf('Porcentagem e juros');
    const q = qs[0]!;
    const r1 = await asService((tx) => processQuestionAnswer(tx, { userId: u, questionId: q.id, selected: wrong(q.correct_alternative), mode: 'single', source: 'free', idempotencyKey: 'k1' }));
    expect(r1.isCorrect).toBe(false);
    const dup = await asService((tx) => processQuestionAnswer(tx, { userId: u, questionId: q.id, selected: wrong(q.correct_alternative), mode: 'single', source: 'free', idempotencyKey: 'k1' }));
    expect(dup.duplicate).toBe(true);
    const [counts] = await db.query<{ attempts: number; evidence: number; errors: number; xp: number }>(
      `select (select count(*)::int from attempts where user_id = $1) as attempts, (select count(*)::int from skill_evidence where user_id = $1) as evidence,
              (select count(*)::int from error_entries where user_id = $1) as errors, (select coalesce(sum(xp),0)::int from xp_events where user_id = $1) as xp`, [u]);
    expect(counts).toEqual({ attempts: 1, evidence: 1, errors: 1, xp: 5 });
    // Mesmo item repetido no mesmo dia: nova tentativa, mas XP não duplica (9.7)
    await asService((tx) => processQuestionAnswer(tx, { userId: u, questionId: q.id, selected: q.correct_alternative as 'A', mode: 'single', source: 'free', idempotencyKey: 'k2' }));
    const [xp] = await db.query<{ xp: number; status: string }>(`select (select sum(xp)::int from xp_events where user_id = $1) as xp, (select recovery_status from error_entries where user_id = $1) as status`, [u]);
    expect(xp!.xp).toBe(5);
    expect(xp!.status).toBe('recovering'); // acertar a mesma questão não supera o erro
    // Dois acertos inéditos na mesma habilidade superam o erro (5.7)
    for (const [i, other] of qs.slice(1, 3).entries()) {
      await asService((tx) => processQuestionAnswer(tx, { userId: u, questionId: other.id, selected: other.correct_alternative as 'A', mode: 'single', source: 'free', idempotencyKey: `k3${i}` }));
    }
    const [e] = await db.query<{ recovery_status: string }>('select recovery_status from error_entries where user_id = $1', [u]);
    expect(e!.recovery_status).toBe('overcome');
    const [m] = await db.query<{ state: string }>('select state from mastery_scores where user_id = $1', [u]);
    expect(m!.state).toBe('learning'); // poucas evidências: nunca consolidado
  });
});

describe('recomendações e sessões (4.3/4.4/5.8)', () => {
  it('aluno novo recebe exploração; sessão congela composição; franquia diária de sessões', async () => {
    const u = await student('sess@example.com');
    const recs = await asService((tx) => currentRecommendations(tx, u));
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => r.category === 'learn')).toBe(true);
    const s = await createSession(u, { recommendationId: recs[0]!.id });
    expect(s.status).toBe('planned');
    const started = await startSession(u, s.id);
    expect(started.status).toBe('in_progress');
    await expect(db.query(`insert into session_activities (session_id, position, activity_type, ref_type) values ($1, 99, 'lesson', 'lesson')`, [s.id])).rejects.toThrow(/congelada/);
    const qAct = started.activities.find((a) => a.activity_type === 'question')!;
    const q = await db.query<{ correct_alternative: string }>('select correct_alternative from questions where id = $1', [qAct.ref_id]);
    const ans = await answerSessionQuestion(u, s.id, qAct.position, { selected: q[0]!.correct_alternative as 'A' });
    expect(ans.isCorrect).toBe(true);
    // Gratuito: 2 sessões/dia
    const s2 = await createSession(u, { recommendationId: recs[1]!.id });
    await startSession(u, s2.id);
    const s3 = await createSession(u, { recommendationId: recs[2]!.id });
    await expect(startSession(u, s3.id)).rejects.toMatchObject({ code: 'quota_exceeded' });
  });

  it('padrão de erros gera recomendação de recuperação', async () => {
    const u = await student('recov@example.com');
    const qs = await questionsOf('Lei de Ohm');
    for (const [i, q] of qs.slice(0, 10).entries()) {
      const sel = i % 2 === 0 ? wrong(q.correct_alternative) : (q.correct_alternative as 'A');
      await asService((tx) => processQuestionAnswer(tx, { userId: u, questionId: q.id, selected: sel, mode: 'single', source: 'free', idempotencyKey: `r${i}` }));
    }
    const recs = await asService((tx) => currentRecommendations(tx, u));
    const ohm = recs.find((r) => r.subtopic_name === 'Lei de Ohm');
    expect(ohm?.focus).toBe('recovery');
  });
});

describe('banco de questões e franquias (11.4/2.4)', () => {
  it('20 questões distintas por dia no Gratuito; mesma questão não conta duas vezes', async () => {
    const u = await student('quota@example.com');
    const all = await db.query<{ id: string }>(`select id from questions where publication_status = 'published' order by id limit 21`);
    for (const q of all.slice(0, 20)) await serveQuestion(u, q.id, { kind: 'free' });
    await serveQuestion(u, all[0]!.id, { kind: 'free' });
    await expect(serveQuestion(u, all[20]!.id, { kind: 'free' })).rejects.toMatchObject({ code: 'quota_exceeded' });
    const payload = await serveQuestion(u, all[0]!.id, { kind: 'free' });
    expect(payload).not.toHaveProperty('correct_alternative');
  });

  it('acesso temporário Pro remove o limite e é refletido no plano efetivo', async () => {
    const u = await student('grant@example.com');
    await db.query(`insert into coupons (code, kind, value, plan_code, grant_days) values ('PILOTO30', 'access_grant', 1, 'pro', 30)`);
    await redeemCoupon(u, 'piloto30');
    expect((await asService((tx) => userPlan(tx, u))).plan).toBe('pro');
    await expect(redeemCoupon(u, 'PILOTO30')).rejects.toMatchObject({ code: 'conflict' });
  });

  it('lista manual corrige somente ao final; ausência de resposta não vira erro', async () => {
    const u = await student('list@example.com');
    const l = await createList(u, { mode: 'manual', filters: { areas: ['MT'], status: 'all', page: 1 }, count: 3 });
    expect(l.count).toBe(3);
    const [item] = await db.query<{ question_id: string }>('select question_id from question_list_items where list_id = $1 and position = 1', [l.id]);
    const [q] = await db.query<{ correct_alternative: string }>('select correct_alternative from questions where id = $1', [item!.question_id]);
    await saveListAnswer(u, l.id, 1, q!.correct_alternative, []);
    expect((await db.query('select 1 from attempts where user_id = $1', [u])).length).toBe(0);
    const res = await finishList(u, l.id);
    expect(res.status).toBe('finished');
    expect((await db.query('select 1 from attempts where user_id = $1', [u])).length).toBe(1);
  });

  it('CPE apenas em erro médio/difícil de LC/CH e gera evidência assistida', async () => {
    const u = await student('cpe@example.com');
    const [q] = await db.query<{ id: string; correct_alternative: string }>(
      `select id, correct_alternative from questions where area_code in ('LC','CH') and difficulty = 'hard' and publication_status = 'published' limit 1`);
    const r = await submitSingle(u, { questionId: q!.id, selected: wrong(q!.correct_alternative), idempotencyKey: 'cpe1' });
    expect(r.cpeEligible).toBe(true);
    const before = await asService((tx) => getCpe(tx, u, r.attemptId));
    expect(before.reference).toBeNull(); // sem pistas antes da resposta
    await submitCpeStep(u, r.attemptId, { step: 'comando', text: 'Pede a alternativa correta', selfAssessment: 'correct' });
    await submitCpeStep(u, r.attemptId, { step: 'prova', text: 'rótulo teste', selfAssessment: 'partial' });
    const done = await submitCpeStep(u, r.attemptId, { step: 'eliminacao', eliminations: { A: 'sem respaldo' }, selfAssessment: 'correct' });
    expect(Object.keys(done.reference ?? {})).toEqual(expect.arrayContaining(['comando', 'prova', 'eliminacao']));
    const [ev] = await db.query<{ independence: string }>(`select independence from skill_evidence where user_id = $1 and dimension = 'comprehension'`, [u]);
    expect(ev!.independence).toBe('assisted');
    const [mt] = await db.query<{ id: string; correct_alternative: string }>(`select id, correct_alternative from questions where area_code = 'MT' and difficulty = 'hard' limit 1`);
    const r2 = await submitSingle(u, { questionId: mt!.id, selected: wrong(mt!.correct_alternative), idempotencyKey: 'cpe2' });
    expect(r2.cpeEligible).toBe(false);
    expect(r2.classificationOffered).toBe(true);
  });
});

describe('IA: franquia transacional e falhas (7.8/15.9)', () => {
  it('sucesso consome franquia; saída inválida libera; limite diário do Gratuito', async () => {
    const u = await student('ai@example.com');
    const [act] = await db.query<{ id: string }>(`select id from concept_activities where status = 'published' limit 1`);
    setAiTransportForTests(async () => ({ kind: 'invalid_output', inputTokens: 10, outputTokens: 10, error: 'json_parse' }));
    await expect(submitConceptResponse(u, { activityId: act!.id, response: 'Minha explicação.', idempotencyKey: 'c1' })).rejects.toMatchObject({ code: 'invalid_output' });
    const [q1] = await db.query<{ n: number }>(`select count(*)::int as n from quota_usage where user_id = $1 and status = 'consumed'`, [u]);
    expect(q1!.n).toBe(0);
    setAiTransportForTests(async () => ({ kind: 'ok', json: { score: 2, justification: 'Explicação adequada.', correct_points: [], missing_points: [], misconceptions: [], feedback: 'Muito bom, continue.' }, inputTokens: 500, outputTokens: 100 }));
    const ok = await submitConceptResponse(u, { activityId: act!.id, response: 'Minha explicação.', idempotencyKey: 'c2' });
    expect(ok.score).toBe(2);
    await expect(submitConceptResponse(u, { activityId: act!.id, response: 'Outra.', idempotencyKey: 'c3' })).rejects.toMatchObject({ code: 'quota_exceeded' });
    const [usage] = await db.query<{ n: number; cost: string }>(`select count(*)::int as n, sum(cost_usd)::text as cost from ai_usage where user_id = $1 and status = 'success'`, [u]);
    expect(usage!.n).toBe(1);
    expect(Number(usage!.cost)).toBeCloseTo((500 * 0.1 + 100 * 0.4) / 1e6, 9);
  });

  it('sem chamadas pagas autorizadas: indisponível e franquia não consumida', async () => {
    const u = await student('noai@example.com');
    setAiTransportForTests(undefined);
    const [act] = await db.query<{ id: string }>(`select id from concept_activities where status = 'published' limit 1`);
    await expect(submitConceptResponse(u, { activityId: act!.id, response: 'Texto.', idempotencyKey: 'n1' })).rejects.toMatchObject({ code: 'unavailable' });
    const [q] = await db.query<{ n: number }>(`select count(*)::int as n from quota_usage where user_id = $1 and status in ('consumed','reserved')`, [u]);
    expect(q!.n).toBe(0);
  });
});

describe('redação (6.1/6.8/6.10)', () => {
  const essayText = Array.from({ length: 12 }, (_, i) => `Este é o parágrafo número ${i + 1} da redação de teste, com argumentação suficiente para ocupar mais de uma linha estimada no formato digital.`).join('\n');
  it('texto curto não consome franquia; citação inválida libera; correção válida é armazenada', async () => {
    const u = await student('essay@example.com');
    const [theme] = await db.query<{ id: string }>(`select id from essay_themes where status = 'published' limit 1`);
    const e = await createEssay(u, { themeId: theme!.id });
    await saveDraft({ sub: u, aal: 'aal1' }, e.id, 'Curto demais.');
    await expect(submitEssay(u, e.id, 'e0')).rejects.toMatchObject({ code: 'text_too_short' });
    await saveDraft({ sub: u, aal: 'aal1' }, e.id, essayText);
    const comp = (c: number, citation: string) => ({ competency: c, score: 160, justification: 'Justificativa detalhada da competência.', citations: [citation], strengths: [], improvements: [] });
    setAiTransportForTests(async () => ({ kind: 'ok', json: { zeroed: false, zero_reason: null, total: 800, overall_feedback: 'Boa redação no geral, com ajustes.', recommendations: ['Aprofundar.'], competencies: [1, 2, 3, 4, 5].map((c) => comp(c, 'trecho que não existe')) }, inputTokens: 1, outputTokens: 1 }));
    await expect(submitEssay(u, e.id, 'e1')).rejects.toMatchObject({ code: 'invalid_output' });
    setAiTransportForTests(async () => ({ kind: 'ok', json: { zeroed: false, zero_reason: null, total: 800, overall_feedback: 'Boa redação no geral, com ajustes.', recommendations: ['Aprofundar.'], competencies: [1, 2, 3, 4, 5].map((c) => comp(c, 'parágrafo número 3 da redação de teste')) }, inputTokens: 1, outputTokens: 1 }));
    const ok = await submitEssay(u, e.id, 'e2');
    expect(ok.evaluation.total).toBe(800);
    const [v] = await db.query<{ n: number }>('select count(*)::int as n from essay_versions where essay_id = $1', [e.id]);
    expect(v!.n).toBe(1); // nova tentativa reaproveita a mesma versão
    await expect(submitEssay(u, e.id, 'e3')).rejects.toMatchObject({ code: 'already_evaluated' });
  });
});

describe('simulados e diagnóstico (5.9/2.2/8.8)', () => {
  it('simulado personalizado: sem correção antes do fim; resultado por acertos; franquia mensal', async () => {
    const u = await student('exam@example.com');
    const ex = await createCustomExam(u, { perArea: { MT: 4, CN: 2 }, timed: false });
    const { attemptId } = await startExam(u, ex.examId, 'none');
    const before = await asService((tx) => getAttempt(tx, u, attemptId));
    expect(before.answers[0]).not.toHaveProperty('correct_alternative');
    await saveExamAnswer(u, attemptId, { position: 1, selected: 'A' });
    const after = await finishExam(u, attemptId);
    expect(after.status).toBe('finished');
    expect((after.result as { total: number }).total).toBe(6);
    expect(after.result).not.toHaveProperty('tri');
    const ex2 = await createCustomExam(u, { perArea: { MT: 2 }, timed: false });
    await expect(startExam(u, ex2.examId, 'none')).rejects.toMatchObject({ code: 'quota_exceeded' });
    const diag = await createDiagnostic(u); // diagnóstico não consome franquia (proposta A.2)
    expect(diag.attemptId).toBeTruthy();
  });
});

describe('flashcards e aulas (5.6/5.1)', () => {
  it('revisão FSRS idempotente, XP por cartão/dia; leitura não gera evidência', async () => {
    const u = await student('fc@example.com');
    const cards = await asService((tx) => dueCards(tx, u, { limit: 5 }));
    expect(cards.length).toBeGreaterThan(0);
    await reviewFlashcard(u, { cardId: cards[0]!.id, rating: 'good', idempotencyKey: 'f1' });
    const dup = await reviewFlashcard(u, { cardId: cards[0]!.id, rating: 'good', idempotencyKey: 'f1' });
    expect(dup).toEqual({ duplicate: true });
    const [lesson] = await db.query<{ id: string }>(`select id from lessons where kind = 'microlesson' limit 1`);
    await completeLesson(u, lesson!.id);
    const [c] = await db.query<{ logs: number; evidence: number }>(`select (select count(*)::int from review_logs where user_id = $1) as logs, (select count(*)::int from skill_evidence where user_id = $1) as evidence`, [u]);
    expect(c).toEqual({ logs: 1, evidence: 0 });
  });
});

describe('pagamentos: webhook Asaas (15.9)', () => {
  it('token inválido rejeitado; eventos idempotentes; estado derivado dos pagamentos', async () => {
    process.env.ASAAS_WEBHOOK_TOKEN = 'token-de-teste-webhook';
    resetEnvCache();
    const u = await student('pay@example.com');
    const [sub] = await db.query<{ id: string }>(`insert into subscriptions (user_id, plan_code, cycle, status, provider_subscription_id, price_cents) values ($1,'plus','monthly','pending','sub_test_1', 1000) returning id`, [u]);
    const payload = (id: string, event: string, status: string, due: string) => ({ id, event, payment: { id: `pay_${due}`, subscription: 'sub_test_1', customer: 'cus_1', value: 10, status, dueDate: due, confirmedDate: status === 'CONFIRMED' ? due : null } });
    await expect(handleAsaasWebhook('errado', payload('evt_0', 'PAYMENT_CONFIRMED', 'CONFIRMED', '2026-11-20'))).rejects.toMatchObject({ code: 'invalid_webhook_token' });
    const today = new Date().toISOString().slice(0, 10);
    expect((await handleAsaasWebhook('token-de-teste-webhook', payload('evt_1', 'PAYMENT_CONFIRMED', 'CONFIRMED', today))).status).toBe('processed');
    expect((await handleAsaasWebhook('token-de-teste-webhook', payload('evt_1', 'PAYMENT_CONFIRMED', 'CONFIRMED', today))).status).toBe('duplicate');
    const [s] = await db.query<{ status: string }>('select status from subscriptions where id = $1', [sub!.id]);
    expect(s!.status).toBe('active');
    expect((await asService((tx) => userPlan(tx, u))).plan).toBe('plus');
    const [p] = await db.query<{ n: number }>('select count(*)::int as n from payments where subscription_id = $1', [sub!.id]);
    expect(p!.n).toBe(1);
  });
});

describe('RLS e isolamento (13.3/15.12)', () => {
  it('estudante não lê dados de outro, nem questões/gabaritos, nem grava XP', async () => {
    const a = await student('rls-a@example.com');
    const b = await student('rls-b@example.com');
    const [q] = await db.query<{ id: string; correct_alternative: string }>(`select id, correct_alternative from questions limit 1`);
    await asService((tx) => processQuestionAnswer(tx, { userId: b, questionId: q!.id, selected: 'A', mode: 'single', source: 'free', idempotencyKey: 'rls' }));
    const seen = await asUser({ sub: a, aal: 'aal1' }, (tx) => tx.query('select * from attempts'));
    expect(seen.length).toBe(0);
    const own = await asUser({ sub: b, aal: 'aal1' }, (tx) => tx.query('select * from attempts'));
    expect(own.length).toBe(1);
    await expect(asUser({ sub: a, aal: 'aal1' }, (tx) => tx.query('select correct_alternative from questions limit 1'))).rejects.toThrow(/permission denied/);
    await expect(asUser({ sub: a, aal: 'aal1' }, (tx) => tx.query(`insert into xp_events (user_id, activity_type, xp, source_key) values ($1, 'essay', 1000, 'fraude')`, [a]))).rejects.toThrow(/permission denied/);
    await expect(asUser({ sub: a, aal: 'aal1' }, (tx) => tx.query(`update profiles set suspended_at = null where id = $1`, [a]))).rejects.toThrow(/permission denied/);
    const profiles = await asUser({ sub: a, aal: 'aal1' }, (tx) => tx.query('select id from profiles'));
    expect(profiles).toEqual([{ id: a }]);
  });
});

describe('gamificação, ranking e menores (9.6/13.2)', () => {
  it('menor sem consentimento não entra no ranking; adulto com apelido entra', async () => {
    const minor = await student('minor@example.com', `${new Date().getFullYear() - 15}-01-01`);
    await expect(setRanking(minor, { optIn: true, displayName: 'apelido_1' })).rejects.toMatchObject({ code: 'guardian_consent_required' });
    const adult = await student('adult@example.com');
    await setRanking(adult, { optIn: true, displayName: 'Estudante_7' });
    const g = await asService((tx) => gamificationSummary(tx, adult));
    expect(g.level).toBe(1);
  });
});

describe('desempenho e mapa (8.7/10.1)', () => {
  it('indicadores separados e mapa hierárquico com denominador do currículo ativo', async () => {
    const u = await student('perf@example.com');
    const p = await asService((tx) => performanceOverview(tx, u, 'all'));
    expect(p.accuracy).toBeNull(); // sem tentativas: ausência ≠ zero
    expect(p.coverage).toBe(0);
    const map = await asService((tx) => masteryMap(tx, u));
    expect(map.length).toBe(407);
  });
});

describe('exclusão de conta (13.6)', () => {
  it('remove dados pessoais/pedagógicos e retém pagamentos sem vínculo', async () => {
    const u = await student('del@example.com');
    const [q] = await db.query<{ id: string }>(`select id from questions limit 1`);
    await asService((tx) => processQuestionAnswer(tx, { userId: u, questionId: q!.id, selected: 'A', mode: 'single', source: 'free', idempotencyKey: 'del' }));
    await db.query(`insert into payments (user_id, provider_payment_id, amount_cents, status) values ($1, 'pay_del', 100, 'CONFIRMED')`, [u]);
    await deleteAccount(u, async (id) => { await db.query('delete from auth.users where id = $1', [id]); });
    const [c] = await db.query<{ attempts: number; profile: number; payment_user: string | null }>(
      `select (select count(*)::int from attempts where user_id = $1) as attempts, (select count(*)::int from profiles where id = $1) as profile,
              (select user_id::text from payments where provider_payment_id = 'pay_del') as payment_user`, [u]);
    expect(c).toEqual({ attempts: 0, profile: 0, payment_user: null });
  });
});
