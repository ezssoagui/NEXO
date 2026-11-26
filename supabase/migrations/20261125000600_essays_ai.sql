-- NEXO — Redação (temas, motivadores, repertórios, exercícios, versões, avaliações),
-- RAG (pgvector) e governança de IA (modelos, prompts, uso, orçamento).
-- Subtópicos: 6.1–6.10, 7.1–7.10, 15.8
create extension if not exists vector;

create table public.ai_models (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('essay', 'mini', 'nano', 'embedding', 'validator')),
  provider text not null default 'openai',
  model_id text not null,
  status text not null default 'pending_confirmation' check (status in ('pending_confirmation', 'approved', 'retired')),
  input_usd_per_mtok numeric(10, 4),
  output_usd_per_mtok numeric(10, 4),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (purpose, model_id)
);
-- Um modelo aprovado por finalidade; troca somente por decisão administrativa (7.2/7.10).
create unique index ai_models_one_approved on public.ai_models (purpose) where status = 'approved';

create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('essay_full', 'essay_partial', 'concept_eval', 'discursive_eval', 'cpe_eval', 'twin_generate', 'twin_validate', 'question_classify')),
  version text not null,
  template text not null,
  status text not null default 'active' check (status in ('draft', 'active', 'retired')),
  created_at timestamptz not null default now(),
  unique (purpose, version)
);
create unique index prompt_versions_one_active on public.prompt_versions (purpose) where status = 'active';

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  purpose text not null,
  plan_code text,
  model_id text,
  prompt_version_id uuid references public.prompt_versions(id),
  request_id text not null,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(12, 6),
  latency_ms integer,
  attempt_no smallint not null default 1,
  status text not null check (status in ('success', 'invalid_output', 'provider_error', 'timeout', 'unavailable', 'budget_blocked')),
  error_code text,
  created_at timestamptz not null default now()
);
create index ai_usage_created_idx on public.ai_usage (created_at desc);
create index ai_usage_purpose_idx on public.ai_usage (purpose, created_at desc);

create table public.ai_budgets (
  period_key text primary key,
  budget_usd numeric(12, 2) not null check (budget_usd > 0),
  hard_limit boolean not null default true,
  alerted_70 boolean not null default false,
  alerted_90 boolean not null default false,
  alerted_100 boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Temas e propostas (6.4)
create table public.essay_themes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null check (kind in ('official', 'nexo_original')),
  year integer,
  application text check (application in ('regular', 'ppl', 'reaplicacao', 'digital', 'outra')),
  axis text,
  instructions_md text,
  status public.publication_status not null default 'staging',
  verification_status public.verification_status not null default 'pending_validation',
  rights_status text not null default 'unknown' check (rights_status in ('unknown', 'official_public_pending_review', 'authorized', 'own', 'synthetic', 'restricted')),
  is_synthetic boolean not null default false,
  source_id uuid references public.content_sources(id),
  source_locator text,
  search_tsv tsvector generated always as (to_tsvector('portuguese', title || ' ' || coalesce(axis, ''))) stored,
  created_at timestamptz not null default now()
);

create table public.motivator_texts (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.essay_themes(id) on delete cascade,
  position smallint not null,
  body_md text not null,
  source_citation text not null,
  rights_status text not null default 'unknown' check (rights_status in ('unknown', 'authorized', 'own', 'synthetic', 'restricted')),
  unique (theme_id, position)
);

-- Repertórios (6.7): seleção pedagógica específica, não favoritos gerais.
create table public.repertoires (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  concept_md text not null,
  source_citation text not null,
  context_md text,
  applications_md text,
  axes text[] not null default '{}',
  status public.publication_status not null default 'staging',
  is_synthetic boolean not null default false,
  source_id uuid references public.content_sources(id),
  search_tsv tsvector generated always as (to_tsvector('portuguese', title || ' ' || concept_md)) stored,
  created_at timestamptz not null default now()
);

create table public.user_repertoires (
  user_id uuid not null references auth.users(id) on delete cascade,
  repertoire_id uuid not null references public.repertoires(id) on delete cascade,
  selected_at timestamptz not null default now(),
  primary key (user_id, repertoire_id)
);

-- Teoria por competência e exercícios discursivos (6.5)
create table public.essay_theory (
  id uuid primary key default gen_random_uuid(),
  competency smallint not null check (competency between 1 and 5),
  title text not null,
  body_md text not null,
  status public.publication_status not null default 'staging',
  is_synthetic boolean not null default false,
  source_id uuid references public.content_sources(id),
  created_at timestamptz not null default now()
);

create table public.essay_exercises (
  id uuid primary key default gen_random_uuid(),
  competency smallint not null check (competency between 1 and 5),
  kind text not null check (kind in ('thesis', 'argumentation', 'cohesion', 'intervention', 'repertoire', 'introduction', 'conclusion', 'grammar', 'other')),
  prompt_md text not null,
  reference_md text,
  status public.publication_status not null default 'staging',
  is_synthetic boolean not null default false,
  source_id uuid references public.content_sources(id),
  created_at timestamptz not null default now()
);

create table public.essays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  theme_id uuid references public.essay_themes(id),
  custom_theme_title text check (char_length(custom_theme_title) <= 300),
  origin text not null default 'free' check (origin in ('free', 'exam', 'diagnostic')),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'evaluated', 'failed')),
  current_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (theme_id is not null or custom_theme_title is not null)
);
create trigger essays_touch before update on public.essays for each row execute function public.touch_updated_at();

-- Rascunho com salvamento automático (6.8)
create table public.essay_drafts (
  essay_id uuid primary key references public.essays(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 20000),
  updated_at timestamptz not null default now()
);

-- Versões preservadas (6.6)
create table public.essay_versions (
  id uuid primary key default gen_random_uuid(),
  essay_id uuid not null references public.essays(id) on delete cascade,
  version integer not null check (version >= 1),
  kind text not null check (kind in ('full', 'partial_rewrite', 'full_rewrite')),
  body text not null check (char_length(body) between 1 and 20000),
  target_competency smallint check (target_competency between 1 and 5),
  parent_version integer,
  line_count integer,
  word_count integer not null,
  submitted_at timestamptz not null default now(),
  unique (essay_id, version)
);

-- Avaliação estimada (6.1): notas 0..200 em incrementos de 40, total coerente.
create table public.essay_evaluations (
  id uuid primary key default gen_random_uuid(),
  essay_version_id uuid not null references public.essay_versions(id) on delete cascade,
  kind text not null check (kind in ('full', 'partial')),
  c1 smallint check (c1 in (0, 40, 80, 120, 160, 200)),
  c2 smallint check (c2 in (0, 40, 80, 120, 160, 200)),
  c3 smallint check (c3 in (0, 40, 80, 120, 160, 200)),
  c4 smallint check (c4 in (0, 40, 80, 120, 160, 200)),
  c5 smallint check (c5 in (0, 40, 80, 120, 160, 200)),
  total smallint check (total between 0 and 1000),
  zeroed boolean not null default false,
  zero_reason text,
  result jsonb not null,
  model_id text not null,
  prompt_version_id uuid references public.prompt_versions(id),
  ai_usage_id uuid references public.ai_usage(id),
  created_at timestamptz not null default now(),
  check (kind <> 'full' or (c1 is not null and c2 is not null and c3 is not null and c4 is not null and c5 is not null
    and total = c1 + c2 + c3 + c4 + c5))
);

create table public.discursive_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.essay_exercises(id),
  response_text text not null check (char_length(response_text) between 1 and 6000),
  status text not null default 'submitted' check (status in ('submitted', 'evaluated', 'failed')),
  evaluation jsonb,
  ai_usage_id uuid references public.ai_usage(id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

-- RAG: documentos de referência autorizados; benchmark humano separado (6.3/7.5).
create table public.rag_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('rubric', 'criteria', 'graded_example', 'zero_rule')),
  usage text not null check (usage in ('rag', 'benchmark')),
  competency smallint check (competency between 1 and 5),
  level smallint check (level in (0, 40, 80, 120, 160, 200)),
  title text not null,
  body text not null,
  known_scores jsonb,
  source_id uuid references public.content_sources(id),
  source_locator text,
  rights_status text not null default 'unknown' check (rights_status in ('unknown', 'official_public_pending_review', 'authorized', 'restricted', 'own', 'synthetic')),
  status public.verification_status not null default 'pending_validation',
  created_at timestamptz not null default now(),
  -- Notas por competência só quando conhecidas; nunca inventadas (6.3).
  check (kind <> 'graded_example' or known_scores is not null)
);

create table public.rag_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.rag_documents(id) on delete cascade,
  position integer not null,
  content text not null,
  embedding vector(1536),
  embedding_model text,
  unique (document_id, position)
);

create table public.essay_benchmark_runs (
  id uuid primary key default gen_random_uuid(),
  model_id text not null,
  prompt_version_id uuid references public.prompt_versions(id),
  sample_size integer not null,
  mae_total numeric(8, 2),
  mae_by_competency jsonb,
  exact_agreement jsonb,
  details jsonb,
  created_at timestamptz not null default now()
);
