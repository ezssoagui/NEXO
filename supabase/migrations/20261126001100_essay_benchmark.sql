-- Benchmark do corretor de redação contra avaliações humanas (6.3; ADR-019).
-- Guarda apenas métricas agregadas e o hash do conjunto: NENHUM texto de redação ou dado de autor.
-- Aprovação por administrador é pré-requisito para expor correções reais em produção.
--
-- Substitui o esboço criado em 20261125000600 (nunca usado pelo código). Recusa-se a prosseguir se houver
-- dados, para não descartar execuções registradas por engano.
do $$
begin
  if exists (select 1 from public.essay_benchmark_runs) then
    raise exception 'essay_benchmark_runs contém registros; migre-os manualmente antes de aplicar 20261126001100';
  end if;
end $$;
drop table public.essay_benchmark_runs;

create table public.essay_benchmark_runs (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 120),
  dataset_sha256 text not null check (dataset_sha256 ~ '^[0-9a-f]{64}$'),
  dataset_sources text[] not null default '{}',
  model_id text,
  prompt_version_id uuid references public.prompt_versions(id),
  is_test_double boolean not null default false,
  samples integer not null check (samples >= 0),
  metrics jsonb not null,
  acceptance jsonb not null,
  thresholds jsonb not null,
  status text not null check (status in ('passed', 'failed')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (approved_at is null or (status = 'passed' and not is_test_double))
);
create index essay_benchmark_runs_model_prompt on public.essay_benchmark_runs (model_id, prompt_version_id, created_at desc);

alter table public.essay_benchmark_runs enable row level security;
revoke all on public.essay_benchmark_runs from anon, authenticated;
-- Sem políticas: acesso apenas pelo serviço, após autorização administrativa na aplicação (MFA aal2).
