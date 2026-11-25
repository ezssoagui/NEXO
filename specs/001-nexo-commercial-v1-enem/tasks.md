---

description: "Task list for NEXO V1 Commercial (100% ENEM) organized by user story and mapped to 4 vertical waves"
---

# Tasks: NEXO V1 Comercial (Foco 100% ENEM)

**Input**: Design documents from `/specs/001-nexo-commercial-v1-enem/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`, `.specify/memory/constitution.md`

**Tests**: Incluídos como obrigatórios por história/onda conforme Princípio IV da Constituição (*Qualidade Guiada por Testes e Contratos — NON-NEGOTIABLE*).

**Organization**: Tarefas agrupadas por fase e User Story em ordem de prioridade (`P1 → P2 → P3`), mapeadas diretamente às **4 Ondas Verticais** do `plan.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos distintos, sem dependência em tarefa incompleta)
- **[Story]**: User Story atendida (`[US1]` a `[US7]`) — omitido em Setup, Foundational e Polish
- Todos os caminhos de arquivo são relativos à raiz do repositório (`server/`, `src/`, `scripts/`, `tests/`)

---

## Phase 1: Setup (Shared Infrastructure — Onda 1)

**Purpose**: Preparar configuração de ambiente, scripts CLI e limpeza estrita do escopo fora do V1 (Princípio V).

- [x] T001 Atualizar variáveis de ambiente documentadas (`NEXO_AI_PROVIDERS`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `NEXO_PAYMENT_GATEWAY=local`, `NEXO_ASSETS_DIR`, `NEXO_ADMIN_CODE`) em `.env.example`
- [x] T002 Adicionar script `ingest:enem` (`tsx scripts/ingest-enem.ts`) e atualizar scripts de verificação em `package.json`
- [x] T003 [P] Remover rotas e links fora do escopo V1 (`Arena`, `Aulas`, `Aula`, `Biblioteca`, `Ensinar`, `Portfolio` e filtros de Vestibular/Olimpíadas) do roteador e navegação em `src/App.tsx` e `src/components/Layout.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites — Ondas 1 e 2)

**Purpose**: Infraestrutura compartilhada que desbloqueia todas as User Stories (esquema SQLite V1, gateways substituíveis, núcleo multi-LLM com fallback + ledger atômico de cotas, contratos de tipos ENEM e roteador modular).

**⚠️ CRITICAL**: Nenhuma User Story pode iniciar antes da conclusão desta fase.

- [x] T004 Evoluir esquema SQLite (`PRAGMA foreign_keys = ON`) criando tabelas idempotentes `users`, `sessions`, `password_reset_tokens`, `student_profiles`, `payers`, `subscriptions`, `payment_events`, `ai_quota_cycles`, `ai_addon_balances`, `ai_quota_ledger`, `enem_skills`, `enem_questions`, `attempts`, `mastery_cycles`, `essay_themes`, `essays`, `essay_versions`, `flashcards`, `flashcard_reviews`, `simulations`, `daily_streaks`, `xp_events`, `ai_operation_logs`, `question_reports` e `admin_audit_logs` com todos os `CHECK` constraints de `data-model.md` em `server/db.ts`
- [ ] T005 [P] Atualizar tipos de domínio 100% ENEM (removendo `Vestibular`/`Olimpíada`, definindo estados de assinatura, cotas, `OfficialEnemQuestion`, `EssayVersion`, `FlashcardOrigin` e `SimulationSession`) em `src/types.ts`
- [x] T006 [P] Criar catálogo completo das 120 habilidades oficiais do ENEM (`LC`, `CH`, `CN`, `MT` × `H01`–`H30`, com `competency_num` e descritor oficial INEP) em `src/data/enemSkills.ts`
- [x] T007 [P] Implementar interface `AssetStorage` e adaptador local com deduplicação SHA-256 (`LocalAssetStorage`, pronto para troca por R2/S3) em `server/gateways/assets.ts`
- [x] T008 [P] Implementar interface `PaymentGateway` e adaptador `LocalPaymentGateway` (checkout Cartão/Pix, pacotes avulsos, reembolso CDC e gerador de eventos simulados) em `server/gateways/payment.ts`
- [ ] T009 [P] Implementar camada multi-LLM (`AnthropicProvider`, `GeminiProvider`, `OpenAIProvider` e `FallbackChainProvider` percorrendo `NEXO_AI_PROVIDERS` em falhas recuperáveis `timeout`/`rate_limited`/`unavailable`/`invalid_output`, com validação Zod estrita e estimativa de custo USD) em `server/ai/providers.ts` e `server/ai/schemas.ts`
- [x] T010 Implementar configuração comercial centralizada (`server/config/plans.ts` com preços Mensal/Anual, cotas mensais padrão e pacotes avulsos) e repositório atômico de cotas `QuotasRepository` (renovação mensal sem acúmulo inclusive no Anual, precedência estrita `monthly_cycle` → `addon` mais próximo do vencimento, transação `reserve` → `commit` / `refund` idempotente por `operation_id`) em `server/repositories/quotas.ts`
- [ ] T011 Implementar orquestrador central `AIService` (reserva de cota → execução `FallbackChainProvider` → commit ou estorno automático em falha total → log pseudonimizado em `ai_operation_logs`, proibindo modo demonstrativo em produção) em `server/ai/service.ts`
- [x] T012 Modularizar servidor HTTP com middleware de autenticação, gate de assinatura (`402 subscription_required` para rotas pedagógicas quando `status NOT IN ('active','canceled_until_end','grace_period')`, mantendo `/api/me*` e `/api/billing*` livres), servir `/api/assets/:key` e roteamento modular em `server/index.ts`
- [ ] T013 [P] Remover fallback para `DemoProvider` em produção no cliente HTTP/IA (`src/services/ai.ts`) e criar cliente autenticado tratando `402 subscription_required`, `402 quota_exceeded` e `503 ai_unavailable` em `src/services/api.ts`

**Checkpoint**: Fundação pronta — repositórios, esquema V1, gateways locais, multi-LLM com estorno atômico e roteador modular operacionais.

---

## Phase 3: User Story 1 - Contratação, Ciclo de Vida da Assinatura e Proteção LGPD (Priority: P1 — Onda 1 🎯 MVP)

**Goal**: Entregar o fluxo comercial 100% pago (Mensal/Anual via Cartão/Pix), autenticação por e-mail/senha + recuperação, máquina de estados completa (CDC 7d, cancelamento até o fim do ciclo, tolerância de 3d, suspensão com histórico preservado), idempotência de eventos financeiros e conformidade LGPD para menores (separação Pagador × Estudante sem CPF do menor).

**Independent Test**: Cadastrar estudante menor sem CPF, validar bloqueio `402` sem assinatura, simular checkout Mensal/Anual (Cartão e Pix) com evento duplicado e fora de ordem, validar CDC ≤ 7 dias (`refunded`), cancelamento > 7 dias (`canceled_until_end`), inadimplência com tolerância 3 dias → `suspended` preservando histórico, e validar exportação/exclusão LGPD em qualquer estado.

### Tests for User Story 1 ⚠️

- [x] T014 [P] [US1] Criar testes unitários e de integração da máquina de estados de assinatura (CDC 7d, cancelamento, tolerância 3d, suspensão, reativação, upgrade Mensal→Anual, eventos duplicados e fora de ordem) em `tests/integration/billing-lifecycle.test.ts`
- [x] T015 [P] [US1] Criar testes de autenticação por e-mail/senha, recuperação de senha, separação LGPD Pagador × Estudante (sem CPF do menor) e exportação/exclusão em conta suspensa em `tests/integration/auth-lgpd.test.ts`

### Implementation for User Story 1

- [x] T016 [P] [US1] Implementar `UsersRepository` (`email` único lowercase, `nickname` 2–20 chars, `scrypt` + salt, `role` in `'student'|'admin'`, `lgpd_consent_at`, `is_minor`, `sessions`, `password_reset_tokens` e `student_profiles` sem CPF) em `server/repositories/users.ts`
- [x] T017 [P] [US1] Implementar `BillingRepository` (`payers`, `subscriptions` com `plan_code` `'nexo_monthly'|'nexo_annual'`, `payment_method` `'credit_card'|'pix'`, `cdc_deadline_at`, `grace_until`, `last_event_ts` e `payment_events` com PK `event_id` para idempotência) em `server/repositories/billing.ts`
- [x] T018 [US1] Implementar rotas `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/me`, `/api/me/profile`, `/api/me/export` e `DELETE /api/me` em `server/routes/auth.ts`
- [x] T019 [US1] Implementar rotas `/api/billing/plans`, `/api/billing/checkout`, `/api/billing/cancel` (lógica CDC ≤ 7d vs `canceled_until_end` vs cancelamento em `grace_period`), `/api/billing/upgrade-annual`, `/api/billing/webhook` (idempotente + proteção `last_event_ts`) e `/api/billing/dev/simulate` (somente dev/local) em `server/routes/billing.ts`
- [ ] T020 [US1] Atualizar telas de cadastro/login por e-mail + recuperação de senha (`src/pages/Welcome.tsx`, `src/pages/Onboarding.tsx`), checkout Mensal/Anual com dados do Pagador/Responsável + gerenciamento de assinatura/cancelamento (`src/pages/Planos.tsx`) e painel de privacidade LGPD acessível mesmo em conta suspensa (`src/pages/Perfil.tsx`)

**Checkpoint**: User Story 1 completa e validada (MVP comercial 100% pago + LGPD funcional ponta a ponta).

---

## Phase 4: User Story 2 - Banco de Questões Oficiais do ENEM e Ensino de Resolução por IA em Tempo Real (Priority: P1 — Ondas 1 e 2)

**Goal**: Popular acervo próprio de questões oficiais do ENEM (2009+) cruzadas com `H1–H30` e TRI do INEP + imagens espelhadas, oferecer busca/filtros completos, acionar IA Tutora em tempo real na Metodologia NEXO (sem pré-enriquecimento) e comprovar domínio usando prioritariamente outra questão oficial inédita da mesma `H1–H30` e TRI compatível (gerando via IA apenas ao esgotar oficiais).

**Independent Test**: Executar CLI offline de ingestão com fixture ENEM + `ITENS_PROVA`, validar filtros H1–H30/TRI e exclusão de anuladas, errar questão oficial, acionar diagnóstico + tutoria NEXO em tempo real (com reclassificação/adiamento/interrupção) e confirmar seleção oficial primária na comprovação + geração validada via IA somente ao esgotar oficiais.

### Tests for User Story 2 ⚠️

- [x] T021 [P] [US2] Criar testes unitários da CLI de ingestão ENEM (cruzamento `ITENS_PROVA` por caderno/posição/idioma, marcação de `annulled`, idempotência e espelhamento de imagens) em `tests/unit/ingest-enem.test.ts`
- [x] T022 [P] [US2] Criar testes unitários do seletor de comprovação `proofSelector` (seleção oficial inédita por `skill_id` + proximidade `tri_b`, exclusão de `annulled` e sinalização de `officialExhausted`) em `tests/unit/proof-selector.test.ts`
- [ ] T023 [P] [US2] Criar testes de integração do Banco ENEM, `/api/ai/diagnose`, `/api/ai/tutor`, `/api/learning/proof-question` e `/api/ai/questions/fallback` (validação 5 alternativas + 1 correta + rótulo `ai_generated_fallback`) em `tests/integration/enem-and-tutor.test.ts`

### Implementation for User Story 2

- [x] T024 [P] [US2] Implementar `EnemRepository` (upsert idempotente de `enem_skills` e `enem_questions`, filtros por `area`/`discipline`/`skillId`/`year`/`difficultyBand`/`status`, exclusão automática de `annulled` em modos ativos e registro em `question_reports`) em `server/repositories/enem.ts`
- [x] T025 [US2] Implementar CLI offline `scripts/ingest-enem.ts` importando questões de `enem.dev` (respeitando rate limit 1 req/s ou `--source-dir` local), cruzando `ITENS_PROVA_{ANO}.csv` (`CO_HABILIDADE` → `H01–H30`, `CO_ITEM`, `tri_a/b/c`) e espelhando imagens via `AssetStorage`
- [x] T026 [P] [US2] Implementar motor puro de seleção de comprovação pós-erro `selectProofQuestion` priorizando questão oficial inédita da mesma `skill_id` e menor distância de `tri_b` em `src/engine/proofSelector.ts`
- [x] T027 [US2] Implementar rotas do acervo ENEM (`/api/enem/skills`, `/api/enem/questions`, `/api/enem/questions/:id`, `/api/enem/questions/:id/report`, `/api/learning/proof-question`) em `server/routes/enem.ts`
- [ ] T028 [US2] Implementar rotas de IA em tempo real (`/api/ai/diagnose`, `/api/ai/tutor`, `/api/ai/questions/fallback` bloqueando geração enquanto houver oficial disponível e validando 5 alternativas únicas + 1 gabarito antes de entregar) em `server/routes/ai.ts`
- [ ] T029 [US2] Atualizar telas de Banco de Questões ENEM (`src/pages/Questoes.tsx`), Resolução com Metodologia NEXO em tempo real + reclassificação/adiar/interromper + comprovação oficial/fallback (`src/pages/Resolver.tsx`, `src/components/AfterAnswer.tsx`) e Tutor (`src/pages/Tutor.tsx`)

**Checkpoint**: User Story 2 completa — banco oficial ENEM 2009+ com H1–H30/TRI + IA Tutora em tempo real + comprovação oficial primária validados.

---

## Phase 5: User Story 3 - Correção de Redação ENEM por IA (C1–C5) e Reescrita Versionada (Priority: P1 — Onda 2)

**Goal**: Permitir escrita de redação digitada padrão ENEM (até 30 linhas, rascunho automático, temas oficiais + atuais), correção por IA C1–C5 (múltiplos de 40, destaques literais no texto, 5 elementos da C5, aviso formativo obrigatório) consumindo 1 crédito por envio ou reescrita, e histórico comparativo de versões.

**Independent Test**: Criar rascunho sem gastar crédito, validar bloqueio de texto vazio/>30 linhas sem debitar crédito, submeter redação consumindo 1 crédito com retorno C1–C5 + aviso formativo, e submeter reescrita consumindo 1 novo crédito com comparação lado a lado.

### Tests for User Story 3 ⚠️

- [ ] T030 [P] [US3] Criar testes de integração de Redação (validação de entrada ≤ 30 linhas, salvamento de rascunho gratuito, consumo exato de 1 crédito no 1º envio e na reescrita, descarte de citações inventadas, múltiplos de 40 nas C1–C5, preservação de rascunho + estorno em falha total de IA) em `tests/integration/essays.test.ts`

### Implementation for User Story 3

- [ ] T031 [P] [US3] Implementar persistência de temas, rascunhos e versões imutáveis (`essay_themes`, `essays`, `essay_versions` com `line_count <= 30` e vínculo `quota_ledger_id`) em `server/repositories/learning.ts`
- [ ] T032 [US3] Implementar rotas `/api/essays`, `PUT /api/essays/:id/draft` e `POST /api/essays/:id/submit` (validação de mínimo de palavras e máximo 30 linhas antes de reservar crédito; execução via `AIService` C1–C5; normalização múltiplos de 40; verificação dos 5 elementos C5; descarte de citações não literais; geração automática de flashcards a partir de pontos críticos das competências) em `server/routes/essays.ts`
- [ ] T033 [US3] Atualizar interface de Redação (`src/pages/Redacao.tsx`) com editor padrão ENEM (contador de linhas até 30, salvamento automático de rascunho, biblioteca de temas oficiais/atuais, aviso permanente de avaliação formativa por IA, destaques no texto, checklist C5 e comparador de versões)

**Checkpoint**: User Story 3 completa — todas as histórias P1 (US1, US2 e US3) funcionando e testadas.

---

## Phase 6: User Story 4 - Diagnóstico Inicial, Trilha Adaptativa Semanal e Acompanhamento de Evolução (Priority: P2 — Onda 3)

**Goal**: Guiar o novo assinante no onboarding e diagnóstico inicial pelas 4 áreas do ENEM, recalcular continuamente a trilha semanal adaptativa com sessões cronometradas e exibir evolução real por evidências no Radar de Domínio (H1–H30) e no Detetive de Erros.

**Independent Test**: Concluir onboarding + diagnóstico de um assinante recém-ativado, verificar geração da trilha priorizando lacunas críticas H1–H30, registrar acertos confiantes vs. frágeis e erros recorrentes, e validar transição de estados no Radar de Domínio (incluindo regressão) e consolidação no Detetive de Erros.

### Tests for User Story 4 ⚠️

- [ ] T034 [P] [US4] Criar testes unitários e de integração do Radar de Domínio H1–H30 (4 estados progressivos, peso de acerto frágil e regressão), Detetive de Erros e cálculo da trilha semanal adaptativa em `tests/integration/evolution-and-track.test.ts`

### Implementation for User Story 4

- [ ] T035 [P] [US4] Adaptar motores puros `src/engine/mastery.ts`, `src/engine/evidence.ts`, `src/engine/detective.ts` e `src/engine/recommend.ts` para operar nativamente sobre as 120 habilidades oficiais H1–H30 e parâmetros TRI
- [ ] T036 [US4] Implementar rotas `/api/learning/attempts` (registro transacional de tentativa, evidência e ciclo de domínio) e `/api/learning/dashboard` (Radar H1–H30, Detetive de Erros e Trilha semanal) em `server/routes/learning.ts`
- [ ] T037 [US4] Conectar telas `src/pages/Diagnostico.tsx`, `src/pages/Trilha.tsx`, `src/pages/Sessao.tsx`, `src/pages/Dashboard.tsx` e `src/pages/Desempenho.tsx` aos dados reais do backend (100% ENEM)

**Checkpoint**: User Story 4 completa — diagnóstico, trilha semanal e acompanhamento real de evolução H1–H30 operacionais.

---

## Phase 7: User Story 5 - Flashcards ENEM (SRS) e Simulados Cronometrados estilo TRI (Priority: P2 — Onda 3)

**Goal**: Entregar Flashcards ENEM com repetição espaçada adaptativa a partir das 3 origens permitidas no V1 (baralhos prontos ENEM, flashcards automáticos de erros em questões/redações e flashcards manuais privados) e Simulados ENEM cronometrados com estimativa formativa estilo TRI e plano de recuperação.

**Independent Test**: Revisar cartão de baralho pronto com SRS (`Errei`/`Com dúvida`/`Com segurança`), validar geração automática de flashcard após erro em questão/redação, criar/editar/excluir flashcard manual privado (isolado por usuário), e concluir simulado cronometrado validando exclusão de anuladas, nota estimada estilo TRI (com aviso formativo) e plano de recuperação.

### Tests for User Story 5 ⚠️

- [ ] T038 [P] [US5] Criar testes de integração para Flashcards (3 origens, isolamento privado entre estudantes, algoritmo SRS e geração automática em erro) e Simulados cronometrados (exclusão de anuladas, estimativa TRI e plano de recuperação) em `tests/integration/flashcards-and-simulations.test.ts`

### Implementation for User Story 5

- [ ] T039 [P] [US5] Criar seed de baralhos curados iniciais por área/habilidade do ENEM em `src/data/curatedFlashcards.ts` e motor puro de estimativa formativa estilo TRI (usando `tri_a`/`tri_b`/`tri_c`) em `src/engine/tri.ts`
- [ ] T040 [US5] Implementar rotas `/api/flashcards` (GET/POST/PUT/DELETE com escopo estrito `owner_user_id` para privados, criação automática em erros e `POST /api/flashcards/:id/review` com SRS) em `server/routes/flashcards.ts`
- [ ] T041 [US5] Implementar rotas `/api/simulations` e `POST /api/simulations/:id/finish` (montagem sem anuladas, correção, estimativa formativa estilo TRI e plano de recuperação priorizando erros de menor `tri_b`) em `server/routes/simulations.ts`
- [ ] T042 [US5] Atualizar telas `src/pages/Flashcards.tsx` (3 abas/origens, CRUD de cartões manuais privados, calendário SRS e retenção) e `src/pages/Simulados.tsx` (cronômetro ENEM, nota estimada estilo TRI com selo formativo e plano de recuperação)

**Checkpoint**: User Story 5 completa — consolidação por flashcards SRS e simulados cronometrados TRI operacionais.

---

## Phase 8: User Story 6 - Governança de Cotas de IA, Pacotes Avulsos e Resiliência em Produção (Priority: P2 — Onda 2/3)

**Goal**: Expor visibilidade transparente de cotas mensais e créditos avulsos, habilitar checkout de pacotes avulsos pós-cota, validar bloqueio seletivo (sem travar estudo não-IA) e garantir resiliência multi-LLM sem modo demonstrativo em produção.

**Independent Test**: Consumir 100% da cota mensal de redação/tutoria, confirmar bloqueio seletivo (`402 quota_exceeded`) com Banco ENEM/Flashcards/Simulados 100% liberados, comprar pacote avulso (testando idempotência em evento duplicado), testar virada de mês no plano Anual (reset sem acúmulo preservando saldo avulso) e testar falha no provedor primário (fallback secundário) e falha total (`503`, estorno automático, zero modo demo).

### Tests for User Story 6 ⚠️

- [ ] T043 [P] [US6] Criar testes de integração de resiliência multi-LLM (Claude→Gemini→OpenAI fallback), estorno atômico em falha total, ausência de modo demonstrativo, renovação mensal no plano Anual sem acúmulo, precedência mensal→avulso e bloqueio seletivo (`402 quota_exceeded`) em `tests/integration/ai-quotas-and-resilience.test.ts`

### Implementation for User Story 6

- [ ] T044 [US6] Implementar rotas `/api/ai/health`, `/api/ai/quotas` e `/api/billing/addons/checkout` (integrado ao webhook idempotente com `payment_event_id` único em `ai_addon_balances`) em `server/routes/ai.ts` e `server/routes/billing.ts`
- [ ] T045 [US6] Criar componente de saldo transparente de cotas mensais/avulsas + modal de compra de pacote avulso em `src/components/QuotaPanel.tsx` e substituir `src/components/AIStatusBadge.tsx` removendo qualquer selo ou fluxo de "modo demonstrativo" em produção

**Checkpoint**: User Story 6 completa — governança comercial de cotas, pacotes avulsos e resiliência multi-LLM 100% validadas.

---

## Phase 9: User Story 7 - Gamificação Individual Leve e Painel Administrativo Operacional (Priority: P3 — Onda 4)

**Goal**: Entregar constância individual (ofensiva/streak, metas semanais e XP com proteção anti-abuso) e Painel Administrativo exclusivo para `admin` com indicadores financeiros, custos/margem de IA, taxa de fallback, métricas pedagógicas pseudonimizadas, triagem de questões sinalizadas, gestão de temas e estorno manual auditável.

**Independent Test**: Validar streak/XP individual bloqueando pontuação duplicada na mesma questão no mesmo dia; validar acesso `403` de conta `student` ao `/api/admin/*`; acessar `/admin` como `admin` validando métricas consolidadas pseudonimizadas, resolução de questão reportada e ajuste manual de crédito registrado em `admin_audit_logs`.

### Tests for User Story 7 ⚠️

- [ ] T046 [P] [US7] Criar testes unitários de gamificação individual anti-abuso (`daily_streaks`, metas semanais e `xp_events` por `event_key`) em `tests/unit/gamification-v1.test.ts`
- [ ] T047 [P] [US7] Criar testes de integração do Painel Admin (controle de papel `admin` vs `student`, agregados financeiros/IA/fallback pseudonimizados, triagem de `question_reports`, gestão de temas e auditoria de `/api/admin/quotas/adjust`) em `tests/integration/admin-operations.test.ts`

### Implementation for User Story 7

- [ ] T048 [P] [US7] Simplificar `src/engine/gamification.ts` removendo ligas/escolas/rankings sociais e mantendo apenas streak diário, metas semanais configuráveis e XP individual anti-abuso persistidos em `server/repositories/learning.ts`
- [ ] T049 [US7] Implementar rotas `/api/admin/overview`, `POST /api/admin/quotas/adjust` (com registro obrigatório em `admin_audit_logs`), `GET`/`PATCH /api/admin/reports`, `GET`/`POST`/`PATCH /api/admin/themes` e `GET`/`POST`/`PATCH`/`DELETE /api/admin/flashcards` (gestão de baralhos curados) em `server/routes/admin.ts`
- [ ] T050 [US7] Atualizar `src/pages/Admin.tsx` e `src/components/ServerMetrics.tsx` com painéis de assinaturas, custo/margem de IA, estabilidade de provedores multi-LLM, fila de questões reportadas, gestão de temas e baralhos curados e formulário auditável de ajuste de créditos

**Checkpoint**: Todas as 7 User Stories (P1, P2 e P3) implementadas e verificadas independentemente.

---

## Phase 10: Polish & Cross-Cutting Concerns (Onda 4 — Finalização)

**Purpose**: Hardening, limpeza de código legado fora do V1, documentação final e validação completa do `quickstart.md`.

- [ ] T051 [P] Remover ou arquivar código morto dos módulos fora do V1 (`Arena.tsx`, `Aulas.tsx`, `Aula.tsx`, `Biblioteca.tsx`, `Ensinar.tsx`, `Portfolio.tsx` e dados fictícios legados não utilizados) garantindo zero imports órfãos em `src/`
- [ ] T052 [P] Atualizar `README.md` com instruções reais do NEXO V1 Comercial (ingestão ENEM, multi-LLM, simulador de pagamentos local e guia de testes)
- [ ] T053 Executar validação completa dos cenários A–D de `specs/001-nexo-commercial-v1-enem/quickstart.md`, garantir `npm test`, `npm run lint` e `npm run build` com 0 erros e auditar ausência de vazamento de segredos ou CPF em logs

---

## Dependencies & Execution Order

### Mapeamento para as 4 Ondas Verticais

| Onda | Fases / Stories | Critério de Saída (Checkpoint) |
|---|---|---|
| **Onda 1 — Fundação Comercial & Acervo ENEM** | Phase 1 + Phase 2 (base DB/Auth/Billing/Assets) + Phase 3 (`US1`) + T021, T024, T025, T027 (`US2` banco ENEM) | Cadastro e-mail/LGPD + Assinatura 100% paga + CLI ENEM 2009+/H1–H30/TRI + Banco ENEM funcionando e testado |
| **Onda 2 — IA Real Multi-LLM, Cotas, Redação & Tutoria** | Phase 2 (T009–T011, T013) + Phase 4 (`US2` IA/proofSelector) + Phase 5 (`US3`) + Phase 8 (`US6`) | Multi-LLM (Claude/Gemini/GPT) + estorno atômico + zero modo demo + Redação C1–C5 + Tutoria NEXO + comprovação oficial + pacotes avulsos |
| **Onda 3 — Evolução, Flashcards SRS & Simulados TRI** | Phase 6 (`US4`) + Phase 7 (`US5`) | Diagnóstico + Trilha semanal + Radar H1–H30 + Detetive + Flashcards (3 origens) + Simulados TRI |
| **Onda 4 — Operação, Constância & Hardening** | Phase 9 (`US7`) + Phase 10 (Polish) | Gamificação individual + Painel Admin operacional + limpeza legado + `quickstart.md` 100% verde |

### Phase Dependencies

- **Phase 1 (Setup)** → desbloqueia **Phase 2 (Foundational)**.
- **Phase 2 (Foundational)** → bloqueia todas as User Stories (`US1`–`US7`).
- **US1 (P1)** → independente após Phase 2 (MVP comercial mínimo).
- **US2 (P1)** e **US3 (P1)** → dependem da Phase 2 (esquema + `AIService`/ledger) e integram-se ao gate de assinatura de `US1`.
- **US4 (P2)** e **US5 (P2)** → dependem do acervo ENEM (`US2`) e tentativas/redações (`US2`/`US3`).
- **US6 (P2)** → aprofunda UI e add-ons sobre `QuotasRepository`/`AIService` (Phase 2) e `BillingRepository` (`US1`).
- **US7 (P3)** → consolida métricas e auditoria sobre todas as entidades anteriores.
- **Phase 10 (Polish)** → depende da conclusão das ondas anteriores.

### Parallel Opportunities

```bash
# Exemplo de paralelismo dentro da Phase 2 (Foundational):
T005 (src/types.ts) || T006 (src/data/enemSkills.ts) || T007 (server/gateways/assets.ts) || T008 (server/gateways/payment.ts) || T009 (server/ai/providers.ts + schemas.ts)

# Exemplo de paralelismo dentro da Phase 3 (US1):
T014 (tests/integration/billing-lifecycle.test.ts) || T015 (tests/integration/auth-lgpd.test.ts)
T016 (server/repositories/users.ts) || T017 (server/repositories/billing.ts)
```

---

## Implementation Strategy

1. **Executar Onda 1 primeiro (MVP Comercial + Banco ENEM)**: concluir Setup + Foundational base + US1 + ingestão/banco US2, rodar `npm test && npm run build`, validar Cenário A do `quickstart.md` e commitar.
2. **Executar Onda 2 (IA Real + Cotas + Redação + Tutoria)**: concluir Multi-LLM + Ledger + US2 (IA/comprovação) + US3 + US6, validar Cenário B e commitar.
3. **Executar Onda 3 (Evolução + Flashcards + Simulados)**: concluir US4 + US5, validar Cenário C e commitar.
4. **Executar Onda 4 (Gamificação + Admin + Polish)**: concluir US7 + Phase 10, validar Cenário D + `quickstart.md` completo e commitar.
