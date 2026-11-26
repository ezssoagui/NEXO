-- pgTAP: isolamento por RLS e privilégios mínimos (13.3/15.3/15.12).
-- Execução: Supabase CLI (`supabase test db`) ou localmente via tests/db/pgtap.test.ts (PGlite).
begin;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@teste.local'),
  ('22222222-2222-2222-2222-222222222222', 'b@teste.local');
insert into public.profiles (id, display_name, enem_target_year, birth_date) values
  ('11111111-1111-1111-1111-111111111111', 'A', 2027, '2000-01-01'),
  ('22222222-2222-2222-2222-222222222222', 'B', 2027, '2000-01-01');
insert into public.study_days (user_id, day) values ('22222222-2222-2222-2222-222222222222', current_date);
insert into public.user_roles (user_id, role) values ('22222222-2222-2222-2222-222222222222', 'admin');

select ok((select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'),
  'todas as tabelas públicas têm RLS habilitada');

-- Estudante A autenticado
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

select is_empty($$ select * from public.study_days $$, 'A não enxerga dias de estudo de B');
select results_eq($$ select id::text from public.profiles $$, $$ values ('11111111-1111-1111-1111-111111111111') $$, 'A só enxerga o próprio perfil');
select throws_ok($$ select correct_alternative from public.questions limit 1 $$, '42501', null, 'gabaritos não são acessíveis diretamente pelo cliente');
select throws_ok($$ insert into public.xp_events (user_id, activity_type, xp, source_key) values ('11111111-1111-1111-1111-111111111111', 'essay', 999, 'x') $$, '42501', null, 'cliente não concede XP a si mesmo');
select throws_ok($$ insert into public.user_roles (user_id, role) values ('11111111-1111-1111-1111-111111111111', 'admin') $$, '42501', null, 'cliente não se promove a administrador');
select throws_ok($$ update public.profiles set suspended_at = null $$, '42501', null, 'cliente não altera campos administrativos do perfil');
select throws_ok($$ select public.reserve_quota('11111111-1111-1111-1111-111111111111', 'essays', 'M:2026-01', 'r', 100) $$, '42501', null, 'cliente não manipula franquias');
select ok(not public.is_admin(), 'A não é administrador');

-- B tem papel admin, mas sem MFA (aal1) não é tratado como administrador.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1"}', true);
select ok(not public.is_admin(), 'admin sem MFA (aal1) não tem privilégio administrativo');
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal2"}', true);
select ok(public.is_admin(), 'admin com MFA (aal2) reconhecido');

reset role;
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anônimo não acessa perfis');
reset role;

select * from finish();
rollback;
