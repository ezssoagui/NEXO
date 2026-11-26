-- NEXO — Eventos de aprendizagem, tentativas, evidências, domínio, recomendações,
-- sessões congeladas, listas, caderno de erros, CPE e classificação de erros.
-- Subtópicos: 2.4, 2.6–2.9, 2.14, 4.3–4.7, 5.3, 5.7, 5.8, 8.1–8.7, 15.5, 15.6, A.3
create table public.engine_parameter_sets (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  params jsonb not null,
  status text not null default 'experimental' check (status in ('experimental', 'active', 'retired')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index engine_parameter_sets_one_active on public.engine_parameter_sets ((status)) where status = 'active';

-- Evento original auditável e reprocessável; idempotente por (usuário, chave).
create table public.learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'question_answer', 'concept_response', 'flashcard_review', 'lesson_read', 'cpe_step',
    'error_classification', 'essay_evaluation', 'discursive_evaluation', 'rewrite_evaluation')),
  source text not null check (source in ('free', 'session', 'list', 'exam', 'diagnostic', 'review')),
  idempotency_key text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index learning_events_user_idx on public.learning_events (user_id, occurred_at desc);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid references public.questions(id),
  twin_question_id uuid,
  selected_alternative char(1) check (selected_alternative in ('A', 'B', 'C', 'D', 'E')),
  is_correct boolean,
  mode text not null check (mode in ('single', 'list', 'session', 'exam', 'diagnostic')),
  context_id uuid,
  time_spent_ms integer check (time_spent_ms >= 0),
  confidence smallint check (confidence between 1 and 3),
  eliminated jsonb not null default '[]'::jsonb,
  is_first_exposure boolean not null,
  learning_event_id uuid references public.learning_events(id),
  submitted_at timestamptz not null default now(),
  check ((question_id is not null) <> (twin_question_id is not null))
);
create index attempts_user_question_idx on public.attempts (user_id, question_id, submitted_at desc);
create index attempts_user_time_idx on public.attempts (user_id, submitted_at desc);
create index attempts_context_idx on public.attempts (context_id) where context_id is not null;

-- Evidência por habilidade e dimensão; nunca duplicada para o mesmo evento (2.14/8.1).
create table public.skill_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id),
  dimension text not null check (dimension in ('resolution', 'comprehension', 'transfer', 'retention')),
  score numeric(5, 2) not null check (score between 0 and 100),
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  independence text not null check (independence in ('independent', 'assisted', 'repeated')),
  item_key text not null,
  learning_event_id uuid not null references public.learning_events(id) on delete cascade,
  rule_version text not null,
  occurred_at timestamptz not null,
  unique (learning_event_id, skill_id, dimension)
);
create index skill_evidence_user_skill_idx on public.skill_evidence (user_id, skill_id, occurred_at);

create type public.mastery_state as enum ('not_assessed', 'learning', 'provisional', 'consolidated');

create table public.mastery_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id),
  r numeric(5, 2),
  c numeric(5, 2),
  t numeric(5, 2),
  m numeric(5, 2),
  d numeric(5, 2),
  state public.mastery_state not null default 'not_assessed',
  evidence_count integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  rule_version text not null,
  computed_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create table public.mastery_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id),
  d numeric(5, 2),
  state public.mastery_state not null,
  rule_version text not null,
  learning_event_id uuid references public.learning_events(id) on delete set null,
  computed_at timestamptz not null default now()
);
create index mastery_history_user_idx on public.mastery_history (user_id, computed_at);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subtopic_id uuid not null references public.subtopics(id),
  category text not null check (category in ('learn', 'improve', 'deepen', 'review')),
  focus text not null check (focus in ('exploration', 'fundamentals', 'comprehension', 'practice', 'transfer', 'retention', 'maintenance', 'recovery')),
  priority numeric(6, 4) not null,
  factors jsonb not null,
  reason text not null,
  status text not null default 'active' check (status in ('active', 'accepted', 'postponed', 'dismissed', 'completed', 'superseded')),
  postponed_until timestamptz,
  rule_version text not null,
  generated_at timestamptz not null default now()
);
create index recommendations_user_active_idx on public.recommendations (user_id, status, priority desc);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_id uuid references public.recommendations(id) on delete set null,
  subtopic_id uuid references public.subtopics(id),
  category text check (category in ('learn', 'improve', 'deepen', 'review')),
  focus text,
  origin text not null default 'recommendation' check (origin in ('recommendation', 'free_choice')),
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'paused', 'completed', 'abandoned')),
  plan jsonb not null,
  current_index integer not null default 0,
  rule_version text not null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz
);
create index study_sessions_user_idx on public.study_sessions (user_id, status, created_at desc);

create table public.session_activities (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  position smallint not null,
  activity_type text not null check (activity_type in ('lesson', 'question', 'concept_activity', 'flashcards', 'summary')),
  ref_type text not null,
  ref_id uuid,
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  result jsonb,
  completed_at timestamptz,
  unique (session_id, position)
);

-- Sessão iniciada é preservada (4.4/5.8/A.3.4): composição congelada.
create or replace function public.guard_session_plan() returns trigger language plpgsql as $$
begin
  if old.status <> 'planned' and new.plan is distinct from old.plan then
    raise exception 'Composição da sessão congelada após o início (5.8)';
  end if;
  if old.status in ('completed', 'abandoned') and new.status is distinct from old.status then
    raise exception 'Sessão encerrada não pode ser reaberta';
  end if;
  return new;
end $$;
create trigger study_sessions_guard before update on public.study_sessions for each row execute function public.guard_session_plan();

create or replace function public.guard_session_activities() returns trigger language plpgsql as $$
declare v_status text;
begin
  select status into v_status from public.study_sessions where id = coalesce(new.session_id, old.session_id);
  if v_status is distinct from 'planned' then
    if tg_op in ('INSERT', 'DELETE') then
      raise exception 'Composição da sessão congelada após o início (5.8)';
    end if;
    if new.activity_type <> old.activity_type or new.ref_id is distinct from old.ref_id or new.position <> old.position then
      raise exception 'Composição da sessão congelada após o início (5.8)';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger session_activities_guard before insert or update or delete on public.session_activities
  for each row execute function public.guard_session_activities();

-- Listas: adaptativa (motor) e manual (aluno). Correção ao final (5.3).
create table public.question_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('adaptive', 'manual')),
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'in_progress' check (status in ('in_progress', 'finished')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.question_list_items (
  list_id uuid not null references public.question_lists(id) on delete cascade,
  position smallint not null,
  question_id uuid not null references public.questions(id),
  selected_alternative char(1) check (selected_alternative in ('A', 'B', 'C', 'D', 'E')),
  eliminated jsonb not null default '[]'::jsonb,
  attempt_id uuid references public.attempts(id),
  primary key (list_id, position),
  unique (list_id, question_id)
);

-- Caderno de erros automático (5.7). Sem anotações pessoais (5.12).
create table public.error_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  skill_id uuid references public.skills(id),
  subtopic_id uuid references public.subtopics(id),
  difficulty text,
  first_attempt_id uuid not null references public.attempts(id),
  last_attempt_id uuid not null references public.attempts(id),
  attempts_count integer not null default 1,
  error_type text,
  cpe_status text not null default 'not_applicable' check (cpe_status in ('not_applicable', 'pending', 'partial', 'completed')),
  recovery_status text not null default 'open' check (recovery_status in ('open', 'recovering', 'overcome')),
  overcome_event_id uuid references public.learning_events(id) on delete set null,
  overcome_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_id)
);
create trigger error_entries_touch before update on public.error_entries for each row execute function public.touch_updated_at();

-- Classificação opcional de erros em Matemática/Natureza (2.7).
create table public.error_classifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  cause text not null check (cause in ('knowledge_gap', 'conceptual', 'interpretive', 'application', 'procedural', 'attention', 'unknown')),
  created_at timestamptz not null default now(),
  unique (attempt_id)
);

-- CPE: Comando, Prova, Eliminação (2.6) — somente casos elegíveis, validados no serviço.
create table public.cpe_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  step text not null check (step in ('comando', 'prova', 'eliminacao')),
  response jsonb not null,
  correct boolean,
  created_at timestamptz not null default now(),
  unique (attempt_id, step)
);
