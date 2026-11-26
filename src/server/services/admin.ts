import { z } from 'zod';
import { engineParamsSchema } from '@/modules/mastery/params';
import { asService } from '@/server/db';
import { num, one, type Tx } from '@/server/db/types';
import { AppError, badRequest, conflict, notFound } from '@/server/http/errors';
import { monthSpendUsd } from './ai';
import { audit, clearParamsCache, userPlan } from './core';
import { listBenchmarkRuns } from './essay-benchmark';
import { essayBenchmarkGate } from './essays';

// ---------------------------------------------------------------------------
// Visão geral (12.3)
// ---------------------------------------------------------------------------
export async function adminOverview(tx: Tx) {
  const [u] = await tx.query<Record<string, number>>(
    `select (select count(*)::int from profiles) as users,
            (select count(distinct user_id)::int from learning_events where occurred_at > now() - interval '7 days') as active_7d,
            (select count(distinct user_id)::int from learning_events where occurred_at > now() - interval '30 days') as active_30d,
            (select count(*)::int from subscriptions where status in ('active','past_due')) as paying,
            (select count(*)::int from access_grants where revoked_at is null and ends_at > now()) as grants,
            (select count(*)::int from alerts where acknowledged_at is null) as open_alerts,
            (select count(*)::int from feedback where status = 'open') as open_feedback,
            (select count(*)::int from content_reviews where status = 'pending') as pending_reviews,
            (select count(*)::int from webhook_events where status = 'failed') as failed_webhooks`);
  const [rev] = await tx.query<{ mrr: string | null; month_revenue: string | null }>(
    `select (select sum(case when cycle = 'annual' then price_cents / 12.0 else price_cents end) from subscriptions where status in ('active','past_due'))::text as mrr,
            (select sum(amount_cents) from payments where status in ('CONFIRMED','RECEIVED') and date_trunc('month', paid_at) = date_trunc('month', now()))::text as month_revenue`);
  return { ...u, mrrCents: num(rev?.mrr) ?? 0, monthRevenueCents: num(rev?.month_revenue) ?? 0, aiSpendUsdMonth: await monthSpendUsd(tx) };
}

// ---------------------------------------------------------------------------
// Usuários e assinaturas (12.4) — sem acesso a senhas; sem edição pedagógica.
// ---------------------------------------------------------------------------
export async function listUsers(tx: Tx, f: { q?: string; page: number }) {
  return tx.query(
    `select p.id, u.email, p.display_name, p.enem_target_year, p.created_at, p.suspended_at, p.guardian_consent_status,
            (select max(occurred_at) from learning_events le where le.user_id = p.id) as last_activity,
            (select string_agg(role, ',') from user_roles r where r.user_id = p.id) as roles
       from profiles p join auth.users u on u.id = p.id
      where ($1::text is null or u.email ilike $1 or p.display_name ilike $1)
      order by p.created_at desc limit 50 offset $2`, [f.q ? `%${f.q}%` : null, (f.page - 1) * 50]);
}

export async function userDetail(tx: Tx, userId: string) {
  const p = await one(tx, `select p.id, u.email, p.display_name, p.enem_target_year, p.created_at, p.suspended_at, p.suspension_reason, p.guardian_consent_status, p.ranking_opt_in
    from profiles p join auth.users u on u.id = p.id where p.id = $1`, [userId]);
  if (!p) throw notFound('Usuário');
  return {
    profile: p,
    plan: await userPlan(tx, userId),
    subscriptions: await tx.query('select id, plan_code, cycle, status, current_period_end, cancel_at_period_end, created_at from subscriptions where user_id = $1 order by created_at desc', [userId]),
    payments: await tx.query('select provider_payment_id, amount_cents, status, due_date, paid_at from payments where user_id = $1 order by due_date desc limit 50', [userId]),
    grants: await tx.query('select id, plan_code, starts_at, ends_at, reason, campaign, revoked_at from access_grants where user_id = $1 order by created_at desc', [userId]),
    usage: await tx.query(`select resource, period_key, count(*)::int as n from quota_usage where user_id = $1 and status = 'consumed' group by 1,2 order by 2 desc limit 30`, [userId]),
    aiCostUsd: num((await tx.query<{ s: string | null }>('select sum(cost_usd)::text as s from ai_usage where user_id = $1', [userId]))[0]?.s) ?? 0,
  };
}

export async function grantAccess(adminId: string, input: { userId: string; plan: 'plus' | 'pro'; days: number; reason: string; campaign?: string }) {
  return asService(async (tx) => {
    const [g] = await tx.query<{ id: string }>(
      `insert into access_grants (user_id, plan_code, ends_at, reason, campaign, granted_by) values ($1,$2, now() + make_interval(days => $3), $4,$5,$6) returning id`,
      [input.userId, input.plan, input.days, input.reason, input.campaign ?? null, adminId]);
    await audit(tx, adminId, 'admin', 'grant_access', 'access_grant', g!.id, { plan: input.plan, days: input.days, reason: input.reason });
    return { id: g!.id };
  });
}

export async function revokeGrant(adminId: string, grantId: string) {
  return asService(async (tx) => {
    await tx.query('update access_grants set revoked_at = now() where id = $1 and revoked_at is null', [grantId]);
    await audit(tx, adminId, 'admin', 'revoke_grant', 'access_grant', grantId);
    return { ok: true };
  });
}

/** Suspensão justificada, auditada e reversível (13.8). */
export async function setSuspension(adminId: string, userId: string, suspend: boolean, reason?: string) {
  if (suspend && (!reason || reason.trim().length < 10)) throw badRequest('Informe a justificativa da suspensão (mínimo 10 caracteres).');
  return asService(async (tx) => {
    await tx.query('update profiles set suspended_at = case when $2 then now() else null end, suspension_reason = case when $2 then $3 else null end where id = $1', [userId, suspend, reason ?? null]);
    await audit(tx, adminId, 'admin', suspend ? 'suspend_user' : 'unsuspend_user', 'profile', userId, { reason });
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Conteúdos (12.5): criar/importar → validar (técnica, pedagógica, direitos) → publicar → monitorar.
// ---------------------------------------------------------------------------
const CONTENT_TABLES = {
  question: { table: 'questions', status: 'publication_status', title: `left(statement_md, 120)` },
  lesson: { table: 'lessons', status: 'status', title: 'title' },
  concept_activity: { table: 'concept_activities', status: 'status', title: 'left(prompt_md, 120)' },
  deck: { table: 'decks', status: 'status', title: 'title' },
  essay_theme: { table: 'essay_themes', status: 'status', title: 'title' },
  repertoire: { table: 'repertoires', status: 'status', title: 'title' },
  essay_exercise: { table: 'essay_exercises', status: 'status', title: 'left(prompt_md, 120)' },
  essay_theory: { table: 'essay_theory', status: 'status', title: 'title' },
} as const;
export type ContentType = keyof typeof CONTENT_TABLES;
export const contentTypes = Object.keys(CONTENT_TABLES) as ContentType[];

export async function contentQueue(tx: Tx, type: ContentType, status: 'staging' | 'pending_review' | 'published' | 'retired', page: number) {
  const t = CONTENT_TABLES[type];
  return tx.query(
    `select c.id, ${t.title} as title, c.${t.status} as status,
            (select json_agg(json_build_object('kind', r.review_kind, 'status', r.status, 'notes', r.notes, 'at', r.decided_at))
               from content_reviews r where r.entity_type = $1 and r.entity_id = c.id) as reviews
       from ${t.table} c where c.${t.status} = $2 order by c.created_at desc limit 50 offset $3`, [type, status, (page - 1) * 50]);
}

export async function reviewContent(adminId: string, input: { type: ContentType; id: string; kind: 'technical' | 'pedagogical' | 'rights'; decision: 'approved' | 'rejected' | 'changes_requested'; notes?: string }) {
  return asService(async (tx) => {
    const t = CONTENT_TABLES[input.type];
    if (!(await one(tx, `select 1 from ${t.table} where id = $1`, [input.id]))) throw notFound('Conteúdo');
    await tx.query(`insert into content_reviews (entity_type, entity_id, review_kind, status, reviewer_id, notes, decided_at) values ($1,$2,$3,$4,$5,$6, now())`,
      [input.type, input.id, input.kind, input.decision, adminId, input.notes ?? null]);
    await tx.query(`update ${t.table} set ${t.status} = 'pending_review' where id = $1 and ${t.status} = 'staging'`, [input.id]);
    if (input.type === 'question' && input.kind === 'pedagogical' && input.decision === 'approved') {
      await tx.query(`update questions set classification_status = 'validated' where id = $1 and primary_skill_id is not null`, [input.id]);
    }
    await audit(tx, adminId, 'admin', 'content_review', input.type, input.id, { kind: input.kind, decision: input.decision });
    return { ok: true };
  });
}

/** Publicação exige as três validações aprovadas mais recentes (A.3.8). */
export async function publishContent(adminId: string, type: ContentType, id: string) {
  return asService(async (tx) => {
    const t = CONTENT_TABLES[type];
    const latest = await tx.query<{ review_kind: string; status: string }>(
      `select distinct on (review_kind) review_kind, status from content_reviews where entity_type = $1 and entity_id = $2 order by review_kind, created_at desc`, [type, id]);
    const ok = ['technical', 'pedagogical', 'rights'].every((k) => latest.find((l) => l.review_kind === k)?.status === 'approved');
    if (!ok) throw new AppError(422, 'validation_incomplete', 'Publicação exige validação técnica, pedagógica e de direitos aprovadas.');
    try {
      await tx.query(`update ${t.table} set ${t.status} = 'published'${type === 'question' || type === 'lesson' ? ', published_at = now()' : ''} where id = $1`, [id]);
      if (type === 'deck') await tx.query(`update flashcards set status = 'published' where deck_id = $1 and status <> 'retired'`, [id]);
    } catch (err) {
      throw new AppError(422, 'publish_constraint', 'Requisitos de publicação não atendidos (gabarito, classificação validada ou situação autoral).', err instanceof Error ? err.message.slice(0, 200) : undefined);
    }
    await audit(tx, adminId, 'admin', 'content_publish', type, id);
    return { ok: true };
  });
}

export async function retireContent(adminId: string, type: ContentType, id: string, reason: string) {
  return asService(async (tx) => {
    const t = CONTENT_TABLES[type];
    await tx.query(`update ${t.table} set ${t.status} = 'retired' where id = $1`, [id]);
    await audit(tx, adminId, 'admin', 'content_retire', type, id, { reason });
    return { ok: true };
  });
}

// Importação em lote idempotente (15.4) — formato produzido por scripts/import-enem.
export const questionImportSchema = z.object({
  external_key: z.string().min(1),
  co_item: z.number().int().nullable(),
  area_code: z.enum(['LC', 'MT', 'CN', 'CH']),
  year: z.number().int().nullable(),
  application: z.enum(['regular', 'ppl', 'reaplicacao', 'digital', 'outra']).nullable(),
  day: z.number().int().min(1).max(2).nullable(),
  booklets: z.array(z.object({ co_prova: z.number().int().nullable(), color: z.string().nullable(), position: z.number().int().min(1).max(180) })).default([]),
  language: z.enum(['en', 'es']).nullable(),
  statement_md: z.string().min(1),
  alternatives: z.array(z.object({ letter: z.enum(['A', 'B', 'C', 'D', 'E']), body_md: z.string() })).length(5),
  correct_alternative: z.enum(['A', 'B', 'C', 'D', 'E']).nullable(),
  is_annulled: z.boolean().default(false),
  param_a: z.number().nullable().default(null),
  param_b: z.number().nullable().default(null),
  param_c: z.number().nullable().default(null),
  difficulty: z.enum(['easy', 'medium', 'hard']).nullable().default(null),
  difficulty_source: z.enum(['official_param_b', 'pedagogical_provisional']).nullable().default(null),
  skill_code: z.string().nullable().default(null),
  official_skill_number: z.number().int().min(1).max(30).nullable().default(null),
  source_code: z.string(),
  rights_status: z.enum(['unknown', 'official_public_pending_review', 'authorized', 'restricted', 'own']),
});

export async function importQuestions(adminId: string, items: unknown[], manifest: Record<string, unknown>) {
  return asService(async (tx) => {
    const [run] = await tx.query<{ id: string }>(`insert into import_runs (kind, manifest, created_by) values ('enem_items', $1, $2) returning id`, [JSON.stringify(manifest), adminId]);
    const report = { loaded: 0, duplicate: 0, error: 0, errors: [] as string[] };
    for (const raw of items) {
      const parsed = questionImportSchema.safeParse(raw);
      const key = (raw as { external_key?: string })?.external_key ?? `invalid-${report.error}`;
      if (!parsed.success) {
        report.error++;
        report.errors.push(`${key}: ${parsed.error.issues[0]?.message}`);
        await tx.query(`insert into import_items (run_id, external_key, status, error) values ($1,$2,'error',$3) on conflict do nothing`, [run!.id, key, parsed.error.issues[0]?.message ?? 'inválido']);
        continue;
      }
      const q = parsed.data;
      const exists = q.co_item !== null ? await one<{ id: string }>(tx, 'select id from questions where co_item = $1', [q.co_item]) : undefined;
      const src = await one<{ id: string }>(tx, 'select id from content_sources where code = $1', [q.source_code]);
      if (!src) throw badRequest(`Fonte não cadastrada: ${q.source_code}`);
      let editionId: string | null = null;
      if (q.year && q.application && q.day) {
        const [e] = await tx.query<{ id: string }>(`insert into exam_editions (year, application, day, source_id) values ($1,$2,$3,$4)
          on conflict (year, application, day) do update set source_id = coalesce(exam_editions.source_id, excluded.source_id) returning id`, [q.year, q.application, q.day, src.id]);
        editionId = e!.id;
      }
      const skill = q.skill_code ? await one<{ id: string; subtopic_id: string }>(tx, 'select id, subtopic_id from skills where code = $1', [q.skill_code]) : undefined;
      const official = q.official_skill_number ? await one<{ id: string }>(tx, 'select id from official_skills where area_code = $1 and number = $2', [q.area_code, q.official_skill_number]) : undefined;
      let questionId: string;
      if (exists) {
        // Dedupe entre cadernos: mesma questão (CO_ITEM) recebe apenas novas posições.
        questionId = exists.id;
        report.duplicate++;
      } else {
        const [ins] = await tx.query<{ id: string }>(
          `insert into questions (area_code, co_item, edition_id, year, application, language, statement_md, correct_alternative, is_annulled, param_a, param_b, param_c,
             difficulty, difficulty_source, primary_skill_id, primary_subtopic_id, official_skill_id, classification_status, rights_status, source_id, import_run_id, publication_status)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'staging') returning id`,
          [q.area_code, q.co_item, editionId, q.year, q.application, q.language, q.statement_md, q.correct_alternative, q.is_annulled, q.param_a, q.param_b, q.param_c,
            q.difficulty, q.difficulty_source, skill?.id ?? null, skill?.subtopic_id ?? null, official?.id ?? null, skill ? 'ai_suggested' : 'unclassified', q.rights_status, src.id, run!.id]);
        questionId = ins!.id;
        for (const a of q.alternatives) await tx.query('insert into alternatives (question_id, letter, body_md) values ($1,$2,$3)', [questionId, a.letter, a.body_md]);
        report.loaded++;
      }
      for (const b of q.booklets) {
        if (!editionId || b.co_prova === null) continue;
        const [bk] = await tx.query<{ id: string }>(`insert into exam_booklets (edition_id, co_prova, color) values ($1,$2,$3)
          on conflict (edition_id, co_prova) do update set color = coalesce(exam_booklets.color, excluded.color) returning id`, [editionId, b.co_prova, b.color]);
        await tx.query('insert into question_booklet_positions (question_id, booklet_id, position) values ($1,$2,$3) on conflict do nothing', [questionId, bk!.id, b.position]);
      }
      await tx.query(`insert into import_items (run_id, external_key, status) values ($1,$2,$3) on conflict do nothing`, [run!.id, q.external_key, exists ? 'duplicate' : 'loaded']);
    }
    await tx.query(`update import_runs set status = 'completed', finished_at = now(), report = $2 where id = $1`, [run!.id, JSON.stringify(report)]);
    await audit(tx, adminId, 'admin', 'import_questions', 'import_run', run!.id, report);
    return { runId: run!.id, ...report };
  });
}

export async function importRuns(tx: Tx) {
  return tx.query('select id, kind, status, report, started_at, finished_at from import_runs order by started_at desc limit 50');
}

// ---------------------------------------------------------------------------
// IA (7.10/12.7): modelos, prompts, uso, custos, orçamento.
// ---------------------------------------------------------------------------
export async function aiDashboard(tx: Tx) {
  return {
    models: await tx.query('select id, purpose, provider, model_id, status, input_usd_per_mtok, output_usd_per_mtok, approved_at, notes from ai_models order by purpose, created_at desc'),
    prompts: await tx.query('select id, purpose, version, status, created_at from prompt_versions order by purpose, created_at desc'),
    byPurpose: await tx.query(`select purpose, count(*)::int as calls, count(*) filter (where status = 'success')::int as ok, count(*) filter (where status = 'invalid_output')::int as invalid,
        sum(input_tokens)::int as input_tokens, sum(output_tokens)::int as output_tokens, sum(cost_usd)::text as cost_usd, avg(latency_ms)::int as avg_latency
        from ai_usage where created_at > now() - interval '30 days' group by purpose order by purpose`),
    byPlan: await tx.query(`select coalesce(plan_code, 'admin') as plan, count(*)::int as calls, sum(cost_usd)::text as cost_usd from ai_usage where created_at > now() - interval '30 days' group by 1`),
    budgets: await tx.query('select period_key, budget_usd, hard_limit, alerted_70, alerted_90, alerted_100 from ai_budgets order by period_key desc limit 12'),
    spendMonth: await monthSpendUsd(tx),
    evaluationReports: await tx.query(`select count(*)::int as n from feedback where kind = 'evaluation_issue' and created_at > now() - interval '30 days'`),
    benchmarkRuns: await listBenchmarkRuns(tx, 10),
    essayGate: await essayBenchmarkGate(tx, 'production'),
  };
}

export const modelSchema = z.object({
  purpose: z.enum(['essay', 'mini', 'nano', 'embedding', 'validator']),
  modelId: z.string().min(2).max(100),
  inputUsdPerMtok: z.number().nonnegative().nullable(),
  outputUsdPerMtok: z.number().nonnegative().nullable(),
  notes: z.string().max(500).optional(),
});

export async function registerModel(adminId: string, input: z.infer<typeof modelSchema>) {
  return asService(async (tx) => {
    const [m] = await tx.query<{ id: string }>(
      `insert into ai_models (purpose, model_id, input_usd_per_mtok, output_usd_per_mtok, notes) values ($1,$2,$3,$4,$5)
       on conflict (purpose, model_id) do update set input_usd_per_mtok = excluded.input_usd_per_mtok, output_usd_per_mtok = excluded.output_usd_per_mtok, notes = excluded.notes returning id`,
      [input.purpose, input.modelId, input.inputUsdPerMtok, input.outputUsdPerMtok, input.notes ?? null]);
    await audit(tx, adminId, 'admin', 'ai_model_register', 'ai_model', m!.id, input);
    return { id: m!.id };
  });
}

/** Aprovação explícita (sem troca automática de modelo — 7.2). */
export async function approveModel(adminId: string, modelId: string) {
  return asService(async (tx) => {
    const m = await one<{ purpose: string; input_usd_per_mtok: string | null }>(tx, 'select purpose, input_usd_per_mtok from ai_models where id = $1', [modelId]);
    if (!m) throw notFound('Modelo');
    if (m.input_usd_per_mtok === null) throw new AppError(422, 'price_required', 'Informe o preço verificado do modelo antes de aprová-lo.');
    await tx.query(`update ai_models set status = 'retired' where purpose = $1 and status = 'approved'`, [m.purpose]);
    await tx.query(`update ai_models set status = 'approved', approved_by = $2, approved_at = now() where id = $1`, [modelId, adminId]);
    await audit(tx, adminId, 'admin', 'ai_model_approve', 'ai_model', modelId);
    return { ok: true };
  });
}

export async function activatePromptVersion(adminId: string, promptId: string) {
  return asService(async (tx) => {
    const p = await one<{ purpose: string }>(tx, 'select purpose from prompt_versions where id = $1', [promptId]);
    if (!p) throw notFound('Prompt');
    await tx.query(`update prompt_versions set status = 'retired' where purpose = $1 and status = 'active'`, [p.purpose]);
    await tx.query(`update prompt_versions set status = 'active' where id = $1`, [promptId]);
    await audit(tx, adminId, 'admin', 'prompt_activate', 'prompt_version', promptId);
    return { ok: true };
  });
}

export async function setBudget(adminId: string, input: { periodKey: string; budgetUsd: number; hardLimit: boolean }) {
  if (!/^\d{4}-\d{2}$/.test(input.periodKey)) throw badRequest('Período no formato AAAA-MM.');
  return asService(async (tx) => {
    await tx.query(`insert into ai_budgets (period_key, budget_usd, hard_limit) values ($1,$2,$3)
      on conflict (period_key) do update set budget_usd = excluded.budget_usd, hard_limit = excluded.hard_limit, updated_at = now()`, [input.periodKey, input.budgetUsd, input.hardLimit]);
    await audit(tx, adminId, 'admin', 'ai_budget_set', 'ai_budget', input.periodKey, input);
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Financeiro híbrido (12.6): Asaas/IA automáticos; demais despesas manuais.
// ---------------------------------------------------------------------------
export async function financeReport(tx: Tx, months = 6) {
  const revenue = await tx.query(
    `select to_char(date_trunc('month', paid_at), 'YYYY-MM') as month, sum(amount_cents)::int as gross_cents, sum(coalesce(net_cents, amount_cents))::int as net_cents, count(*)::int as payments
       from payments where status in ('CONFIRMED','RECEIVED') and paid_at > now() - make_interval(months => $1) group by 1 order by 1`, [months]);
  const ai = await tx.query(
    `select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, sum(cost_usd)::text as usd, count(*) filter (where cost_usd is null and status = 'success')::int as unpriced_calls
       from ai_usage where created_at > now() - make_interval(months => $1) group by 1 order by 1`, [months]);
  const expenses = await tx.query(
    `select to_char(competence_month, 'YYYY-MM') as month, category, sum(amount_cents)::int as cents, bool_or(is_estimate) as has_estimates
       from manual_expenses where competence_month > now() - make_interval(months => $1) group by 1, 2 order by 1, 2`, [months]);
  const marketing = await tx.query(`select to_char(competence_month, 'YYYY-MM') as month, channel, spend_cents, signups from marketing_metrics order by competence_month desc limit 60`);
  const [mrr] = await tx.query<{ mrr: string | null }>(`select sum(case when cycle = 'annual' then price_cents / 12.0 else price_cents end)::text as mrr from subscriptions where status in ('active','past_due')`);
  const [churn] = await tx.query<{ canceled: number; active: number }>(
    `select count(*) filter (where canceled_at > now() - interval '30 days')::int as canceled, count(*) filter (where status in ('active','past_due'))::int as active from subscriptions`);
  return {
    revenue, ai, expenses, marketing, mrrCents: num(mrr?.mrr) ?? 0, churn30d: churn,
    notes: 'Receita anual reconhecida mensalmente no MRR (preço/12); caixa reflete pagamentos confirmados. Custos de IA em USD; conversão cambial manual. Despesas marcadas como estimativa sinalizadas.',
  };
}

export const expenseSchema = z.object({
  category: z.enum(['infrastructure', 'marketing', 'accounting', 'taxes', 'domain', 'other']),
  description: z.string().min(2).max(200),
  amountCents: z.number().int().positive(),
  competenceMonth: z.string().regex(/^\d{4}-\d{2}$/),
  isEstimate: z.boolean().default(false),
});

export async function addExpense(adminId: string, input: z.infer<typeof expenseSchema>) {
  return asService(async (tx) => {
    const [r] = await tx.query<{ id: string }>(`insert into manual_expenses (category, description, amount_cents, competence_month, is_estimate, created_by) values ($1,$2,$3,($4 || '-01')::date,$5,$6) returning id`,
      [input.category, input.description, input.amountCents, input.competenceMonth, input.isEstimate, adminId]);
    await audit(tx, adminId, 'admin', 'expense_add', 'manual_expense', r!.id, input);
    return { id: r!.id };
  });
}

export async function upsertMarketing(adminId: string, input: { month: string; channel: string; spendCents: number; signups?: number; notes?: string }) {
  return asService(async (tx) => {
    await tx.query(`insert into marketing_metrics (competence_month, channel, spend_cents, signups, notes) values (($1 || '-01')::date,$2,$3,$4,$5)
      on conflict (competence_month, channel) do update set spend_cents = excluded.spend_cents, signups = excluded.signups, notes = excluded.notes`,
      [input.month, input.channel, input.spendCents, input.signups ?? null, input.notes ?? null]);
    await audit(tx, adminId, 'admin', 'marketing_upsert', 'marketing_metrics', `${input.month}:${input.channel}`);
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Monitoramento (12.7), feedback (14.7) e configurações (A.3.7)
// ---------------------------------------------------------------------------
export async function monitoring(tx: Tx) {
  return {
    alerts: await tx.query('select id, kind, severity, message, details, created_at, acknowledged_at from alerts order by acknowledged_at nulls first, created_at desc limit 100'),
    webhooks: await tx.query(`select event_type, status, count(*)::int as n, max(received_at) as last from webhook_events group by 1, 2 order by 4 desc limit 50`),
    backups: await tx.query('select kind, status, started_at, finished_at, size_bytes, location_hint, notes from backup_runs order by started_at desc limit 30'),
    aiFailures: await tx.query(`select purpose, status, count(*)::int as n from ai_usage where status <> 'success' and created_at > now() - interval '7 days' group by 1, 2`),
    lastBackupOk: (await tx.query<{ at: Date | null }>(`select max(finished_at) as at from backup_runs where kind = 'backup' and status = 'success'`))[0]?.at ?? null,
  };
}

export async function acknowledgeAlert(adminId: string, alertId: string) {
  return asService(async (tx) => {
    await tx.query('update alerts set acknowledged_at = now(), acknowledged_by = $2 where id = $1', [alertId, adminId]);
    return { ok: true };
  });
}

export async function recordBackupRun(input: { kind: 'backup' | 'restore_test'; status: 'success' | 'failed'; startedAt: string; finishedAt?: string; sizeBytes?: number; sha256?: string; locationHint?: string; notes?: string }) {
  return asService(async (tx) => {
    await tx.query(`insert into backup_runs (kind, status, started_at, finished_at, size_bytes, sha256, location_hint, notes) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [input.kind, input.status, input.startedAt, input.finishedAt ?? null, input.sizeBytes ?? null, input.sha256 ?? null, input.locationHint ?? null, input.notes ?? null]);
    if (input.status === 'failed') {
      await tx.query(`insert into alerts (kind, severity, message, details) values ('backup', 'critical', $1, $2)`, [`Falha de ${input.kind === 'backup' ? 'backup' : 'teste de restauração'}`, JSON.stringify({ notes: input.notes })]);
    }
    return { ok: true };
  });
}

/** Verificação periódica (job): backup a cada 3 dias e teste de restauração mensal (13.5). */
export async function checkBackupFreshness(tx: Tx) {
  const [r] = await tx.query<{ backup_age_h: number | null; restore_age_d: number | null }>(
    `select extract(epoch from now() - (select max(finished_at) from backup_runs where kind = 'backup' and status = 'success'))::int / 3600 as backup_age_h,
            extract(epoch from now() - (select max(finished_at) from backup_runs where kind = 'restore_test' and status = 'success'))::int / 86400 as restore_age_d`);
  const day = new Date().toISOString().slice(0, 10);
  if (r!.backup_age_h === null || r!.backup_age_h > 72) {
    await tx.query(`insert into alerts (kind, severity, message, dedupe_key) values ('backup', 'critical', 'Nenhum backup bem-sucedido nas últimas 72 horas.', $1) on conflict do nothing`, [`backup_stale:${day}`]);
  }
  if (r!.restore_age_d === null || r!.restore_age_d > 31) {
    await tx.query(`insert into alerts (kind, severity, message, dedupe_key) values ('backup', 'high', 'Teste mensal de restauração pendente.', $1) on conflict do nothing`, [`restore_stale:${day.slice(0, 7)}`]);
  }
  return r;
}

export async function feedbackList(tx: Tx, status?: string) {
  return tx.query(`select f.id, f.kind, f.entity_type, f.entity_id, f.message, f.status, f.created_at from feedback f where ($1::text is null or f.status = $1) order by f.created_at desc limit 200`, [status ?? null]);
}

export async function updateFeedback(adminId: string, id: string, status: 'triaged' | 'resolved' | 'dismissed') {
  return asService(async (tx) => {
    await tx.query(`update feedback set status = $2, handled_by = $3, resolved_at = case when $2 in ('resolved','dismissed') then now() end where id = $1`, [id, status, adminId]);
    return { ok: true };
  });
}

export async function settingsView(tx: Tx) {
  return {
    settings: await tx.query('select key, value, status, description, updated_at from app_settings order by key'),
    plans: await tx.query('select code, name, monthly_price_cents, annual_price_cents, price_status from plans order by rank'),
    limits: await tx.query('select plan_code, resource, period, limit_value, version from plan_limits order by plan_code, resource'),
    coupons: await tx.query('select code, kind, value, plan_code, grant_days, max_redemptions, redeemed_count, valid_until, active from coupons order by created_at desc limit 100'),
    engine: await tx.query('select id, version, status, notes, created_at from engine_parameter_sets order by created_at desc'),
    curriculumVersions: await tx.query('select id, code, status, created_at, activated_at from curriculum_versions order by created_at desc'),
  };
}

export async function updateSetting(adminId: string, key: string, value: unknown, status: 'proposal' | 'approved') {
  return asService(async (tx) => {
    const r = await tx.query('update app_settings set value = $2, status = $3, updated_by = $4, updated_at = now() where key = $1 returning key', [key, JSON.stringify(value), status, adminId]);
    if (!r.length) throw notFound('Configuração');
    await audit(tx, adminId, 'admin', 'setting_update', 'app_setting', key, { status });
    return { ok: true };
  });
}

export async function updatePlanLimit(adminId: string, input: { plan: 'free' | 'plus' | 'pro'; resource: string; limit: number | null }) {
  return asService(async (tx) => {
    const r = await tx.query(`update plan_limits set limit_value = $3, version = 'admin-' || to_char(now(), 'YYYYMMDDHH24MI'), updated_at = now() where plan_code = $1 and resource = $2 returning resource`, [input.plan, input.resource, input.limit]);
    if (!r.length) throw notFound('Limite');
    await audit(tx, adminId, 'admin', 'plan_limit_update', 'plan_limit', `${input.plan}:${input.resource}`, input);
    return { ok: true };
  });
}

/** Preços: registro e aprovação explícitos e auditados (11.10). Nenhum valor padrão no código. */
export async function updatePlanPrice(adminId: string, input: { plan: 'plus' | 'pro'; monthlyCents: number | null; annualCents: number | null; status: 'not_defined' | 'pending_approval' | 'approved' }) {
  return asService(async (tx) => {
    await tx.query('update plans set monthly_price_cents = $2, annual_price_cents = $3, price_status = $4, updated_at = now() where code = $1', [input.plan, input.monthlyCents, input.annualCents, input.status]);
    await audit(tx, adminId, 'admin', 'plan_price_update', 'plan', input.plan, input);
    return { ok: true };
  });
}

export const couponSchema = z.object({
  code: z.string().regex(/^[A-Z0-9_-]{3,32}$/),
  kind: z.enum(['percent', 'access_grant']),
  value: z.number().int().positive(),
  planCode: z.enum(['plus', 'pro']).nullable().optional(),
  grantDays: z.number().int().min(1).max(366).nullable().optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
});

export async function createCoupon(adminId: string, input: z.infer<typeof couponSchema>) {
  return asService(async (tx) => {
    try {
      await tx.query(`insert into coupons (code, kind, value, plan_code, grant_days, max_redemptions, valid_until, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [input.code, input.kind, input.value, input.planCode ?? null, input.grantDays ?? null, input.maxRedemptions ?? null, input.validUntil ?? null, adminId]);
    } catch {
      throw conflict('Cupom inválido ou já existente.');
    }
    await audit(tx, adminId, 'admin', 'coupon_create', 'coupon', input.code, input);
    return { ok: true };
  });
}

/** Nova versão de parâmetros do motor (versionada; ativação explícita — 8.10). */
export async function createEngineParams(adminId: string, input: { version: string; params: unknown; notes: string; activate: boolean }) {
  const params = engineParamsSchema.parse(input.params);
  return asService(async (tx) => {
    if (input.activate) await tx.query(`update engine_parameter_sets set status = 'retired' where status = 'active'`);
    await tx.query(`insert into engine_parameter_sets (version, params, status, notes, created_by) values ($1,$2,$3,$4,$5)`,
      [input.version, JSON.stringify(params), input.activate ? 'active' : 'experimental', input.notes, adminId]);
    await audit(tx, adminId, 'admin', 'engine_params_create', 'engine_parameter_set', input.version, { activate: input.activate });
    clearParamsCache();
    return { ok: true };
  });
}

export async function updateSubtopicRelevance(adminId: string, input: { subtopicId: string; relevance: 'low' | 'medium' | 'high' | 'unknown'; sourceCode: string; locator: string }) {
  return asService(async (tx) => {
    const src = await one<{ id: string }>(tx, 'select id from content_sources where code = $1', [input.sourceCode]);
    if (!src && input.relevance !== 'unknown') throw badRequest('Relevância exige fonte cadastrada (3.4).');
    await tx.query('update subtopics set relevance = $2, relevance_source_id = $3, relevance_locator = $4 where id = $1', [input.subtopicId, input.relevance, src?.id ?? null, input.locator]);
    await tx.query(`insert into curriculum_change_log (curriculum_version_id, entity, entity_id, change, details, created_by)
      select curriculum_version_id, 'subtopic', id, 'update', $2, $3 from subtopics where id = $1`, [input.subtopicId, JSON.stringify(input), adminId]);
    return { ok: true };
  });
}
