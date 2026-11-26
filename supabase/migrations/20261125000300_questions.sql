-- NEXO — Banco oficial de questões do ENEM, proveniência, importação e revisão de conteúdo.
-- Subtópicos: 3.7–3.9, 5.2, 12.5, 13.9, 15.4
create table public.exam_editions (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 1998 and 2100),
  application text not null check (application in ('regular', 'ppl', 'reaplicacao', 'digital', 'outra')),
  day smallint not null check (day in (1, 2)),
  notes text,
  source_id uuid references public.content_sources(id),
  unique (year, application, day)
);

create table public.exam_booklets (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.exam_editions(id),
  co_prova integer,
  color text,
  is_adapted boolean not null default false,
  source_url text,
  sha256 text,
  unique (edition_id, co_prova)
);

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('enem_items', 'enem_answer_keys', 'curriculum', 'lessons', 'flashcards', 'essay_refs', 'other')),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  manifest jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.import_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.import_runs(id) on delete cascade,
  external_key text not null,
  status text not null check (status in ('staged', 'duplicate', 'error', 'excluded', 'loaded')),
  payload jsonb,
  error text,
  unique (run_id, external_key)
);

create type public.publication_status as enum ('staging', 'pending_review', 'published', 'retired');

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  area_code text not null references public.areas(code),
  co_item integer unique,
  edition_id uuid references public.exam_editions(id),
  year integer,
  application text,
  language text check (language in ('en', 'es')),
  statement_md text not null check (char_length(statement_md) > 0),
  correct_alternative char(1) check (correct_alternative in ('A', 'B', 'C', 'D', 'E')),
  is_annulled boolean not null default false,
  param_a numeric,
  param_b numeric,
  param_c numeric,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  difficulty_source text check (difficulty_source in ('official_param_b', 'pedagogical_provisional')),
  primary_subtopic_id uuid references public.subtopics(id),
  primary_skill_id uuid references public.skills(id),
  official_skill_id uuid references public.official_skills(id),
  classification_status text not null default 'unclassified'
    check (classification_status in ('unclassified', 'ai_suggested', 'validated')),
  classification_source text,
  classification_confidence numeric(3, 2) check (classification_confidence between 0 and 1),
  is_synthetic boolean not null default false,
  rights_status text not null default 'unknown'
    check (rights_status in ('unknown', 'official_public_pending_review', 'authorized', 'restricted', 'own', 'synthetic')),
  publication_status public.publication_status not null default 'staging',
  source_id uuid references public.content_sources(id),
  import_run_id uuid references public.import_runs(id),
  version integer not null default 1,
  search_tsv tsvector generated always as (to_tsvector('portuguese', statement_md)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  -- Questão publicada exige gabarito (ou anulação), classificação validada e situação autoral verificada (5.2/13.9/A.3.8).
  constraint published_requirements check (
    publication_status <> 'published' or (
      (correct_alternative is not null or is_annulled)
      and classification_status = 'validated'
      and primary_skill_id is not null
      and rights_status in ('official_public_pending_review', 'authorized', 'own', 'synthetic')
    )
  ),
  -- Item sintético nunca coexiste com identificador oficial.
  constraint synthetic_not_official check (not is_synthetic or co_item is null)
);
create trigger questions_touch before update on public.questions for each row execute function public.touch_updated_at();
create index questions_skill_idx on public.questions (primary_skill_id) where publication_status = 'published';
create index questions_subtopic_idx on public.questions (primary_subtopic_id) where publication_status = 'published';
create index questions_area_idx on public.questions (area_code, year);
create index questions_search_idx on public.questions using gin (search_tsv);

-- Deduplicação entre cadernos: uma questão, várias posições (3.8).
create table public.question_booklet_positions (
  question_id uuid not null references public.questions(id) on delete cascade,
  booklet_id uuid not null references public.exam_booklets(id) on delete cascade,
  position smallint not null check (position between 1 and 180),
  primary key (question_id, booklet_id),
  unique (booklet_id, position)
);

create table public.question_assets (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  kind text not null check (kind in ('image', 'table', 'formula')),
  storage_key text not null,
  alt_text text not null default '',
  verified boolean not null default false,
  sort smallint not null default 0
);

create table public.alternatives (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  letter char(1) not null check (letter in ('A', 'B', 'C', 'D', 'E')),
  body_md text not null,
  asset_id uuid references public.question_assets(id),
  unique (question_id, letter)
);

create table public.question_tags (
  question_id uuid not null references public.questions(id) on delete cascade,
  subtopic_id uuid not null references public.subtopics(id),
  skill_id uuid references public.skills(id),
  role text not null check (role in ('secondary', 'transversal')),
  primary key (question_id, subtopic_id, role)
);

create table public.question_solutions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  version integer not null default 1,
  body_md text not null,
  -- Referência do método CPE (2.6) para LC/CH: {comando, prova, eliminacao: {A..E}}.
  cpe_reference jsonb,
  author_kind text not null check (author_kind in ('nexo_own', 'ai_draft', 'synthetic')),
  validation_status text not null default 'draft' check (validation_status in ('draft', 'validated', 'rejected')),
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  unique (question_id, version)
);

create table public.question_revisions (
  id bigint generated always as identity primary key,
  question_id uuid not null references public.questions(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

-- Fila de validação técnica/pedagógica/autoral (12.5).
create table public.content_reviews (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  review_kind text not null check (review_kind in ('technical', 'pedagogical', 'rights')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'changes_requested')),
  reviewer_id uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index content_reviews_pending_idx on public.content_reviews (status, entity_type) where status = 'pending';
