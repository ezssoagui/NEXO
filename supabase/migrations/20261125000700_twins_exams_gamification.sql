-- NEXO — Questões gêmeas (acervo separado), simulados/diagnóstico e gamificação.
-- Subtópicos: 2.2, 2.12, 4.11, 5.5, 5.9, 7.6, 8.8, 9.1–9.9
create table public.twin_questions (
  id uuid primary key default gen_random_uuid(),
  origin_question_id uuid not null references public.questions(id),
  skill_id uuid not null references public.skills(id),
  statement_md text not null,
  alternatives jsonb not null,
  correct_alternative char(1) not null check (correct_alternative in ('A', 'B', 'C', 'D', 'E')),
  solution_md text not null,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  status text not null default 'generated' check (status in ('generated', 'approved', 'rejected')),
  generation_model text not null,
  prompt_version_id uuid references public.prompt_versions(id),
  ai_usage_id uuid references public.ai_usage(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index twin_questions_skill_idx on public.twin_questions (skill_id) where status = 'approved';
alter table public.attempts add constraint attempts_twin_fk foreign key (twin_question_id) references public.twin_questions(id);

create table public.twin_validations (
  id uuid primary key default gen_random_uuid(),
  twin_id uuid not null references public.twin_questions(id) on delete cascade,
  validator_model text not null,
  prompt_version_id uuid references public.prompt_versions(id),
  structural_checks jsonb not null,
  result jsonb,
  verdict text not null check (verdict in ('approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- Solicitações de gêmea quando não há equivalente oficial nem gêmea validada (2.12).
create table public.twin_requests (
  id uuid primary key default gen_random_uuid(),
  origin_question_id uuid not null references public.questions(id),
  skill_id uuid not null references public.skills(id),
  status text not null default 'pending' check (status in ('pending', 'processing', 'fulfilled', 'failed', 'skipped')),
  reason text,
  twin_id uuid references public.twin_questions(id),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (origin_question_id, skill_id, status)
);

-- Simulados e diagnóstico (4.11/5.9/2.2) — somente questões oficiais.
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('official', 'custom', 'diagnostic')),
  title text not null,
  edition_id uuid references public.exam_editions(id),
  day smallint check (day in (1, 2)),
  duration_minutes integer check (duration_minutes between 1 and 600),
  includes_essay boolean not null default false,
  language text check (language in ('en', 'es')),
  composition_rule jsonb not null default '{}'::jsonb,
  owner_id uuid references auth.users(id) on delete cascade,
  status public.publication_status not null default 'published',
  created_at timestamptz not null default now()
);

create table public.exam_items (
  exam_id uuid not null references public.exams(id) on delete cascade,
  position smallint not null check (position between 1 and 180),
  question_id uuid not null references public.questions(id),
  primary key (exam_id, position),
  unique (exam_id, question_id)
);

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid not null references public.exams(id),
  status text not null default 'in_progress' check (status in ('in_progress', 'paused', 'finished', 'abandoned')),
  timer_mode text not null default 'official' check (timer_mode in ('official', 'none')),
  started_at timestamptz not null default now(),
  last_resumed_at timestamptz not null default now(),
  elapsed_seconds integer not null default 0,
  finished_at timestamptz,
  essay_id uuid references public.essays(id),
  result jsonb,
  created_at timestamptz not null default now()
);
create index exam_attempts_user_idx on public.exam_attempts (user_id, created_at desc);

create table public.exam_answers (
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  position smallint not null,
  question_id uuid not null references public.questions(id),
  selected_alternative char(1) check (selected_alternative in ('A', 'B', 'C', 'D', 'E')),
  confidence smallint check (confidence between 1 and 3),
  marked_for_review boolean not null default false,
  eliminated jsonb not null default '[]'::jsonb,
  answered_at timestamptz,
  primary key (attempt_id, position)
);

-- Gamificação (9) — independente da pedagogia.
create table public.xp_rules (
  activity_type text primary key check (activity_type in (
    'question', 'flashcard', 'microlesson', 'lesson', 'concept_explanation', 'discursive_exercise', 'rewrite', 'essay')),
  xp integer not null check (xp >= 0),
  version text not null
);

create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null references public.xp_rules(activity_type),
  xp integer not null check (xp >= 0),
  source_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_key)
);
create index xp_events_user_time_idx on public.xp_events (user_id, created_at);
create index xp_events_time_idx on public.xp_events (created_at);

create table public.study_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

create table public.achievements (
  code text primary key,
  title text not null,
  description text not null,
  criteria jsonb not null
);

create table public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_code text not null references public.achievements(code),
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_code)
);
