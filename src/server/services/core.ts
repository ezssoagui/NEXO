import { engineParamsSchema, type EngineParams } from '@/modules/mastery/params';
import { effectivePlan, type PlanCode, type SubscriptionRecord } from '@/modules/subscriptions/state';
import { AI_RESOURCES, localDate, periodKey, type QuotaResource } from '@/modules/quotas/period';
import { currentStreak } from '@/modules/gamification/levels';
import { asService } from '@/server/db';
import { num, one, type Tx } from '@/server/db/types';
import { AppError } from '@/server/http/errors';

// ---------------------------------------------------------------------------
// Parâmetros versionados do motor
// ---------------------------------------------------------------------------
let paramsCache: { at: number; version: string; params: EngineParams } | undefined;

export async function engineParams(tx: Tx): Promise<{ version: string; params: EngineParams }> {
  if (paramsCache && Date.now() - paramsCache.at < 60_000) return paramsCache;
  const row = await one<{ version: string; params: unknown }>(tx, `select version, params from engine_parameter_sets where status = 'active'`);
  if (!row) throw new Error('Nenhum conjunto de parâmetros ativo');
  paramsCache = { at: Date.now(), version: row.version, params: engineParamsSchema.parse(row.params) };
  return paramsCache;
}

export function clearParamsCache(): void {
  paramsCache = undefined;
}

export async function setting<T>(tx: Tx, key: string, fallback: T): Promise<T> {
  const r = await one<{ value: T }>(tx, 'select value from app_settings where key = $1', [key]);
  return r ? r.value : fallback;
}

// ---------------------------------------------------------------------------
// Plano efetivo e franquias (11.4/11.5/15.9)
// ---------------------------------------------------------------------------
export async function userPlan(tx: Tx, userId: string, now = new Date()): Promise<{ plan: PlanCode; source: string; until: Date | null }> {
  const sub = await one<{
    plan_code: 'plus' | 'pro'; cycle: 'monthly' | 'annual'; status: SubscriptionRecord['status']; current_period_end: Date | null;
    cancel_at_period_end: boolean; canceled_at: Date | null; grace_until: Date | null;
  }>(tx, `select plan_code, cycle, status, current_period_end, cancel_at_period_end, canceled_at, grace_until
          from subscriptions where user_id = $1 and status in ('active','past_due','canceled')
          order by (status = 'active') desc, current_period_end desc nulls last limit 1`, [userId]);
  const grants = await tx.query<{ plan_code: 'plus' | 'pro'; starts_at: Date; ends_at: Date; revoked_at: Date | null }>(
    'select plan_code, starts_at, ends_at, revoked_at from access_grants where user_id = $1 and ends_at > $2', [userId, now]);
  return effectivePlan(
    sub ? {
      planCode: sub.plan_code, cycle: sub.cycle, status: sub.status, currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end, canceledAt: sub.canceled_at, graceUntil: sub.grace_until,
    } : null,
    grants.map((g) => ({ planCode: g.plan_code, startsAt: g.starts_at, endsAt: g.ends_at, revokedAt: g.revoked_at })),
    now,
  );
}

export async function planLimit(tx: Tx, plan: PlanCode, resource: QuotaResource): Promise<{ limit: number | null; period: 'day' | 'month' }> {
  const r = await one<{ limit_value: number | null; period: 'day' | 'month' }>(
    tx, 'select limit_value, period from plan_limits where plan_code = $1 and resource = $2', [plan, resource]);
  if (!r) throw new Error(`Limite não configurado: ${plan}/${resource}`);
  return { limit: r.limit_value, period: r.period };
}

export interface QuotaTicket {
  userId: string;
  resource: QuotaResource;
  requestId: string;
  plan: PlanCode;
  tracked: boolean;
}

const QUOTA_LABEL: Record<QuotaResource, string> = {
  questions: 'questões do dia', adaptive_sessions: 'sessões adaptativas do dia', flashcards: 'flashcards do dia',
  explanations: 'explicações ativas do dia', essays: 'redações completas do mês', rewrites: 'reescritas do mês',
  discursive: 'exercícios discursivos do mês', exams: 'simulados do mês',
};

/**
 * Reserva atômica de franquia (transação própria, confirmada antes de chamadas longas).
 * Recursos ilimitados não-IA não são rastreados; IA é sempre registrada para custos.
 */
export async function reserveQuota(userId: string, resource: QuotaResource, requestId: string, now = new Date()): Promise<QuotaTicket> {
  return asService(async (tx) => {
    const { plan } = await userPlan(tx, userId, now);
    const { limit, period } = await planLimit(tx, plan, resource);
    const tracked = limit !== null || AI_RESOURCES.includes(resource);
    if (!tracked) return { userId, resource, requestId, plan, tracked };
    const [r] = await tx.query<{ outcome: string; used: number | null }>(
      'select * from public.reserve_quota($1, $2, $3, $4, $5)', [userId, resource, periodKey(period, now), requestId, limit]);
    if (r!.outcome === 'exceeded') {
      throw new AppError(402, 'quota_exceeded', `Você atingiu o limite de ${QUOTA_LABEL[resource]} do seu plano. Atividades sem IA continuam disponíveis.`, { resource, limit, plan });
    }
    if (r!.outcome === 'duplicate_consumed') throw new AppError(409, 'duplicate_request', 'Esta solicitação já foi processada.');
    return { userId, resource, requestId, plan, tracked };
  });
}

export async function finalizeQuota(ticket: QuotaTicket, success: boolean, tx?: Tx): Promise<void> {
  if (!ticket.tracked) return;
  const run = (t: Tx) => t.query('select public.finalize_quota($1, $2, $3, $4)', [ticket.userId, ticket.resource, ticket.requestId, success]);
  if (tx) await run(tx);
  else await asService(run);
}

/**
 * Executa a gravação do resultado; se ela falhar após a resposta válida da IA, libera a reserva
 * em transação separada (a franquia nunca é cobrada por falha — 6.10/A.3.6).
 */
export async function withQuotaRollback<T>(ticket: QuotaTicket, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    await finalizeQuota(ticket, false).catch(() => undefined);
    throw err;
  }
}

/** Consumo imediato (recursos não-IA): reserva e confirma na mesma operação. */
export async function consumeQuota(userId: string, resource: QuotaResource, requestId: string, now = new Date()): Promise<void> {
  const t = await reserveQuota(userId, resource, requestId, now);
  await finalizeQuota(t, true);
}

export async function quotaUsage(tx: Tx, userId: string, now = new Date()) {
  const { plan, source, until } = await userPlan(tx, userId, now);
  const limits = await tx.query<{ resource: QuotaResource; period: 'day' | 'month'; limit_value: number | null }>(
    'select resource, period, limit_value from plan_limits where plan_code = $1 order by resource', [plan]);
  const out = [];
  for (const l of limits) {
    const [u] = await tx.query<{ n: number }>(
      `select count(*)::int as n from quota_usage where user_id = $1 and resource = $2 and period_key = $3 and status in ('reserved','consumed')`,
      [userId, l.resource, periodKey(l.period, now)]);
    out.push({ resource: l.resource, period: l.period, limit: l.limit_value, used: u!.n, label: QUOTA_LABEL[l.resource] });
  }
  return { plan, source, until, resources: out };
}

// ---------------------------------------------------------------------------
// Gamificação (9): XP idempotente, dias de estudo, conquistas.
// ---------------------------------------------------------------------------
export type XpActivity = 'question' | 'flashcard' | 'microlesson' | 'lesson' | 'concept_explanation' | 'discursive_exercise' | 'rewrite' | 'essay';

export async function awardXp(tx: Tx, userId: string, activity: XpActivity, sourceKey: string): Promise<number> {
  const rows = await tx.query<{ xp: number }>(
    `insert into xp_events (user_id, activity_type, xp, source_key)
     select $1, r.activity_type, r.xp, $3 from xp_rules r where r.activity_type = $2
     on conflict (user_id, source_key) do nothing returning xp`, [userId, activity, sourceKey]);
  return rows[0]?.xp ?? 0;
}

export async function markStudyDay(tx: Tx, userId: string, at = new Date()): Promise<void> {
  await tx.query('insert into study_days (user_id, day) values ($1, $2) on conflict do nothing', [userId, localDate(at)]);
}

export async function checkAchievements(tx: Tx, userId: string): Promise<string[]> {
  const [m] = await tx.query<Record<string, number>>(
    `select
       (select count(*)::int from attempts where user_id = $1) as questions_answered,
       (select count(*)::int from essay_evaluations ev join essay_versions v on v.id = ev.essay_version_id join essays e on e.id = v.essay_id
          where e.user_id = $1 and ev.kind = 'full') as essays_evaluated,
       (select count(*)::int from exam_attempts where user_id = $1 and status = 'finished') as exams_finished,
       (select count(*)::int from mastery_scores where user_id = $1 and state = 'consolidated') as skills_consolidated,
       (select count(*)::int from review_logs where user_id = $1) as flashcards_reviewed`, [userId]);
  const days = await tx.query<{ day: string }>(`select to_char(day, 'YYYY-MM-DD') as day from study_days where user_id = $1`, [userId]);
  const metrics: Record<string, number> = { ...m!, streak: currentStreak(days.map((d) => d.day), localDate(new Date())) };
  const all = await tx.query<{ code: string; criteria: { metric: string; gte: number } }>(
    `select a.code, a.criteria from achievements a where not exists (select 1 from user_achievements ua where ua.user_id = $1 and ua.achievement_code = a.code)`, [userId]);
  const earned: string[] = [];
  for (const a of all) {
    if ((metrics[a.criteria.metric] ?? 0) >= a.criteria.gte) {
      await tx.query('insert into user_achievements (user_id, achievement_code) values ($1,$2) on conflict do nothing', [userId, a.code]);
      earned.push(a.code);
    }
  }
  return earned;
}

export async function audit(tx: Tx, actorId: string | null, actorRole: string, action: string, entity: string, entityId: string | null, details: Record<string, unknown> = {}): Promise<void> {
  await tx.query('insert into audit_logs (actor_id, actor_role, action, entity, entity_id, details) values ($1,$2,$3,$4,$5,$6)',
    [actorId, actorRole, action, entity, entityId, JSON.stringify(details)]);
}

export function toNumber(v: unknown): number | null {
  return num(v);
}
