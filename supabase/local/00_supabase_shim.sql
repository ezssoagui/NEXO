-- =============================================================================
-- SHIM LOCAL (somente PGlite / desenvolvimento / testes). NÃO aplicar no Supabase.
-- Reproduz o mínimo do ambiente Supabase de que as migrações dependem:
-- papéis anon/authenticated/service_role, schema auth, auth.users, auth.uid(),
-- auth.jwt() e auth.role(), com a mesma semântica de leitura de claims.
-- Também cria a tabela de credenciais do provedor de autenticação LOCAL (dev),
-- que não existe em produção (Supabase Auth guarda as credenciais).
-- =============================================================================
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create schema if not exists extensions;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- Credenciais do provedor LOCAL de desenvolvimento (hash scrypt). Inexistente em produção.
create table if not exists auth.local_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  password_hash text not null,
  totp_secret text,
  totp_confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists auth.local_tokens (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('email_verification', 'password_reset')),
  expires_at timestamptz not null,
  used_at timestamptz
);
