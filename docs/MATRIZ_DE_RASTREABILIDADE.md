# Matriz de rastreabilidade — Documento Mestre v1.0

Gerada por `scripts/docs/build_matrix.py`. 166 subtópicos lidos do mestre. Resumo: DOCUMENTAL: 15 · FUTURO: 1 · IMPLEMENTADO: 35 · PARCIAL: 21 · PENDENTE: 10 · REJEITADO: 2 · TESTADO: 82.

Status: **TESTADO** (código + teste automatizado), **IMPLEMENTADO** (sem teste dedicado), **PARCIAL**, **PENDENTE** (dependência externa/decisão), **FUTURO**, **REJEITADO** (não implementar), **DOCUMENTAL**. Tela pronta não é prova de backend pronto; integração simulada não é integração real.

| Subtópico | Título | Módulo / artefato | Evidência de teste | Status | Pendências |
|---|---|---|---|---|---|
| 1.1 | Finalidade do produto | Produto inteiro | — | DOCUMENTAL |  |
| 1.2 | Escopo de atuação | Escopo exclusivo ENEM em todo o código | — | DOCUMENTAL |  |
| 1.3 | Objetivos e horizontes | ESTADO_DO_PROJETO.md | — | DOCUMENTAL | Piloto e validação pendentes |
| 1.4 | Diferencial central | modules/adaptive-engine | tests/unit/adaptive-engine.test.ts | TESTADO |  |
| 1.5 | Filosofia pedagógica | composition.ts (intensidade por relevância/dificuldade) | tests/unit/adaptive-engine.test.ts | TESTADO |  |
| 1.6 | Concepção de progresso | mastery/compute.ts curricularIndicators | tests/unit/mastery.test.ts | TESTADO |  |
| 1.7 | Autonomia do estudante | sessões livres, sem bloqueios | tests/e2e/flows.spec.ts | TESTADO |  |
| 1.8 | Redação como parte do método | services/essays.ts | tests/db/services.test.ts | TESTADO | IA real pendente |
| 1.9 | Posicionamento e princípios do produto | Sem promessas na interface; IA só onde definida | — | DOCUMENTAL |  |
| 2.1 | Diagnóstico progressivo | priority.ts (exploração sem histórico) | tests/unit/adaptive-engine.test.ts; tests/db/services.test.ts | TESTADO |  |
| 2.2 | Diagnóstico completo opcional | exams.createDiagnostic (180, sem cronômetro, retomável) | tests/db/services.test.ts | TESTADO | Redação diagnóstica = redação livre; vínculo dedicado a refinar |
| 2.3 | Aprendizagem híbrida e adaptativa | composition.ts planSession | tests/unit/adaptive-engine.test.ts | TESTADO |  |
| 2.4 | Prática e correção | questions/rules revealPolicy; listas e simulados | tests/unit/modules.test.ts; tests/db/services.test.ts; tests/e2e/flows.spec.ts | TESTADO |  |
| 2.5 | Explicação ativa | content.submitConceptResponse; prompt concept_eval | tests/db/services.test.ts | TESTADO | Modelo real a aprovar |
| 2.6 | Método CPE em Linguagens e Humanas | rules.cpeEligible; questions CPE | tests/unit/modules.test.ts; tests/db/services.test.ts | TESTADO | Referências CPE das questões a produzir |
| 2.7 | Classificação de erros em Matemática e Naturezas | questions.classifyError | tests/unit/modules.test.ts; tests/db/services.test.ts | TESTADO |  |
| 2.8 | Intervenções e recomendações | priority.ts foco recovery (5/10) | tests/unit/adaptive-engine.test.ts; tests/db/services.test.ts | TESTADO |  |
| 2.9 | Domínio e evidências | mastery/compute.ts | tests/unit/mastery.test.ts | TESTADO | Calibração no piloto |
| 2.10 | Revisões espaçadas e ativas | reviews/schedule.ts + flashcards/fsrs.ts | tests/unit/modules.test.ts | TESTADO |  |
| 2.11 | Revisões estratégicas e final | finalStretchBoost; materiais final_review | — | IMPLEMENTADO | Datas oficiais do ENEM a cadastrar |
| 2.12 | Seleção de questões equivalentes | twins.findEquivalent | tests/unit/modules.test.ts | PARCIAL | Teste de integração da fila de gêmeas a adicionar |
| 2.13 | Uso pedagógico da IA | services/ai.ts (escopo restrito) | tests/db/services.test.ts | TESTADO |  |
| 2.14 | Integração de evidências | learning.processQuestionAnswer | tests/db/services.test.ts | TESTADO |  |
| 2.15 | Fundamentação e calibração | engine_parameter_sets versionado | tests/unit/mastery.test.ts | IMPLEMENTADO | Fontes privadas não processadas (autorização) |
| 3.1 | Hierarquia curricular | migração curriculum + curriculum-loader | tests/db/services.test.ts | TESTADO |  |
| 3.2 | Granularidade e escopo | supabase/seed/curriculum_matriz_v0.json | — | PENDENTE | Validação pedagógica dos sócios |
| 3.3 | Competências e habilidades oficiais | official_competencies/official_skills (120 H) | tests/db/services.test.ts | TESTADO | Vínculos habilidade interna↔oficial a validar |
| 3.4 | Relevância curricular | supabase/seed/relevance_v1.json; relevance-loader.ts; scripts/curriculum/build_relevance_v1.py | tests/db/relevance.test.ts; scripts/curriculum/test_relevance_v1.py | TESTADO | Proposta ADR-018: validar regra, limiares e 68 divergências com os sócios |
| 3.5 | Dificuldade individual | priority.ts fator dificuldade | tests/unit/adaptive-engine.test.ts | TESTADO |  |
| 3.6 | Conexões e pré-requisitos | skill_connections + fator conexões | — | IMPLEMENTADO | Conexões a cadastrar |
| 3.7 | Dificuldade das questões | rules.terciles / pipeline.difficulty | tests/unit/modules.test.ts; scripts/import-enem/test_pipeline.py | TESTADO | Limiares por tercil: proposta ADR-009 |
| 3.8 | Banco de questões oficiais | migração questions + scripts/import-enem | scripts/import-enem/test_pipeline.py | PARCIAL | Download e importação integral do acervo pendentes |
| 3.9 | Classificação e metadados | question_tags, classification_status, admin review | tests/db/services.test.ts | PARCIAL | Lote de classificação assistida a executar |
| 3.10 | Construção da taxonomia | scripts/curriculum/build_matriz_v0.py; relevance_v1_data.py (mapeamento Checklist/dossiê) | scripts/curriculum/test_relevance_v1.py | PARCIAL | Subtópicos/habilidades internas a refinar e validar |
| 3.11 | Manutenção e versionamento | curriculum_versions, change_log, trigger anti-exclusão | — | IMPLEMENTADO |  |
| 4.1 | Cadastro e onboarding | onboarding (dados mínimos, idade) | tests/e2e/flows.spec.ts | TESTADO |  |
| 4.2 | Primeiro acesso | recomendações iniciais de exploração | tests/db/services.test.ts; tests/e2e/flows.spec.ts | TESTADO |  |
| 4.3 | Recomendações integradas | recommendations.ts + /inicio filtros | tests/db/services.test.ts; tests/e2e/flows.spec.ts | TESTADO |  |
| 4.4 | Sessões adaptativas | sessions.ts (snapshot, pausa) | tests/db/services.test.ts; tests/e2e/flows.spec.ts | TESTADO |  |
| 4.5 | Quantidade de questões | composition.questionQuantity | tests/unit/adaptive-engine.test.ts | TESTADO |  |
| 4.6 | Autonomia e estudo livre | sessão livre por conteúdo; currículo navegável | tests/e2e/flows.spec.ts | TESTADO |  |
| 4.7 | Inatividade e retorno | peso temporal relativo à última evidência | tests/unit/mastery.test.ts | TESTADO |  |
| 4.8 | Desempenho detalhado | /desempenho + account.performanceOverview | tests/db/services.test.ts | TESTADO |  |
| 4.9 | Dashboard do estudante | /inicio | tests/e2e/flows.spec.ts | TESTADO |  |
| 4.10 | Reta final do ENEM | proximityMultiplier, finalStretchBoost | tests/unit/adaptive-engine.test.ts | IMPLEMENTADO | Datas e janelas a calibrar |
| 4.11 | Simulados opcionais e preparação real | exams.ts + /simulados | tests/db/services.test.ts; tests/e2e/flows.spec.ts | TESTADO | Provas oficiais dependem do acervo |
| 5.1 | Aulas, microaulas e materiais | lessons/lesson_blocks + LessonReader | tests/db/services.test.ts | PARCIAL | Produção do acervo escrito validado |
| 5.2 | Banco de questões | questions.searchBank | tests/e2e/flows.spec.ts | TESTADO | Acervo oficial a importar |
| 5.3 | Listas de questões | questions.createList adaptativa/manual | tests/db/services.test.ts | TESTADO |  |
| 5.4 | Explicações ativas | submitConceptResponse | tests/db/services.test.ts | TESTADO |  |
| 5.5 | Questões gêmeas | services/twins.ts | tests/unit/modules.test.ts | IMPLEMENTADO | Geração real depende de IA aprovada |
| 5.6 | Flashcards | content.reviewFlashcard (FSRS) | tests/db/services.test.ts; tests/e2e/flows.spec.ts | TESTADO | Baralhos curriculares a produzir |
| 5.7 | Caderno de erros | learning.updateErrorNotebook | tests/db/services.test.ts | TESTADO |  |
| 5.8 | Estabilidade das sessões | trigger guard_session_activities | tests/db/services.test.ts | TESTADO |  |
| 5.9 | Simulados | exams.ts | tests/db/services.test.ts; tests/e2e/flows.spec.ts | TESTADO |  |
| 5.10 | Revisões integradas | review_evidence (estudo livre satisfaz revisão) | tests/unit/modules.test.ts | TESTADO |  |
| 5.11 | Resumos personalizados | content.assembleMaterial | — | IMPLEMENTADO |  |
| 5.12 | Anotações pessoais | — | Verificado: sem editor de notas | REJEITADO | Não implementar |
| 5.13 | Favoritos | — | Verificado: sem favoritos; repertórios e marcação de simulado são exceções | REJEITADO | Não implementar |
| 5.14 | Busca global | content.globalSearch + modal Ctrl+K | — | IMPLEMENTADO |  |
| 5.15 | Integração das ferramentas | perfil único de evidências | tests/db/services.test.ts | TESTADO |  |
| 6.1 | Correção completa | essays.submitEssay + validação 0–200/40 | tests/unit/modules.test.ts; tests/db/services.test.ts; tests/e2e/flows.spec.ts | TESTADO | Modelo superior a aprovar |
| 6.2 | Correção fundamentada e personalizada | citações verificadas; essayFollowUp | tests/unit/modules.test.ts; tests/db/services.test.ts | TESTADO |  |
| 6.3 | Acervo de referência e validação | rag_documents (rag); modules/essays/benchmark.ts; essay-benchmark.ts; essay_benchmark_runs; extract_cartilha.py | tests/unit/essay-benchmark.test.ts; tests/db/essay-benchmark.test.ts | PARCIAL | Conjunto local: 8 redações UFES (uma faixa); faltam intermediárias/baixas e autorização para envio à API |
| 6.4 | Temas e propostas | essay_themes/motivator_texts | — | PARCIAL | Temas oficiais/inéditos a validar |
| 6.5 | Teoria e atividades direcionadas | essay_theory, essay_exercises, submitDiscursive | — | PARCIAL | Conteúdo a produzir |
| 6.6 | Reescritas | submitPartialRewrite; reescrita integral | — | IMPLEMENTADO | Adicionar E2E de reescrita |
| 6.7 | Repertórios | repertoires + seleção (RLS) | — | IMPLEMENTADO | Banco de repertórios a produzir |
| 6.8 | Forma de envio | editor com autosave (RLS) | tests/e2e/flows.spec.ts | TESTADO |  |
| 6.9 | Indicadores de redação | essayIndicators | tests/unit/modules.test.ts | TESTADO |  |
| 6.10 | Franquias e qualidade | franquias essays/rewrites/discursive | tests/db/services.test.ts | TESTADO |  |
| 7.1 | Escopo autorizado | services/ai.ts finalidades | — | IMPLEMENTADO |  |
| 7.2 | Modelos e roteamento | ai_models (aprovação manual) | — | PENDENTE | Confirmar IDs, preços e qualidade |
| 7.3 | Contexto pedagógico e RAG | ragContext por filtros; pgvector | — | PARCIAL | Embeddings não gerados (custo/autorização) |
| 7.4 | Avaliação de explicações ativas | prompt concept_eval + schema | tests/db/services.test.ts | TESTADO |  |
| 7.5 | Correção de redação | validateFullEvaluation; trava essayBenchmarkGate (ADR-019) | tests/unit/modules.test.ts; tests/db/services.test.ts; tests/db/essay-benchmark.test.ts | TESTADO | Benchmark real aprovado pendente (bloqueia produção) |
| 7.6 | Geração e validação de gêmeas | twins checks + validação independente | tests/unit/modules.test.ts | IMPLEMENTADO |  |
| 7.7 | Regras de ausência de assistência | sem gabarito/IA antes do envio | tests/e2e/flows.spec.ts | TESTADO |  |
| 7.8 | Controle de qualidade e falhas | runAi retry/validação; franquia liberada | tests/db/services.test.ts | TESTADO |  |
| 7.9 | Limites e custo | quotas + custo por chamada | tests/db/services.test.ts | TESTADO |  |
| 7.10 | Administração e acompanhamento | /admin/ia, prompts versionados, orçamento | — | IMPLEMENTADO |  |
| 8.1 | Dimensões | skill_evidence dimensões | tests/unit/mastery.test.ts | TESTADO |  |
| 8.2 | Índice ponderado | combineDimensions | tests/unit/mastery.test.ts | TESTADO |  |
| 8.3 | Resolução ponderada por dificuldade | resolução 50/35/15 | tests/unit/mastery.test.ts | TESTADO |  |
| 8.4 | Quantidade mínima de evidência | minEvidence por relevância e disponibilidade | tests/unit/mastery.test.ts | TESTADO | Experimental |
| 8.5 | Peso temporal | temporalWeight | tests/unit/mastery.test.ts | TESTADO | Experimental |
| 8.6 | Estados de aprendizagem | estados e rebaixamento | tests/unit/mastery.test.ts | TESTADO |  |
| 8.7 | Cobertura e domínio curricular | curricularIndicators | tests/unit/mastery.test.ts; tests/db/services.test.ts | TESTADO |  |
| 8.8 | Indicadores de simulados | scoreExam (sem TRI) | tests/unit/modules.test.ts; tests/e2e/flows.spec.ts | TESTADO |  |
| 8.9 | Página de desempenho | /desempenho abas e filtros | tests/db/services.test.ts | IMPLEMENTADO |  |
| 8.10 | Transparência do indicador | dimensões recolhidas; rule_version | — | IMPLEMENTADO |  |
| 9.1 | Finalidade e escopo | gamificação individual | — | IMPLEMENTADO |  |
| 9.2 | Experiência por atividade | xp_rules + awardXp | tests/db/services.test.ts | TESTADO |  |
| 9.3 | Níveis e classes | levelFor | tests/unit/modules.test.ts | TESTADO |  |
| 9.4 | Conquistas | achievements + checkAchievements | — | IMPLEMENTADO |  |
| 9.5 | Sequência de estudo | currentStreak | tests/unit/modules.test.ts | TESTADO |  |
| 9.6 | Ranking | ranking opt-in, menores | tests/db/services.test.ts | TESTADO | Validação jurídica |
| 9.7 | Prevenção de manipulação | XP idempotente; validação no servidor | tests/db/services.test.ts; tests/db/pgtap.test.ts | TESTADO |  |
| 9.8 | Independência pedagógica | motor não lê XP | — | DOCUMENTAL |  |
| 9.9 | Interface | /perfil; nada durante sessões | — | IMPLEMENTADO |  |
| 10.1 | Navegação e mapa de domínio | components/liquid.tsx + mapa hierárquico | — | IMPLEMENTADO | Teste com estudantes |
| 10.2 | Dashboard equilibrado | /inicio 70/30 | tests/e2e/flows.spec.ts | IMPLEMENTADO |  |
| 10.3 | Identidade visual | globals.css tokens (paleta preliminar) | — | PARCIAL | Logo/tipografia definitivas |
| 10.4 | Aparência | tema claro/escuro/automático persistido | tests/e2e/flows.spec.ts | TESTADO |  |
| 10.5 | Interface das sessões adaptativas | /estudar/sessao modo foco | tests/e2e/flows.spec.ts | TESTADO |  |
| 10.6 | Interface de resolução de questões | question-view (vertical/lado a lado, eliminação, zoom) | tests/e2e/flows.spec.ts | TESTADO |  |
| 10.7 | Organização das ferramentas | Estudar/Questões abas | — | IMPLEMENTADO |  |
| 10.8 | Responsividade mobile (decisão revisada) | web responsiva, menu inferior | — | IMPLEMENTADO | Validar em protótipo com estudantes |
| 10.9 | Acessibilidade | semântica, foco, contraste, teclado | tests/e2e/flows.spec.ts | PARCIAL | Auditoria de acessibilidade completa |
| 10.10 | Minimalismo funcional | minimalismo funcional | — | DOCUMENTAL |  |
| 11.1 | Público-alvo e posicionamento | — | — | DOCUMENTAL |  |
| 11.2 | Concorrência e diferenciação | — | — | DOCUMENTAL | Revisar concorrentes antes do lançamento |
| 11.3 | Monetização | freemium sem anúncios | — | IMPLEMENTADO |  |
| 11.4 | Plano Gratuito | plan_limits Gratuito | tests/db/services.test.ts | TESTADO | Subconjunto de aulas gratuitas: proposta |
| 11.5 | Planos Plus e Pro | plan_limits Plus/Pro | tests/db/services.test.ts | TESTADO |  |
| 11.6 | Custos de inteligência artificial | ai_usage.cost_usd; orçamento | tests/db/services.test.ts | PARCIAL | Preços reais de API |
| 11.7 | Infraestrutura | — | — | PENDENTE | Contas Supabase/Cloudflare, deploy |
| 11.8 | Custos administrativos, fiscais e pagamentos | integrations/asaas.ts + webhook | tests/db/services.test.ts | PARCIAL | Sandbox Asaas sem credenciais; tarifas a conferir |
| 11.9 | Custo por estudante e por plano | /admin/financeiro | — | IMPLEMENTADO |  |
| 11.10 | Modalidades de assinatura e precificação | preços nulos; checkout bloqueado até aprovação | tests/db/services.test.ts | TESTADO | Preços a definir pelos sócios |
| 11.11 | Margem e estratégia financeira | — | — | DOCUMENTAL |  |
| 11.12 | Ponto de equilíbrio e investimento | — | — | DOCUMENTAL |  |
| 11.13 | Projeções financeiras e crescimento | — | — | DOCUMENTAL |  |
| 11.14 | Sazonalidade e retenção | histórico preservado no downgrade/cancelamento | tests/unit/modules.test.ts | IMPLEMENTADO |  |
| 11.15 | Marketing e expansão | marketing_metrics (admin) | — | IMPLEMENTADO |  |
| 12.1 | Modelo de implementação escolar | — | — | FUTURO | Fora do MVP |
| 12.2 | Perfis e permissões | user_roles student/admin | tests/db/pgtap.test.ts | TESTADO |  |
| 12.3 | Painel administrativo | /admin | tests/e2e/flows.spec.ts | TESTADO |  |
| 12.4 | Usuários e assinaturas | admin.listUsers/grantAccess/setSuspension | — | IMPLEMENTADO |  |
| 12.5 | Conteúdos | admin content review/publish/import | — | IMPLEMENTADO |  |
| 12.6 | Financeiro e comercial | admin.financeReport | — | IMPLEMENTADO |  |
| 12.7 | Monitoramento técnico e IA | alerts, monitoring, backup checks | — | IMPLEMENTADO | Ferramentas dos fornecedores a conectar |
| 13.1 | Coleta e minimização | profiles mínimo; CPF não armazenado | — | IMPLEMENTADO |  |
| 13.2 | Proteção de menores | guardian_consents; ranking menores | tests/db/services.test.ts | PARCIAL | Envio de e-mail ao responsável e validação jurídica |
| 13.3 | Autenticação e segurança | auth local/Supabase, MFA admin, rate limit | tests/db/pgtap.test.ts; tests/e2e/flows.spec.ts | PARCIAL | Supabase Auth não testado contra projeto real |
| 13.4 | Privacidade e personalização de IA | scrubPII; contexto sem identificadores | tests/unit/modules.test.ts | TESTADO |  |
| 13.5 | Armazenamento, backups e recuperação | scripts/backup/*.sh; checkBackupFreshness | — | PARCIAL | Executar em infraestrutura real |
| 13.6 | Direitos dos usuários e exclusão | export/correção/exclusão | tests/db/services.test.ts; tests/e2e/flows.spec.ts | TESTADO |  |
| 13.7 | Assinaturas e cancelamentos | deriveSubscriptionStatus, cancelamento, arrependimento | tests/unit/modules.test.ts; tests/db/services.test.ts | TESTADO | Prorrata/contrato a validar |
| 13.8 | Prevenção de abusos e fraudes | rate limits, webhooks autenticados, XP no servidor | tests/db/services.test.ts; tests/db/pgtap.test.ts | TESTADO |  |
| 13.9 | Direitos autorais e acervo | rights_status e restrição de publicação | tests/db/services.test.ts | IMPLEMENTADO | Verificar direitos de cada fonte |
| 13.10 | Termos e documentação jurídica | legal_documents versionados + aceites | — | PENDENTE | Redação e revisão jurídica |
| 14.1 | Escopo da primeira versão | — | — | PARCIAL | Software implementado; acervo e validações pendentes |
| 14.2 | Acervo inicial | pipeline + admin | — | PENDENTE | Acervo integral |
| 14.3 | Ordem de implementação | backend primeiro | — | DOCUMENTAL |  |
| 14.4 | Estrutura do piloto | — | — | PENDENTE | Piloto não realizado |
| 14.5 | Seleção de participantes | access_grants/cupons para piloto | — | PENDENTE |  |
| 14.6 | Validação pedagógica | — | — | PENDENTE |  |
| 14.7 | Feedback | FeedbackButton + /admin/feedback | — | IMPLEMENTADO |  |
| 14.8 | Critérios para lançamento comercial | — | — | PENDENTE | Critérios go/no-go não atendidos |
| 14.9 | Estratégia de lançamento | — | — | DOCUMENTAL |  |
| 15.1 | Stack tecnológica | Next 16/TS/Tailwind/Zod/Postgres/ts-fsrs/Vitest/pgTAP/Playwright | npm run check | PARCIAL | R2 e Workers pendentes |
| 15.2 | Arquitetura lógica | src/modules, src/server, src/integrations | — | IMPLEMENTADO |  |
| 15.3 | Modelagem do banco | supabase/migrations + RLS | tests/db/pgtap.test.ts; tests/db/migrations.test.ts | TESTADO |  |
| 15.4 | Importação oficial e preparação | scripts/import-enem | scripts/import-enem/test_pipeline.py | TESTADO | Execução com dados reais pendente |
| 15.5 | Algoritmo adaptativo | adaptive-engine | tests/unit/adaptive-engine.test.ts | TESTADO |  |
| 15.6 | Cálculo de domínio | mastery | tests/unit/mastery.test.ts | TESTADO |  |
| 15.7 | Revisões e FSRS | fsrs.ts, reviews | tests/unit/modules.test.ts | TESTADO |  |
| 15.8 | Integrações IA e RAG | openai.ts, ai.ts, prompts.ts | tests/db/services.test.ts | PARCIAL | Sem chamadas reais (autorização/credenciais) |
| 15.9 | Asaas e franquias | reserve_quota/finalize_quota; webhook | tests/db/services.test.ts | TESTADO |  |
| 15.10 | Repositório e colaboração | git local (develop), CI | .github/workflows/ci.yml | PARCIAL | Repositório remoto e proteção de branches |
| 15.11 | Divisão entre os sócios | — | — | DOCUMENTAL |  |
| 15.12 | Testes automatizados e validação | Vitest, pgTAP, Playwright, unittest | npm run check; npm run test:e2e | PARCIAL | Carga, restauração e sandbox Asaas pendentes |
| 15.13 | Hospedagem e implantação | — | — | PENDENTE | Prova de conceito Workers/OpenNext |
| 15.14 | Documentação técnica | docs/specs/* | — | IMPLEMENTADO |  |
| 15.15 | Roadmap | docs/specs/ROADMAP.md | — | DOCUMENTAL |  |
