-- NEXO — Currículo versionado, matriz oficial, relevância e conexões.
-- Subtópicos: 3.1–3.6, 3.10, 3.11, 8.7, 13.9
create table public.content_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  kind text not null check (kind in ('official', 'private_reference', 'own', 'licensed', 'synthetic_test')),
  url text,
  edition text,
  sha256 text,
  rights_status text not null default 'unknown'
    check (rights_status in ('unknown', 'official_public_pending_review', 'authorized', 'restricted', 'own', 'synthetic')),
  notes text,
  created_at timestamptz not null default now()
);

create table public.curriculum_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  notes text,
  created_at timestamptz not null default now(),
  activated_at timestamptz
);
-- No máximo uma versão ativa.
create unique index curriculum_versions_one_active on public.curriculum_versions ((status)) where status = 'active';

create table public.areas (
  code text primary key check (code in ('LC', 'MT', 'CN', 'CH')),
  name text not null,
  exam_day smallint not null check (exam_day in (1, 2)),
  sort smallint not null
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  area_code text not null references public.areas(code),
  code text not null unique,
  name text not null,
  sort integer not null default 0
);

create type public.verification_status as enum ('draft', 'pending_validation', 'validated', 'retired');

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id),
  curriculum_version_id uuid not null references public.curriculum_versions(id),
  code text not null unique,
  name text not null,
  sort integer not null default 0,
  source_id uuid references public.content_sources(id),
  source_locator text,
  verification_status public.verification_status not null default 'draft'
);

create table public.subtopics (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id),
  curriculum_version_id uuid not null references public.curriculum_versions(id),
  code text not null unique,
  name text not null,
  description text,
  sort integer not null default 0,
  -- Relevância geral estática/versionada (3.4). 'unknown' NÃO equivale a baixa.
  relevance text not null default 'unknown' check (relevance in ('low', 'medium', 'high', 'unknown')),
  relevance_source_id uuid references public.content_sources(id),
  relevance_locator text,
  source_id uuid references public.content_sources(id),
  source_locator text,
  verification_status public.verification_status not null default 'draft',
  search_tsv tsvector generated always as (to_tsvector('portuguese', coalesce(name, '') || ' ' || coalesce(description, ''))) stored
);
create index subtopics_topic_idx on public.subtopics (topic_id);
create index subtopics_search_idx on public.subtopics using gin (search_tsv);

-- Habilidade interna significativa (3.1/3.2). Peso visual igual (8.7).
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  subtopic_id uuid not null references public.subtopics(id),
  curriculum_version_id uuid not null references public.curriculum_versions(id),
  code text not null unique,
  name text not null,
  description text,
  is_transversal boolean not null default false,
  eligible boolean not null default true,
  sort integer not null default 0,
  verification_status public.verification_status not null default 'draft'
);
create index skills_subtopic_idx on public.skills (subtopic_id);

-- Matriz de referência oficial do Inep (3.3) — distinta da habilidade interna.
create table public.official_competencies (
  id uuid primary key default gen_random_uuid(),
  area_code text not null references public.areas(code),
  number smallint not null,
  description text not null,
  source_id uuid references public.content_sources(id),
  unique (area_code, number)
);

create table public.official_skills (
  id uuid primary key default gen_random_uuid(),
  area_code text not null references public.areas(code),
  number smallint not null check (number between 1 and 30),
  competency_id uuid not null references public.official_competencies(id),
  description text not null,
  source_id uuid references public.content_sources(id),
  unique (area_code, number)
);

create table public.skill_official_links (
  skill_id uuid not null references public.skills(id) on delete cascade,
  official_skill_id uuid not null references public.official_skills(id),
  confidence text not null check (confidence in ('official', 'inferred_high', 'inferred_low')),
  source_id uuid references public.content_sources(id),
  primary key (skill_id, official_skill_id)
);

-- Pré-requisitos e conexões úteis (3.6). Nunca bloqueiam acesso.
create table public.skill_connections (
  from_skill_id uuid not null references public.skills(id) on delete cascade,
  to_skill_id uuid not null references public.skills(id) on delete cascade,
  kind text not null check (kind in ('prerequisite', 'connection', 'transversal')),
  weight numeric(4, 2) not null default 1 check (weight > 0 and weight <= 5),
  primary key (from_skill_id, to_skill_id, kind),
  check (from_skill_id <> to_skill_id)
);

-- Histórico de alterações curriculares (3.11): não destrói histórico.
create table public.curriculum_change_log (
  id bigint generated always as identity primary key,
  curriculum_version_id uuid references public.curriculum_versions(id),
  entity text not null,
  entity_id uuid,
  change text not null check (change in ('create', 'update', 'retire', 'merge', 'move')),
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Proibir exclusão física de habilidades/subtópicos com evidências: usar 'retired'.
create or replace function public.forbid_curriculum_delete() returns trigger language plpgsql as $$
begin
  raise exception 'Exclusão física de currículo proibida; use verification_status = retired (3.11)';
end $$;
create trigger skills_no_delete before delete on public.skills for each row execute function public.forbid_curriculum_delete();
create trigger subtopics_no_delete before delete on public.subtopics for each row execute function public.forbid_curriculum_delete();
