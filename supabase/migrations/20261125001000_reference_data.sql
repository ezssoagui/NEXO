-- NEXO — Dados de referência aprovados no Documento Mestre (não são conteúdo pedagógico).
-- Áreas (3.1), planos e franquias (11.4/11.5/6.10/7.9), XP (9.2), conquistas (9.4),
-- parâmetros experimentais do motor (8.2–8.5/4.5/15.5) e configurações propostas.
insert into public.areas (code, name, exam_day, sort) values
  ('LC', 'Linguagens, Códigos e suas Tecnologias', 1, 1),
  ('CH', 'Ciências Humanas e suas Tecnologias', 1, 2),
  ('CN', 'Ciências da Natureza e suas Tecnologias', 2, 3),
  ('MT', 'Matemática e suas Tecnologias', 2, 4);

-- Preços nulos: não definidos (11.10). Nenhum valor comercial presumido.
insert into public.plans (code, name, rank, price_status) values
  ('free', 'Gratuito', 0, 'approved'),
  ('plus', 'Plus', 1, 'not_defined'),
  ('pro', 'Pro', 2, 'not_defined');

-- Tabela 11.5 (limit_value nulo = ilimitado para uso legítimo).
insert into public.plan_limits (plan_code, resource, period, limit_value, version) values
  ('free', 'questions', 'day', 20, 'mestre-1.0'),
  ('free', 'adaptive_sessions', 'day', 2, 'mestre-1.0'),
  ('free', 'flashcards', 'day', 20, 'mestre-1.0'),
  ('free', 'explanations', 'day', 1, 'mestre-1.0'),
  ('free', 'essays', 'month', 1, 'mestre-1.0'),
  ('free', 'rewrites', 'month', 3, 'mestre-1.0'),
  ('free', 'discursive', 'month', 5, 'mestre-1.0'),
  ('free', 'exams', 'month', 1, 'mestre-1.0'),
  ('plus', 'questions', 'day', null, 'mestre-1.0'),
  ('plus', 'adaptive_sessions', 'day', null, 'mestre-1.0'),
  ('plus', 'flashcards', 'day', null, 'mestre-1.0'),
  ('plus', 'explanations', 'day', 5, 'mestre-1.0'),
  ('plus', 'essays', 'month', 6, 'mestre-1.0'),
  ('plus', 'rewrites', 'month', 20, 'mestre-1.0'),
  ('plus', 'discursive', 'month', 30, 'mestre-1.0'),
  ('plus', 'exams', 'month', null, 'mestre-1.0'),
  ('pro', 'questions', 'day', null, 'mestre-1.0'),
  ('pro', 'adaptive_sessions', 'day', null, 'mestre-1.0'),
  ('pro', 'flashcards', 'day', null, 'mestre-1.0'),
  ('pro', 'explanations', 'day', 15, 'mestre-1.0'),
  ('pro', 'essays', 'month', 12, 'mestre-1.0'),
  ('pro', 'rewrites', 'month', 60, 'mestre-1.0'),
  ('pro', 'discursive', 'month', 90, 'mestre-1.0'),
  ('pro', 'exams', 'month', null, 'mestre-1.0');

-- XP inicial (9.2). Sem bônus de desempenho.
insert into public.xp_rules (activity_type, xp, version) values
  ('question', 5, 'mestre-1.0'), ('flashcard', 2, 'mestre-1.0'), ('microlesson', 10, 'mestre-1.0'),
  ('lesson', 20, 'mestre-1.0'), ('concept_explanation', 10, 'mestre-1.0'), ('discursive_exercise', 10, 'mestre-1.0'),
  ('rewrite', 10, 'mestre-1.0'), ('essay', 30, 'mestre-1.0');

-- Conquistas simples por participação e aprendizado (9.4), sem XP extra.
insert into public.achievements (code, title, description, criteria) values
  ('first_question', 'Primeiro passo', 'Respondeu a primeira questão.', '{"metric":"questions_answered","gte":1}'),
  ('questions_100', 'Cem questões', 'Respondeu 100 questões.', '{"metric":"questions_answered","gte":100}'),
  ('questions_1000', 'Mil questões', 'Respondeu 1.000 questões.', '{"metric":"questions_answered","gte":1000}'),
  ('first_essay', 'Primeira redação', 'Enviou a primeira redação completa.', '{"metric":"essays_evaluated","gte":1}'),
  ('first_exam', 'Primeiro simulado', 'Concluiu o primeiro simulado.', '{"metric":"exams_finished","gte":1}'),
  ('streak_7', 'Uma semana', 'Estudou 7 dias seguidos.', '{"metric":"streak","gte":7}'),
  ('streak_30', 'Um mês', 'Estudou 30 dias seguidos.', '{"metric":"streak","gte":30}'),
  ('first_consolidated', 'Primeira consolidação', 'Consolidou a primeira habilidade.', '{"metric":"skills_consolidated","gte":1}'),
  ('consolidated_25', 'Base sólida', 'Consolidou 25 habilidades.', '{"metric":"skills_consolidated","gte":25}'),
  ('flashcards_200', 'Memória ativa', 'Revisou 200 flashcards.', '{"metric":"flashcards_reviewed","gte":200}');

-- Parâmetros experimentais do motor (versão inicial). NÃO são regras científicas validadas.
insert into public.engine_parameter_sets (version, status, notes, params) values ('engine-0.1.0', 'active',
  'Parâmetros do Documento Mestre (8.2–8.5, 4.5, 15.5) + propostas técnicas reversíveis (ADR-007..ADR-012). Calibrar no piloto.',
  '{
    "mastery": {
      "weights": {"resolution": 0.50, "comprehension": 0.25, "transfer": 0.15, "retention": 0.10},
      "difficultyWeights": {"easy": 0.50, "medium": 0.35, "hard": 0.15},
      "thresholds": {"provisional": 70, "consolidated": 85},
      "minEvidence": {
        "low": {"easy": 3, "medium": 1, "hard": 1},
        "medium": {"easy": 5, "medium": 3, "hard": 2},
        "high": {"easy": 8, "medium": 4, "hard": 3},
        "unknown": {"easy": 5, "medium": 3, "hard": 2}
      },
      "temporalWeights": [{"maxDays": 15, "weight": 1.0}, {"maxDays": 30, "weight": 0.75}, {"maxDays": 60, "weight": 0.5}, {"maxDays": null, "weight": 0.25}],
      "independenceFactors": {"independent": 1.0, "assisted": 0.5, "repeated": 0.25},
      "retentionMinIntervalDays": 7,
      "consolidationRequires": {"retention": true, "comprehensionOrTransfer": true}
    },
    "priority": {
      "weights": {"difficulty": 0.30, "relevance": 0.25, "review": 0.20, "coverage": 0.15, "connections": 0.10},
      "relevanceScore": {"high": 1.0, "medium": 0.6, "low": 0.3, "unknown": 0.5},
      "unknownDifficultyPrior": 0.5,
      "proximity": [{"maxDays": 7, "reviewMultiplier": 1.75}, {"maxDays": 30, "reviewMultiplier": 1.5}, {"maxDays": 90, "reviewMultiplier": 1.25}],
      "recoveryPattern": {"window": 10, "minErrors": 5}
    },
    "sessionQuantity": {
      "very_high": {"low": 5, "medium": 10, "high": 15},
      "high": {"low": 4, "medium": 7, "high": 12},
      "moderate": {"low": 3, "medium": 5, "high": 10},
      "punctual": {"low": 2, "medium": 4, "high": 6},
      "maintenance": {"low": 1, "medium": 2, "high": 3},
      "maxQuestionsPerSession": 15
    },
    "reviews": {"ladderDays": [1, 3, 7, 14, 30, 60, 120], "successThreshold": 70, "relevanceFactor": {"high": 0.8, "medium": 1.0, "low": 1.2, "unknown": 1.0}}
  }'::jsonb);

-- Configurações PROPOSTAS (status 'proposal'): pendentes de aprovação dos sócios (A.2).
insert into public.app_settings (key, value, status, description) values
  ('timezone', '"America/Sao_Paulo"', 'proposal', 'Fuso para virada de dia/mês das franquias e streak (15.9).'),
  ('quota_counting', '{"questions":"distinct_question_served_per_day_outside_sessions_and_exams","adaptive_sessions":"on_session_start","exams":"on_exam_start_official_or_custom","diagnostic":"not_counted","session_questions":"not_counted_in_questions"}', 'proposal', 'Regras de contagem de franquias em listas/simulados/diagnóstico/sessões (A.2).'),
  ('free_lessons_policy', '{"mode":"flagged_lessons","note":"Somente aulas com is_free=true; microaulas e resumos sempre liberados no Gratuito (proposta)."}', 'proposal', 'Subconjunto de aulas do Gratuito (11.4/A.2).'),
  ('grace_period_days', '3', 'approved', 'Tolerância após pagamento recusado (13.7).'),
  ('withdrawal_days', '7', 'approved', 'Direito de arrependimento CDC art. 49 (13.7).'),
  ('enem_exam_dates', '{}', 'proposal', 'Datas oficiais do ENEM por ano (cadastrar via admin a partir do edital).'),
  ('ai_budget_alerts', '{"preventive":0.7,"priority":0.9,"limit":1.0}', 'approved', 'Alertas de orçamento de IA (12.7).');
