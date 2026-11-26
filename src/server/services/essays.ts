import { env } from '@/config/env';
import { discursiveEvalSchema, PROMPTS, wrapData } from '@/modules/ai/prompts';
import { scrubPII } from '@/modules/ai/pii';
import { essayIndicators, fullEvaluationSchema, partialEvaluationSchema, validateFullEvaluation, validatePartialEvaluation, verifyCitations, wordCount } from '@/modules/essays/validation';
import { asService, asUser } from '@/server/db';
import { one, type Tx, type UserClaims } from '@/server/db/types';
import { AppError, conflict, notFound } from '@/server/http/errors';
import { runAi } from './ai';
import { awardXp, checkAchievements, finalizeQuota, markStudyDay, reserveQuota, withQuotaRollback } from './core';
import { recordLearningEvent } from './learning';

/** Estimativa de linhas para texto digital (proposta ADR-014): 70 caracteres por linha manuscrita. */
export function estimateLines(text: string): number {
  return text.split(/\n+/).map((p) => p.trim()).filter(Boolean).reduce((s, p) => s + Math.ceil(p.length / 70), 0);
}
export const MIN_LINES = 8; // cartilha: até 7 linhas = texto insuficiente
export const MAX_LINES = 30;

export async function listThemes(tx: Tx) {
  return tx.query(`select id, title, kind, year, application, axis, is_synthetic from essay_themes where status = 'published' order by kind, year desc nulls last, title`);
}

export async function getTheme(tx: Tx, id: string) {
  const t = await one<{ id: string; title: string; kind: string; year: number | null; axis: string | null; instructions_md: string | null; is_synthetic: boolean }>(
    tx, `select id, title, kind, year, axis, instructions_md, is_synthetic from essay_themes where id = $1 and status = 'published'`, [id]);
  if (!t) throw notFound('Tema');
  // Somente motivadores com direitos verificados (6.4).
  const motivators = await tx.query(`select position, body_md, source_citation from motivator_texts where theme_id = $1 and rights_status in ('authorized','own','synthetic') order by position`, [id]);
  return { ...t, motivators };
}

export async function listRepertoires(tx: Tx, userId: string, axis?: string) {
  return tx.query(
    `select r.id, r.title, r.concept_md, r.source_citation, r.context_md, r.applications_md, r.axes, r.is_synthetic,
            exists (select 1 from user_repertoires ur where ur.user_id = $1 and ur.repertoire_id = r.id) as selected
       from repertoires r where r.status = 'published' and ($2::text is null or $2 = any(r.axes)) order by r.title`, [userId, axis ?? null]);
}

/** Seleção pedagógica de repertórios (6.7) — escrita direta sob RLS do próprio usuário. */
export async function toggleRepertoire(claims: UserClaims, repertoireId: string, selected: boolean) {
  const exists = await asService((tx) => one(tx, `select 1 from repertoires where id = $1 and status = 'published'`, [repertoireId]));
  if (!exists) throw notFound('Repertório');
  await asUser(claims, (tx) => selected
    ? tx.query('insert into user_repertoires (user_id, repertoire_id) values ($1,$2) on conflict do nothing', [claims.sub, repertoireId])
    : tx.query('delete from user_repertoires where user_id = $1 and repertoire_id = $2', [claims.sub, repertoireId]));
  return { ok: true };
}

export async function listTheory(tx: Tx) {
  return tx.query(`select id, competency, title, body_md, is_synthetic from essay_theory where status = 'published' order by competency, title`);
}

export async function listExercises(tx: Tx, competency?: number) {
  return tx.query(`select id, competency, kind, prompt_md, is_synthetic from essay_exercises where status = 'published' and ($1::int is null or competency = $1) order by competency, kind`, [competency ?? null]);
}

export async function createEssay(userId: string, input: { themeId?: string; customTitle?: string }) {
  return asService(async (tx) => {
    if (input.themeId && !(await one(tx, `select 1 from essay_themes where id = $1 and status = 'published'`, [input.themeId]))) throw notFound('Tema');
    const [e] = await tx.query<{ id: string }>('insert into essays (user_id, theme_id, custom_theme_title) values ($1,$2,$3) returning id',
      [userId, input.themeId ?? null, input.themeId ? null : input.customTitle ?? null]);
    await tx.query('insert into essay_drafts (essay_id, user_id) values ($1,$2)', [e!.id, userId]);
    return { id: e!.id };
  });
}

/** Salvamento automático do rascunho (6.8), aplicado sob RLS (somente o próprio rascunho). */
export async function saveDraft(claims: UserClaims, essayId: string, body: string) {
  const rows = await asUser(claims, (tx) => tx.query('update essay_drafts set body = $2, updated_at = now() where essay_id = $1 returning essay_id', [essayId, body]));
  if (!rows.length) throw notFound('Rascunho');
  return { savedAt: new Date().toISOString(), words: wordCount(body), lines: estimateLines(body) };
}

export async function getEssay(tx: Tx, userId: string, essayId: string) {
  const e = await one<{ id: string; status: string; theme_id: string | null; custom_theme_title: string | null; theme_title: string | null; current_version: number; created_at: Date }>(
    tx, `select e.id, e.status, e.theme_id, e.custom_theme_title, t.title as theme_title, e.current_version, e.created_at
           from essays e left join essay_themes t on t.id = e.theme_id where e.id = $1 and e.user_id = $2`, [essayId, userId]);
  if (!e) throw notFound('Redação');
  const draft = await one<{ body: string; updated_at: Date }>(tx, 'select body, updated_at from essay_drafts where essay_id = $1', [essayId]);
  const versions = await tx.query(
    `select v.id, v.version, v.kind, v.body, v.target_competency, v.parent_version, v.word_count, v.submitted_at,
            ev.kind as eval_kind, ev.c1, ev.c2, ev.c3, ev.c4, ev.c5, ev.total, ev.zeroed, ev.zero_reason, ev.result, ev.model_id, ev.created_at as evaluated_at
       from essay_versions v left join essay_evaluations ev on ev.essay_version_id = v.id
      where v.essay_id = $1 order by v.version`, [essayId]);
  return { ...e, draft, versions };
}

/**
 * Trava de lançamento (6.3/15.x — "não prometer precisão sem benchmark"): em produção, a correção completa só é
 * liberada se houver benchmark APROVADO por administrador para o par (modelo aprovado, prompt ativo) vigente.
 */
export async function essayBenchmarkGate(tx: Tx, envName: string = env().NEXO_ENV): Promise<{ released: boolean; runId?: string }> {
  if (envName !== 'production') return { released: true };
  const row = await one<{ id: string }>(tx,
    `select r.id from essay_benchmark_runs r
       join ai_models m on m.model_id = r.model_id and m.purpose = $1 and m.status = 'approved'
       join prompt_versions p on p.id = r.prompt_version_id and p.purpose = 'essay_full' and p.status = 'active'
      where r.status = 'passed' and r.approved_at is not null and not r.is_test_double
      order by r.approved_at desc limit 1`, [PROMPTS.essay_full.modelPurpose]);
  return row ? { released: true, runId: row.id } : { released: false };
}

/** Prompt da correção completa — compartilhado com o benchmark (6.3) para medir exatamente o caminho de produção. */
export function buildEssayUserPrompt(input: { theme: string; motivators?: string | null; rag: string; essay: string }): string {
  return [
    `Tema: ${input.theme}`,
    input.motivators ? wrapData('Textos motivadores (para identificar cópia)', input.motivators) : '',
    wrapData('Critérios oficiais recuperados (cartilha)', input.rag),
    wrapData('Redação do estudante', input.essay),
  ].filter(Boolean).join('\n\n');
}

/**
 * Contexto RAG: rubrica oficial + exemplos autorizados validados. Exemplos do conjunto de benchmark
 * (usage = 'benchmark') NUNCA entram aqui (6.3: separar avaliação humana conhecida do RAG).
 */
export async function ragContext(tx: Tx): Promise<string> {
  const rubric = await tx.query<{ competency: number | null; level: number | null; body: string; title: string }>(
    `select competency, level, body, title from rag_documents where usage = 'rag' and kind in ('rubric','zero_rule') and rights_status <> 'restricted'
      order by competency nulls last, level desc nulls last`);
  // Exemplos reais autorizados com notas conhecidas entram aqui quando validados (6.3); nenhum é inventado.
  const examples = await tx.query<{ title: string; body: string; known_scores: unknown }>(
    `select title, body, known_scores from rag_documents where usage = 'rag' and kind = 'graded_example' and status = 'validated' and rights_status in ('authorized','own') limit 2`);
  const parts = rubric.map((r) => `${r.title}${r.level !== null ? ` — ${r.level} pontos` : ''}: ${r.body}`);
  for (const ex of examples) parts.push(`Exemplo autorizado (${ex.title}; notas conhecidas ${JSON.stringify(ex.known_scores)}):\n${ex.body}`);
  return parts.join('\n');
}

/** Correção completa (6.1/6.2/7.5): uma chamada de qualidade, sem histórico de notas no contexto. */
export async function submitEssay(userId: string, essayId: string, idempotencyKey: string) {
  const prep = await asService(async (tx) => {
    const e = await one<{ status: string; theme_title: string | null; custom_theme_title: string | null; current_version: number; motivators: string | null }>(tx,
      `select e.status, t.title as theme_title, e.custom_theme_title, e.current_version,
              (select string_agg(left(m.body_md, 600), E'\\n---\\n' order by m.position) from motivator_texts m where m.theme_id = e.theme_id and m.rights_status in ('authorized','own','synthetic')) as motivators
         from essays e left join essay_themes t on t.id = e.theme_id where e.id = $1 and e.user_id = $2`, [essayId, userId]);
    if (!e) throw notFound('Redação');
    if (!(await essayBenchmarkGate(tx)).released) {
      throw new AppError(503, 'benchmark_pending', 'A correção por IA ainda não foi liberada: aguarda validação contra redações avaliadas por humanos. Nenhuma franquia foi consumida.');
    }
    const draft = await one<{ body: string }>(tx, 'select body from essay_drafts where essay_id = $1', [essayId]);
    const body = (draft?.body ?? '').trim();
    const lines = estimateLines(body);
    if (lines < MIN_LINES) throw new AppError(422, 'text_too_short', `Texto com cerca de ${lines} linha(s). O mínimo é ${MIN_LINES} linhas para evitar "texto insuficiente". Nenhuma franquia foi consumida.`);
    const last = await one<{ id: string; version: number; body: string; evaluated: boolean }>(tx,
      `select v.id, v.version, v.body, exists (select 1 from essay_evaluations ev where ev.essay_version_id = v.id and ev.kind = 'full') as evaluated
         from essay_versions v where v.essay_id = $1 order by v.version desc limit 1`, [essayId]);
    if (last && last.body === body && last.evaluated) throw conflict('Esta versão já foi avaliada.', 'already_evaluated');
    const prof = await one<{ display_name: string }>(tx, 'select display_name from profiles where id = $1', [userId]);
    return { e, body, lines, last, name: prof?.display_name ?? '', rag: await ragContext(tx) };
  });
  const ticket = await reserveQuota(userId, 'essays', `essay:${idempotencyKey}`);
  const version = await asService(async (tx) => {
    if (prep.last && prep.last.body === prep.body && !prep.last.evaluated) return { id: prep.last.id, version: prep.last.version };
    const nextVersion = (prep.last?.version ?? 0) + 1;
    const [v] = await tx.query<{ id: string }>(
      `insert into essay_versions (essay_id, version, kind, body, parent_version, line_count, word_count) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [essayId, nextVersion, prep.last ? 'full_rewrite' : 'full', prep.body, prep.last?.version ?? null, prep.lines, wordCount(prep.body)]);
    await tx.query(`update essays set status = 'submitted', current_version = $2 where id = $1`, [essayId, nextVersion]);
    return { id: v!.id, version: nextVersion };
  });
  const scrubbed = scrubPII(prep.body, { names: [prep.name] }).text;
  const outcome = await runAi({
    purpose: 'essay_full', userId, planCode: ticket.plan, requestId: `essay:${idempotencyKey}`, schema: fullEvaluationSchema,
    validate: (v) => validateFullEvaluation(v, scrubbed),
    user: buildEssayUserPrompt({ theme: prep.e.theme_title ?? prep.e.custom_theme_title ?? '', motivators: prep.e.motivators, rag: prep.rag, essay: scrubbed }),
  });
  if (!outcome.ok) {
    await asService(async (tx) => {
      await finalizeQuota(ticket, false, tx);
      await tx.query(`update essays set status = 'failed' where id = $1`, [essayId]);
    });
    throw new AppError(503, outcome.reason, outcome.message);
  }
  return withQuotaRollback(ticket, () => asService(async (tx) => {
    const ev = outcome.value;
    const c = ev.competencies.map((x) => x.score);
    await tx.query(
      `insert into essay_evaluations (essay_version_id, kind, c1, c2, c3, c4, c5, total, zeroed, zero_reason, result, model_id, prompt_version_id, ai_usage_id)
       values ($1,'full',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [version.id, c[0], c[1], c[2], c[3], c[4], ev.total, ev.zeroed, ev.zero_reason, JSON.stringify(ev), outcome.modelId, outcome.promptVersionId, outcome.usageId]);
    await tx.query(`update essays set status = 'evaluated' where id = $1`, [essayId]);
    await recordLearningEvent(tx, { userId, eventType: 'essay_evaluation', source: 'free', idempotencyKey: `essay:${version.id}`, entityType: 'essay_version', entityId: version.id, payload: { total: ev.total } });
    await finalizeQuota(ticket, true, tx);
    await awardXp(tx, userId, 'essay', `essay:${version.id}`);
    await markStudyDay(tx, userId);
    await checkAchievements(tx, userId);
    return { versionId: version.id, version: version.version, evaluation: ev, followUp: await essayFollowUp(tx, userId) };
  }));
}

/** Reescrita direcionada (6.6): franquia de reescritas; avaliação parcial não é nota completa. */
export async function submitPartialRewrite(userId: string, essayId: string, input: { competency: number; original: string; rewritten: string; idempotencyKey: string }) {
  const prep = await asService(async (tx) => {
    const e = await one<{ current_version: number }>(tx, 'select current_version from essays where id = $1 and user_id = $2', [essayId, userId]);
    if (!e) throw notFound('Redação');
    const base = await one<{ body: string }>(tx, 'select body from essay_versions where essay_id = $1 and version = $2', [essayId, e.current_version]);
    if (!base) throw conflict('Envie a redação para correção antes de reescrever trechos.');
    if (!verifyCitations(base.body, [input.original]).valid) throw new AppError(422, 'excerpt_not_found', 'O trecho original precisa ser copiado da versão avaliada.');
    const prof = await one<{ display_name: string }>(tx, 'select display_name from profiles where id = $1', [userId]);
    const rubric = await tx.query<{ level: number; body: string }>(`select level, body from rag_documents where kind = 'rubric' and usage = 'rag' and competency = $1 order by level desc`, [input.competency]);
    return { e, name: prof?.display_name ?? '', rubric };
  });
  const ticket = await reserveQuota(userId, 'rewrites', `rewrite:${input.idempotencyKey}`);
  const rewritten = scrubPII(input.rewritten, { names: [prep.name] }).text;
  const outcome = await runAi({
    purpose: 'essay_partial', userId, planCode: ticket.plan, requestId: `rewrite:${input.idempotencyKey}`, schema: partialEvaluationSchema,
    validate: (v) => validatePartialEvaluation(v, rewritten, input.competency),
    user: [
      `Competência alvo: ${input.competency}`,
      wrapData('Níveis oficiais da competência', prep.rubric.map((r) => `${r.level}: ${r.body}`).join('\n')),
      wrapData('Trecho original', scrubPII(input.original, { names: [prep.name] }).text),
      wrapData('Trecho reescrito', rewritten),
    ].join('\n\n'),
  });
  if (!outcome.ok) {
    await asService(async (tx) => {
      await finalizeQuota(ticket, false, tx);
    });
    throw new AppError(503, outcome.reason, outcome.message);
  }
  return withQuotaRollback(ticket, () => asService(async (tx) => {
    const [{ v }] = (await tx.query<{ v: number }>('select coalesce(max(version), 0) + 1 as v from essay_versions where essay_id = $1', [essayId])) as [{ v: number }];
    const [ver] = await tx.query<{ id: string }>(
      `insert into essay_versions (essay_id, version, kind, body, target_competency, parent_version, word_count) values ($1,$2,'partial_rewrite',$3,$4,$5,$6) returning id`,
      [essayId, v, input.rewritten, input.competency, prep.e.current_version, wordCount(input.rewritten)]);
    await tx.query(`insert into essay_evaluations (essay_version_id, kind, result, model_id, prompt_version_id, ai_usage_id) values ($1,'partial',$2,$3,$4,$5)`,
      [ver!.id, JSON.stringify({ ...outcome.value, original: input.original }), outcome.modelId, outcome.promptVersionId, outcome.usageId]);
    await recordLearningEvent(tx, { userId, eventType: 'rewrite_evaluation', source: 'free', idempotencyKey: `rewrite:${ver!.id}`, entityType: 'essay_version', entityId: ver!.id });
    await finalizeQuota(ticket, true, tx);
    await awardXp(tx, userId, 'rewrite', `rewrite:${ver!.id}`);
    await markStudyDay(tx, userId);
    return { versionId: ver!.id, evaluation: outcome.value };
  }));
}

export async function submitDiscursive(userId: string, input: { exerciseId: string; response: string; idempotencyKey: string }) {
  const prep = await asService(async (tx) => {
    const ex = await one<{ id: string; competency: number; kind: string; prompt_md: string; reference_md: string | null }>(
      tx, `select id, competency, kind, prompt_md, reference_md from essay_exercises where id = $1 and status = 'published'`, [input.exerciseId]);
    if (!ex) throw notFound('Exercício');
    const done = await one<{ id: string; evaluation: unknown }>(tx, `select id, evaluation from discursive_responses where user_id = $1 and idempotency_key = $2 and status = 'evaluated'`, [userId, input.idempotencyKey]);
    const prof = await one<{ display_name: string }>(tx, 'select display_name from profiles where id = $1', [userId]);
    const rubric = await tx.query<{ level: number; body: string }>(`select level, body from rag_documents where kind = 'rubric' and usage = 'rag' and competency = $1 order by level desc`, [ex.competency]);
    return { ex, done, name: prof?.display_name ?? '', rubric };
  });
  if (prep.done) return { id: prep.done.id, evaluation: prep.done.evaluation, duplicate: true };
  const ticket = await reserveQuota(userId, 'discursive', `disc:${input.idempotencyKey}`);
  const response = scrubPII(input.response, { names: [prep.name] }).text;
  const outcome = await runAi({
    purpose: 'discursive_eval', userId, planCode: ticket.plan, requestId: `disc:${input.idempotencyKey}`, schema: discursiveEvalSchema,
    validate: (v) => (verifyCitations(response, v.citations).valid ? { ok: true, value: v } : { ok: false, errors: ['citação não encontrada'] }),
    user: [
      `Competência: ${prep.ex.competency} — tipo de exercício: ${prep.ex.kind}`,
      wrapData('Níveis oficiais da competência', prep.rubric.map((r) => `${r.level}: ${r.body}`).join('\n')),
      wrapData('Enunciado do exercício', prep.ex.prompt_md),
      prep.ex.reference_md ? wrapData('Referência de apoio', prep.ex.reference_md) : '',
      wrapData('Resposta do estudante', response),
    ].filter(Boolean).join('\n\n'),
  });
  if (!outcome.ok) {
    await asService(async (tx) => {
      await finalizeQuota(ticket, false, tx);
    });
    throw new AppError(503, outcome.reason, outcome.message);
  }
  return withQuotaRollback(ticket, () => asService(async (tx) => {
    const [r] = await tx.query<{ id: string }>(
      `insert into discursive_responses (user_id, exercise_id, response_text, status, evaluation, ai_usage_id, idempotency_key) values ($1,$2,$3,'evaluated',$4,$5,$6)
       on conflict (user_id, idempotency_key) do update set status = 'evaluated', evaluation = excluded.evaluation returning id`,
      [userId, prep.ex.id, input.response, JSON.stringify(outcome.value), outcome.usageId, input.idempotencyKey]);
    await recordLearningEvent(tx, { userId, eventType: 'discursive_evaluation', source: 'free', idempotencyKey: `disc:${r!.id}`, entityType: 'essay_exercise', entityId: prep.ex.id });
    await finalizeQuota(ticket, true, tx);
    await awardXp(tx, userId, 'discursive_exercise', `disc:${r!.id}`);
    await markStudyDay(tx, userId);
    return { id: r!.id, evaluation: outcome.value };
  }));
}

/** Indicadores (6.9): somente notas — última, média, máxima e evolução geral/por competência. */
export async function essayStats(tx: Tx, userId: string) {
  const rows = await tx.query<{ total: number; c1: number; c2: number; c3: number; c4: number; c5: number; created_at: Date }>(
    `select ev.total, ev.c1, ev.c2, ev.c3, ev.c4, ev.c5, ev.created_at from essay_evaluations ev
       join essay_versions v on v.id = ev.essay_version_id join essays e on e.id = v.essay_id
      where e.user_id = $1 and ev.kind = 'full' order by ev.created_at`, [userId]);
  return essayIndicators(rows.map((r) => ({ total: r.total, c: [r.c1, r.c2, r.c3, r.c4, r.c5], at: new Date(r.created_at) })));
}

/**
 * Recomendações posteriores à nota (6.2): o histórico orienta intervenções depois da avaliação,
 * nunca a nota. Regra determinística: competências com menor média recente.
 */
export async function essayFollowUp(tx: Tx, userId: string) {
  const stats = await essayStats(tx, userId);
  if (!stats) return [];
  const weakest = [...stats.byCompetency].sort((a, b) => a.average - b.average || a.competency - b.competency).slice(0, 2);
  const out = [];
  for (const w of weakest) {
    const theory = await tx.query<{ id: string; title: string }>(`select id, title from essay_theory where status = 'published' and competency = $1 limit 1`, [w.competency]);
    const exercises = await tx.query<{ id: string; kind: string }>(`select id, kind from essay_exercises where status = 'published' and competency = $1 limit 2`, [w.competency]);
    out.push({ competency: w.competency, average: w.average, theory, exercises });
  }
  return out;
}

export async function listEssays(tx: Tx, userId: string) {
  return tx.query(
    `select e.id, e.status, coalesce(t.title, e.custom_theme_title) as title, e.updated_at,
            (select ev.total from essay_evaluations ev join essay_versions v on v.id = ev.essay_version_id where v.essay_id = e.id and ev.kind = 'full' order by ev.created_at desc limit 1) as last_total
       from essays e left join essay_themes t on t.id = e.theme_id where e.user_id = $1 order by e.updated_at desc limit 100`, [userId]);
}
