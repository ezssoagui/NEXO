-- NEXO — Fundação: usuários, papéis, preferências, documentos legais, consentimentos,
-- direitos do titular, auditoria, limites de taxa e configurações.
-- Subtópicos: 4.1, 10.4, 12.2, 13.1, 13.2, 13.3, 13.6, 13.8, 13.10, 15.3
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Perfis (cadastro mínimo — 4.1/13.1)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  enem_target_year integer not null check (enem_target_year between 2024 and 2100),
  birth_date date not null check (birth_date > date '1900-01-01'),
  foreign_language text check (foreign_language in ('en', 'es')),
  course_goal text check (char_length(course_goal) <= 120),
  university_goal text check (char_length(university_goal) <= 120),
  current_institution text check (char_length(current_institution) <= 120),
  -- Proteção de menores (13.2): status de consentimento do responsável.
  guardian_consent_status text not null default 'not_required'
    check (guardian_consent_status in ('not_required', 'pending', 'granted', 'revoked')),
  -- Ranking opt-in (9.6): desligado por padrão; nome de exibição separado do nome cadastral.
  ranking_opt_in boolean not null default false,
  ranking_display_name text check (ranking_display_name ~ '^[A-Za-z0-9_\-\. ]{3,24}$'),
  onboarding_completed_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ranking_requires_display_name check (not ranking_opt_in or ranking_display_name is not null)
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create or replace function public.is_minor(p_birth date, p_at date default current_date) returns boolean
language sql immutable as $$ select p_birth > (p_at - interval '18 years')::date $$;

-- ---------------------------------------------------------------------------
-- Papéis (12.2): MVP somente estudante e administrador.
-- ---------------------------------------------------------------------------
create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'admin')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Admin exige papel + autenticação multifator (aal2) no token (13.3).
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin')
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

-- ---------------------------------------------------------------------------
-- Preferências (10.4, 10.6)
-- ---------------------------------------------------------------------------
create table public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  question_layout text not null default 'vertical' check (question_layout in ('vertical', 'split')),
  show_question_timer boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger preferences_touch before update on public.preferences for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Documentos legais versionados e aceites (13.10)
-- ---------------------------------------------------------------------------
create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('terms', 'privacy', 'subscription', 'cookies', 'guardian_info', 'security_policy')),
  version text not null,
  title text not null,
  body_md text not null,
  status text not null default 'draft' check (status in ('draft', 'pending_legal_review', 'published', 'retired')),
  requires_acceptance boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (kind, version)
);

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.legal_documents(id),
  accepted_at timestamptz not null default now(),
  unique (user_id, document_id)
);

-- Consentimentos opcionais separados do aceite geral (13.10).
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('product_emails', 'pilot_research', 'ranking_public_name')),
  granted boolean not null,
  document_version text,
  created_at timestamptz not null default now()
);
create index consents_user_idx on public.consents (user_id, purpose, created_at desc);

-- Consentimento do responsável para menores (13.2). Token guardado somente como hash.
create table public.guardian_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  guardian_email text not null,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'granted', 'revoked', 'expired')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Direitos do titular (13.6)
-- ---------------------------------------------------------------------------
create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('access', 'export', 'correction', 'deletion')),
  status text not null default 'received' check (status in ('received', 'in_progress', 'completed', 'rejected')),
  details text check (char_length(details) <= 2000),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);

create table public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id_hash text not null,
  requested_at timestamptz not null,
  executed_at timestamptz not null default now(),
  retained jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Auditoria (12.4, 15.3) — sem PII além de identificadores internos.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role text,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Limitação de taxa (13.8) sem Redis: janela fixa transacional.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null
);

create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.rate_limits;
begin
  insert into public.rate_limits as rl (key, window_start, count) values (p_key, v_now, 1)
  on conflict (key) do update set
    window_start = case when rl.window_start < v_now - make_interval(secs => p_window_seconds) then v_now else rl.window_start end,
    count = case when rl.window_start < v_now - make_interval(secs => p_window_seconds) then 1 else rl.count + 1 end
  returning * into v_row;
  return v_row.count <= p_limit;
end $$;

-- ---------------------------------------------------------------------------
-- Configurações administrativas versionadas (A.3.7)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  status text not null default 'proposal' check (status in ('proposal', 'approved')),
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
