# Banco de dados
> Desdobramento técnico do Documento Mestre v1.0 (fonte de verdade). Em caso de conflito, prevalece o mestre. Referências no formato etapa.subtópico.

Migrações em `supabase/migrations` (aplicar com `supabase db push` ou `npm run db:migrate`). Todas as tabelas públicas com RLS (teste automatizado).

| Migração | Conteúdo |
|---|---|
| 000100_foundation | profiles, user_roles, preferences, legal_documents/acceptances, consents, guardian_consents, data_requests, account_deletions, audit_logs, rate_limits, app_settings |
| 000200_curriculum | content_sources, curriculum_versions, areas, subjects, topics, subtopics, skills, official_competencies/skills, links, connections, change_log |
| 000300_questions | exam_editions, exam_booklets, import_runs/items, questions (restrições de publicação), positions, assets, alternatives, tags, solutions (cpe_reference), revisions, content_reviews |
| 000400_learning | engine_parameter_sets, learning_events, attempts, skill_evidence, mastery_scores/history, recommendations, study_sessions (trigger de congelamento), session_activities, question_lists, error_entries, error_classifications, cpe_responses |
| 000500_materials… | lessons, lesson_blocks, lesson_reads, concept_activities/responses, study_materials, decks, flashcards, card_states (estado FSRS completo), review_logs, review_schedules, review_evidence |
| 000600_essays_ai | ai_models, prompt_versions, ai_usage, ai_budgets, essay_themes, motivator_texts, repertoires, user_repertoires, essay_theory/exercises, essays, drafts, versions, evaluations (0–200/40, total coerente), discursive_responses, rag_documents (rag/benchmark), rag_chunks (vector 1536) |
| 20261126001100_essay_benchmark | essay_benchmark_runs refeita (métricas agregadas + hash do conjunto, sem textos; aprovação só para execução real que atingiu critérios — ADR-019) |
| 000700_twins_exams_gamification | twin_questions/validations/requests, exams, exam_items, exam_attempts, exam_answers, xp_rules, xp_events, study_days, achievements |
| 000800_commercial_admin | plans (preços nulos), plan_limits, subscriptions, payments, coupons, access_grants, webhook_events, quota_usage + reserve/finalize_quota, feedback, manual_expenses, marketing_metrics, alerts, backup_runs |
| 000900_rls | políticas e privilégios mínimos |
| 001000_reference_data | áreas, planos, franquias, XP, conquistas, parâmetros engine-0.1.0, configurações propostas |
