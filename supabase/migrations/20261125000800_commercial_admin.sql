-- NEXO — Planos, franquias transacionais, assinaturas Asaas, webhooks idempotentes,
-- acessos temporários, cupons, feedback, financeiro manual, alertas e backups.
-- Subtópicos: 6.10, 7.9, 11.3–11.5, 11.10, 12.3–12.7, 13.5, 13.7, 13.8, 14.7, 15.9
create table public.plans (
  code text primary key check (code in ('free', 'plus', 'pro')),
  name text not null,
  rank smallint not null unique,
  -- Preços NÃO definidos (11.10): nulos até aprovação dos sócios.
  monthly_price_cents integer check (monthly_price_cents > 0),
  annual_price_cents integer check (annual_price_cents > 0),
  price_status text not null default 'not_defined' check (price_status in ('not_defined', 'pending_approval', 'approved')),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  check (price_status <> 'approved' or code = 'free' or (monthly_price_cents is not null and annual_price_cents is not null))
);

-- Franquias por recurso, configuráveis (11.4/11.5). limit_value nulo = ilimitado (uso legítimo).
create table public.plan_limits (
  plan_code text not null references public.plans(code),
  resource text not null check (resource in (
    'questions', 'adaptive_sessions', 'flashcards', 'explanations', 'essays', 'rewrites', 'discursive', 'exams')),
  period text not null check (period in ('day', 'month')),
  limit_value integer check (limit_value >= 0),
  version text not null,
  updated_at timestamptz not null default now(),
  primary key (plan_code, resource)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.plans(code) check (plan_code <> 'free'),
  cycle text not null check (cycle in ('monthly', 'annual')),
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'canceled', 'expired', 'refunded')),
  provider text not null default 'asaas',
  provider_customer_id text,
  provider_subscription_id text unique,
  price_cents integer,
  current_period_start timestamptz,
  current_period_end timestamptz,
  first_paid_at timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  grace_until timestamptz,
  scheduled_plan_code text references public.plans(code),
  replaced_by uuid references public.subscriptions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.touch_updated_at();
create index subscriptions_user_idx on public.subscriptions (user_id, status);
-- No máximo uma assinatura vigente por usuário.
create unique index subscriptions_one_live on public.subscriptions (user_id) where status in ('active', 'past_due');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  provider_payment_id text not null unique,
  amount_cents integer not null,
  net_cents integer,
  status text not null,
  billing_type text,
  due_date date,
  paid_at timestamptz,
  refunded_at timestamptz,
  invoice_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();

create table public.coupons (
  code text primary key check (code ~ '^[A-Z0-9_-]{3,32}$'),
  kind text not null check (kind in ('percent', 'access_grant')),
  value integer not null check (value > 0),
  plan_code text references public.plans(code),
  grant_days integer check (grant_days between 1 and 366),
  max_redemptions integer,
  redeemed_count integer not null default 0,
  valid_until timestamptz,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100),
  check (kind <> 'access_grant' or (plan_code is not null and grant_days is not null))
);

create table public.coupon_redemptions (
  coupon_code text not null references public.coupons(code),
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (coupon_code, user_id)
);

-- Acessos temporários Plus/Pro (piloto/campanhas/parcerias — 12.4).
create table public.access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.plans(code) check (plan_code <> 'free'),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  reason text not null,
  campaign text,
  granted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index access_grants_user_idx on public.access_grants (user_id, ends_at);

-- Webhooks: persistência e processamento idempotente (15.9).
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  error text,
  unique (provider, event_id)
);

-- Franquias: reserva → confirmação → liberação, idempotente por requisição (15.9).
create table public.quota_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource text not null,
  period_key text not null,
  request_id text not null,
  status text not null check (status in ('reserved', 'consumed', 'released')),
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  unique (user_id, resource, request_id)
);
create index quota_usage_period_idx on public.quota_usage (user_id, resource, period_key, status);

create or replace function public.reserve_quota(
  p_user uuid, p_resource text, p_period_key text, p_request_id text, p_limit integer, p_ttl_seconds integer default 900
) returns table (outcome text, used integer)
language plpgsql as $$
declare
  v_existing public.quota_usage;
  v_used integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_resource || ':' || p_period_key, 0));
  select * into v_existing from public.quota_usage q
   where q.user_id = p_user and q.resource = p_resource and q.request_id = p_request_id;
  if found then
    return query select ('duplicate_' || v_existing.status)::text, null::integer;
    return;
  end if;
  update public.quota_usage q set status = 'released', finalized_at = now()
   where q.user_id = p_user and q.resource = p_resource and q.period_key = p_period_key
     and q.status = 'reserved' and q.created_at < now() - make_interval(secs => p_ttl_seconds);
  select count(*)::integer into v_used from public.quota_usage q
   where q.user_id = p_user and q.resource = p_resource and q.period_key = p_period_key
     and q.status in ('reserved', 'consumed');
  if p_limit is not null and v_used >= p_limit then
    return query select 'exceeded'::text, v_used;
    return;
  end if;
  insert into public.quota_usage (user_id, resource, period_key, request_id, status)
  values (p_user, p_resource, p_period_key, p_request_id, 'reserved');
  return query select 'reserved'::text, v_used + 1;
end $$;

create or replace function public.finalize_quota(p_user uuid, p_resource text, p_request_id text, p_success boolean)
returns text language plpgsql as $$
declare v_status text;
begin
  update public.quota_usage q
     set status = case when p_success then 'consumed' else 'released' end, finalized_at = now()
   where q.user_id = p_user and q.resource = p_resource and q.request_id = p_request_id and q.status = 'reserved'
  returning q.status into v_status;
  return coalesce(v_status, 'not_reserved');
end $$;

-- Feedback discreto (14.7)
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('question_error', 'evaluation_issue', 'technical', 'suggestion')),
  entity_type text,
  entity_id uuid,
  message text not null check (char_length(message) between 3 and 2000),
  status text not null default 'open' check (status in ('open', 'triaged', 'resolved', 'dismissed')),
  handled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Financeiro híbrido: despesas manuais (12.6)
create table public.manual_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('infrastructure', 'marketing', 'accounting', 'taxes', 'domain', 'other')),
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  competence_month date not null check (extract(day from competence_month) = 1),
  is_estimate boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.marketing_metrics (
  id uuid primary key default gen_random_uuid(),
  competence_month date not null check (extract(day from competence_month) = 1),
  channel text not null,
  spend_cents integer not null default 0 check (spend_cents >= 0),
  signups integer,
  notes text,
  unique (competence_month, channel)
);

-- Monitoramento e alertas (12.7)
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  severity text not null check (severity in ('info', 'warning', 'high', 'critical')),
  message text not null,
  details jsonb not null default '{}'::jsonb,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null
);

-- Registro de backups e testes de restauração (13.5)
create table public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('backup', 'restore_test')),
  status text not null check (status in ('success', 'failed')),
  started_at timestamptz not null,
  finished_at timestamptz,
  size_bytes bigint,
  sha256 text,
  location_hint text,
  notes text
);
