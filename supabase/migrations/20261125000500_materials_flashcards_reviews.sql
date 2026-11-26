-- NEXO — Aulas/microaulas/blocos validados, atividades conceituais, materiais montados,
-- flashcards FSRS e revisões curriculares.
-- Subtópicos: 2.5, 2.10, 2.11, 5.1, 5.4, 5.6, 5.10, 5.11, 7.4, 15.7
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  subtopic_id uuid not null references public.subtopics(id),
  kind text not null check (kind in ('lesson', 'microlesson', 'summary', 'worked_example', 'visual')),
  title text not null,
  is_free boolean not null default false,
  estimated_minutes smallint check (estimated_minutes between 1 and 180),
  status public.publication_status not null default 'staging',
  is_synthetic boolean not null default false,
  rights_status text not null default 'own' check (rights_status in ('unknown', 'authorized', 'own', 'synthetic', 'restricted')),
  source_id uuid references public.content_sources(id),
  version integer not null default 1,
  search_tsv tsvector generated always as (to_tsvector('portuguese', title)) stored,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index lessons_subtopic_idx on public.lessons (subtopic_id) where status = 'published';
create index lessons_search_idx on public.lessons using gin (search_tsv);

create table public.lesson_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  position smallint not null,
  block_type text not null check (block_type in ('text', 'example', 'formula', 'image', 'key_point', 'summary_point')),
  body_md text not null,
  asset_key text,
  is_final_review boolean not null default false,
  unique (lesson_id, position)
);

create table public.lesson_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  first_read_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  completed_at timestamptz,
  read_count integer not null default 1,
  primary key (user_id, lesson_id)
);

-- Atividades conceituais previamente produzidas e validadas (2.5/5.4).
create table public.concept_activities (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills(id),
  kind text not null check (kind in ('definition', 'comparison', 'cause_effect', 'justification', 'application')),
  prompt_md text not null,
  reference_answer_md text not null,
  rubric_notes text,
  status public.publication_status not null default 'staging',
  is_synthetic boolean not null default false,
  source_id uuid references public.content_sources(id),
  created_at timestamptz not null default now()
);
create index concept_activities_skill_idx on public.concept_activities (skill_id) where status = 'published';

create table public.concept_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references public.concept_activities(id),
  session_activity_id uuid references public.session_activities(id) on delete set null,
  response_text text not null check (char_length(response_text) between 1 and 4000),
  status text not null default 'submitted' check (status in ('submitted', 'evaluated', 'failed')),
  score smallint check (score between 0 and 3),
  feedback jsonb,
  ai_usage_id uuid,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  evaluated_at timestamptz,
  unique (user_id, idempotency_key)
);

-- Materiais personalizados montados a partir de blocos existentes (5.11).
create table public.study_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('subtopic', 'subject', 'area', 'final_review')),
  scope_ref text,
  title text not null,
  composition jsonb not null,
  created_at timestamptz not null default now()
);

-- Flashcards (5.6/15.7)
create table public.decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id),
  subtopic_id uuid references public.subtopics(id),
  title text not null check (char_length(title) between 1 and 120),
  kind text not null check (kind in ('curricular', 'errors', 'concepts', 'personal')),
  status public.publication_status not null default 'staging',
  is_synthetic boolean not null default false,
  source_id uuid references public.content_sources(id),
  created_at timestamptz not null default now(),
  check ((kind = 'personal') = (owner_id is not null))
);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  skill_id uuid references public.skills(id),
  front_md text not null check (char_length(front_md) between 1 and 2000),
  back_md text not null check (char_length(back_md) between 1 and 4000),
  origin text not null check (origin in ('curricular', 'error', 'concept', 'user')),
  status public.publication_status not null default 'staging',
  is_synthetic boolean not null default false,
  search_tsv tsvector generated always as (to_tsvector('portuguese', front_md || ' ' || back_md)) stored,
  created_at timestamptz not null default now()
);
create index flashcards_deck_idx on public.flashcards (deck_id);
create index flashcards_search_idx on public.flashcards using gin (search_tsv);

create table public.card_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  due timestamptz not null,
  state smallint not null check (state between 0 and 3),
  stability double precision not null,
  difficulty double precision not null,
  reps integer not null default 0,
  lapses integer not null default 0,
  last_review timestamptz,
  -- Estado completo do agendador ts-fsrs (para reprocessamento/migração de parâmetros — 15.7).
  card jsonb not null,
  fsrs_version text not null,
  primary key (user_id, flashcard_id)
);
create index card_states_due_idx on public.card_states (user_id, due);

create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  rating smallint not null check (rating between 1 and 4),
  state_before smallint not null,
  elapsed_days numeric(10, 4) not null,
  scheduled_days numeric(10, 4) not null,
  due_after timestamptz not null,
  reviewed_at timestamptz not null,
  revlog jsonb not null,
  idempotency_key text not null,
  fsrs_version text not null,
  unique (user_id, idempotency_key)
);

-- Revisões curriculares independentes do FSRS (2.10/5.10/15.7).
create table public.review_schedules (
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id),
  due_at timestamptz not null,
  interval_days numeric(6, 2) not null,
  ladder_index smallint not null default 0,
  last_evidence_at timestamptz,
  reason text,
  rule_version text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);
create index review_schedules_due_idx on public.review_schedules (user_id, due_at);

create table public.review_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id),
  learning_event_id uuid not null references public.learning_events(id) on delete cascade,
  satisfied_due_at timestamptz not null,
  retention_score numeric(5, 2),
  created_at timestamptz not null default now(),
  unique (learning_event_id, skill_id)
);
