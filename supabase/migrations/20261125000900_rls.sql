-- NEXO — Row Level Security e privilégios mínimos.
-- Princípios (13.3/13.8/15.3):
--  * Toda tabela pública tem RLS habilitada.
--  * anon não acessa nada além de documentos legais publicados.
--  * authenticated LÊ apenas os próprios registros pedagógicos/comerciais.
--  * Escritas que afetam integridade (evidências, domínio, XP, franquias, pagamentos)
--    são feitas somente pelo backend (contexto de serviço), nunca pelo cliente.
--  * Conteúdo (questões, gabaritos, aulas) NÃO é exposto diretamente ao cliente:
--    é servido pela API, que aplica franquias, limites de extração e correção pós-envio.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
    execute format('revoke all on public.%I from anon, authenticated', r.tablename);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;

-- Funções privilegiadas só para o backend.
revoke execute on function public.reserve_quota(uuid, text, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.finalize_quota(uuid, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Documentos legais publicados: leitura pública.
-- ---------------------------------------------------------------------------
grant select on public.legal_documents to anon, authenticated;
create policy legal_documents_read on public.legal_documents for select to anon, authenticated using (status = 'published');

-- ---------------------------------------------------------------------------
-- Perfil e preferências: o próprio usuário lê e edita campos não sensíveis.
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (display_name, foreign_language, course_goal, university_goal, current_institution, ranking_display_name)
  on public.profiles to authenticated;
create policy profiles_own_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_own_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

grant select, insert, update on public.preferences to authenticated;
create policy preferences_own on public.preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.user_roles to authenticated;
create policy user_roles_own on public.user_roles for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Leitura própria (somente SELECT) para dados do estudante.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'legal_acceptances', 'consents', 'data_requests', 'learning_events', 'attempts', 'skill_evidence',
    'mastery_scores', 'mastery_history', 'recommendations', 'study_sessions', 'question_lists',
    'error_entries', 'error_classifications', 'cpe_responses', 'lesson_reads', 'concept_responses',
    'study_materials', 'card_states', 'review_logs', 'review_schedules', 'review_evidence', 'essays',
    'essay_drafts', 'discursive_responses', 'user_repertoires', 'exam_attempts', 'xp_events',
    'study_days', 'user_achievements', 'subscriptions', 'payments', 'access_grants', 'quota_usage', 'feedback'
  ] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', t || '_own_select', t);
  end loop;
end $$;

-- Tabelas filhas: propriedade via tabela-mãe.
grant select on public.session_activities to authenticated;
create policy session_activities_own on public.session_activities for select to authenticated
  using (exists (select 1 from public.study_sessions s where s.id = session_id and s.user_id = auth.uid()));

grant select on public.question_list_items to authenticated;
create policy question_list_items_own on public.question_list_items for select to authenticated
  using (exists (select 1 from public.question_lists l where l.id = list_id and l.user_id = auth.uid()));

grant select on public.essay_versions to authenticated;
create policy essay_versions_own on public.essay_versions for select to authenticated
  using (exists (select 1 from public.essays e where e.id = essay_id and e.user_id = auth.uid()));

grant select on public.essay_evaluations to authenticated;
create policy essay_evaluations_own on public.essay_evaluations for select to authenticated
  using (exists (select 1 from public.essay_versions v join public.essays e on e.id = v.essay_id
                 where v.id = essay_version_id and e.user_id = auth.uid()));

grant select on public.exam_answers to authenticated;
create policy exam_answers_own on public.exam_answers for select to authenticated
  using (exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.user_id = auth.uid()));

-- Flashcards e baralhos pessoais do próprio usuário.
grant select on public.decks to authenticated;
create policy decks_own on public.decks for select to authenticated using (owner_id = auth.uid());
grant select on public.flashcards to authenticated;
create policy flashcards_own on public.flashcards for select to authenticated using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Escritas diretas permitidas ao próprio usuário (sem impacto de integridade).
-- ---------------------------------------------------------------------------
grant update (body, updated_at) on public.essay_drafts to authenticated;
create policy essay_drafts_own_update on public.essay_drafts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant insert, delete on public.user_repertoires to authenticated;
create policy user_repertoires_own_insert on public.user_repertoires for insert to authenticated with check (user_id = auth.uid());
create policy user_repertoires_own_delete on public.user_repertoires for delete to authenticated using (user_id = auth.uid());

-- Estrutura curricular validada é informação não sensível.
grant select on public.areas, public.subjects, public.topics, public.subtopics, public.skills to authenticated;
create policy areas_read on public.areas for select to authenticated using (true);
create policy subjects_read on public.subjects for select to authenticated using (true);
create policy topics_read on public.topics for select to authenticated using (verification_status <> 'retired');
create policy subtopics_read on public.subtopics for select to authenticated using (verification_status <> 'retired');
create policy skills_read on public.skills for select to authenticated using (verification_status <> 'retired');
