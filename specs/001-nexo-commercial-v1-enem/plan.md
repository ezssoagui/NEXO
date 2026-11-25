# Implementation Plan: NEXO V1 Comercial (Foco 100% ENEM)

**Branch**: `001-nexo-commercial-v1-enem` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-nexo-commercial-v1-enem/spec.md`

## Summary

Evoluir o protótipo atual da NEXO para a versão comercial **V1 focada 100% no ENEM** com modelo **100% pago** (NEXO Mensal ou Anual, sem plano gratuito nem trial), mantendo uma **abordagem local-first no V1** (Node.js + TypeScript + SQLite nativo + simulador controlado de gateway de pagamento) com fronteiras arquiteturais limpas e substituíveis (`StoreRepositories`, `PaymentGateway`, `LLMProvider` multi-LLM para Claude/Gemini/GPT e `AssetStorage` local → R2/S3). A entrega será executada em **4 Ondas Verticais** independentemente testáveis, cobrindo acervo oficial ENEM (2009+, H1–H30, TRI), IA em tempo real sem modo demonstrativo em produção, correção de redação C1–C5, evolução por evidências, flashcards SRS, simulados TRI, gamificação individual leve e Painel Admin operacional.

## Technical Context

**Language/Version**: TypeScript ~5.6 (ESM), Node.js 22+ (`node:sqlite` nativo, `fetch` nativo) no backend; React 18 + Vite 5 no frontend.

**Primary Dependencies**:
- Frontend: `react`, `react-router-dom`, `zustand`, `recharts`, `lucide-react`, `tailwindcss`
- Backend: `node:http`, `node:sqlite`, `node:crypto`, `zod` (validação de contratos e saídas estruturadas de IA), `@anthropic-ai/sdk` + adaptadores HTTP nativos/SDK para Google Gemini e OpenAI GPT.

**Storage**: SQLite local (`server/data/nexo.db` via `node:sqlite`) encapsulado em repositórios tipados com SQL compatível com PostgreSQL (`ADR-001`); imagens oficiais do ENEM espelhadas via `AssetStorage` em `server/data/assets/` no V1 e pronto para Cloudflare R2 / S3 em produção (`ADR-004`).

**Testing**: `vitest` (testes unitários do núcleo pedagógico `src/engine/`, testes de integração da API/SQLite `:memory:`, testes de máquina de estados comercial, idempotência de webhooks, ledger/estorno de cotas e fallback multi-LLM com provedores mockados).

**Target Platform**: Aplicação Web SPA (desktop e mobile browser) + Servidor API Node.js Linux/local.

**Project Type**: Web application (Frontend SPA em `src/` + Backend API em `server/` + CLI offline de ingestão em `scripts/`).

**Performance Goals**:
- Listagem/filtro do Banco ENEM e Dashboard: resposta < 250ms em banco local.
- Correção de redação por IA (C1–C5): ≤ 45s (p95) com timeout controlado e fallback automático.
- Intervenção de IA Tutora em tempo real: ≤ 10s (p95).
- Ingestão CLI ENEM: idempotente e resiliente a rate limit (respeitando 1 req/s quando puxar da `api.enem.dev`).

**Constraints**:
- Zero modo demonstrativo/heurístico simulado em produção (`FR-015`).
- Zero armazenamento de CPF do estudante menor no perfil pedagógico (`FR-003`).
- Bloqueio estritamente seletivo ao zerar cota de IA (`FR-014`).
- Sem exposição de chaves de IA ou segredos no navegador.
- `.specify/` e `.agents/` permanecem fora do GitHub (`.gitignore`); `specs/` e `docs/adr/` são versionados.

**Scale/Scope**: 38 requisitos funcionais (`FR-001` a `FR-038`), ~3.000+ questões oficiais ENEM (2009+), 120 habilidades oficiais (`H1–H30` × 4 áreas), 4 Ondas Verticais de implementação.

## Constitution Check

*GATE: Evaluated pre-design and re-verified post-design against `.specify/memory/constitution.md` (v1.0.0).*

| Princípio | Gate Pré-Design | Gate Pós-Design (Phase 1) | Evidência no Plano |
|---|---|---|---|
| **I. Rigor Pedagógico ENEM e Transparência** | PASS | PASS | Escopo 100% ENEM (`enem_skills` 120 H1–H30); `src/engine/` preservado puro; comprovação oficial primária (`POST /api/learning/proof-question`); selos formativos obrigatórios em Redação e Simulados TRI. |
| **II. Integridade de IA em Produção e Proteção de Margem** | PASS | PASS | Remoção do fallback para `DemoProvider` no cliente; multi-LLM (Claude/Gemini/GPT) no servidor com Zod (`ADR-003`); `ai_quota_ledger` atômico com *reserve → commit/refund*; bloqueio seletivo (`402 quota_exceeded`). |
| **III. Privacidade por Design e LGPD/CDC** | PASS | PASS | `payers` separado de `users`/`student_profiles` (zero CPF do menor); `payment_events` idempotente; máquina de estados com CDC 7 dias e tolerância 3 dias; `/api/me/export` e `DELETE /api/me` sempre liberados. |
| **IV. Qualidade Guiada por Testes e Contratos** | PASS | PASS | Suíte Vitest expandida para cobrir cada regra crítica por onda usando SQLite `:memory:`, `LocalPaymentGateway` e `MockProvider` multi-LLM. |
| **V. Evolução em Ondas Verticais e Disciplina de Escopo** | PASS | PASS | Plano organizado em 4 Ondas Verticais; rotas fora do V1 removidas/ocultadas na Onda 1; 4 ADRs versionadas em `docs/adr/`. |
| **VI. Observabilidade e Auditabilidade Operacional** | PASS | PASS | `ai_operation_logs` pseudonimizados, `ai_quota_ledger`, `payment_events` e `admin_audit_logs` integrados ao Painel Admin. |

**Gate Result**: **PASS (0 violações)** — pronto para geração de tarefas (`/speckit-tasks`).

## Project Structure

### Documentation (this feature & repository ADRs)

```text
docs/adr/
├── README.md
├── 0001-local-first-sqlite-with-repository-abstraction.md
├── 0002-decoupled-payment-gateway-with-local-simulator.md
├── 0003-pluggable-multi-llm-provider-with-fallback-and-ledger.md
└── 0004-offline-enem-ingestion-and-mirrored-asset-storage.md

specs/001-nexo-commercial-v1-enem/
├── spec.md              # Especificação de Regras de Negócio V1
├── plan.md              # Este plano (/speckit-plan)
├── research.md          # Decisões consolidadas (Phase 0)
├── data-model.md        # Modelo relacional, estados e ledger (Phase 1)
├── quickstart.md        # Guia executável de validação E2E (Phase 1)
├── checklists/
│   └── requirements.md  # Checklist de qualidade da spec
├── contracts/
│   └── api.md           # Contratos HTTP API e CLI (Phase 1)
└── tasks.md             # Saída do /speckit-tasks (4 Ondas Verticais)
```

### Source Code (repository root)

```text
scripts/
└── ingest-enem.ts                 # CLI offline: enem.dev + INEP ITENS_PROVA + espelhamento de imagens

server/
├── index.ts                       # Servidor HTTP modular e roteador de API + assets locais
├── db.ts                          # Inicialização SQLite + migrações idempotentes do esquema V1
├── repositories/                  # Camada de persistência desacoplada (pronta para PostgreSQL)
│   ├── users.ts                   # Contas por e-mail/senha, sessões, reset, perfil LGPD
│   ├── billing.ts                 # Payers, subscriptions, payment_events idempotentes
│   ├── quotas.ts                  # Cycles mensais, addons e ledger atômico (reserve/commit/refund)
│   ├── enem.ts                    # enem_skills (H1–H30), enem_questions, reports
│   └── learning.ts                # Attempts, mastery_cycles, essays, flashcards, simulations, streaks/XP, logs
├── gateways/
│   ├── payment.ts                 # Interface PaymentGateway + LocalPaymentGateway (V1)
│   └── assets.ts                  # Interface AssetStorage + LocalAssetStorage (V1 → R2/S3)
├── ai/
│   ├── providers.ts               # LLMProvider + Anthropic, Gemini, OpenAI + FallbackChainProvider
│   ├── schemas.ts                 # Contratos Zod (Diagnose, Tutor, Essay C1-C5, QuestionFallback)
│   └── service.ts                 # Orquestração reserva de cota → fallback multi-LLM → commit/estorno → log
├── routes/
│   ├── auth.ts                    # Registro/login e-mail, reset senha, export/delete LGPD
│   ├── billing.ts                 # Planos, checkout, cancelamento CDC, upgrade, webhook, simulador dev
│   ├── enem.ts                    # Consulta/filtros H1–H30/TRI, comprovação oficial, reports
│   ├── ai.ts                      # Health, quotas, diagnose, tutor, question fallback
│   ├── essays.ts                  # Temas, rascunho, envio C1–C5, versões
│   ├── flashcards.ts              # Baralhos prontos, automáticos, manuais privados, SRS
│   ├── simulations.ts             # Simulados cronometrados + estimativa TRI + recuperação
│   └── admin.ts                   # Métricas negócio/IA/pedagógicas, ajuste auditável, triagem
└── privacy.ts                     # Pseudonimização e sanitização de PII

src/
├── types.ts                       # Contratos TypeScript V1 (100% ENEM)
├── data/
│   ├── enemSkills.ts              # Matriz oficial H1–H30 (4 áreas)
│   └── curatedFlashcards.ts       # Baralhos iniciais curados ENEM
├── engine/                        # Núcleo pedagógico puro (sem React)
│   ├── mastery.ts                 # Radar de Domínio H1–H30 por evidências + regressão
│   ├── evidence.ts                # Classificação de evidência (acerto confiante × frágil × erro)
│   ├── intervention.ts            # Situações A–F + hipótese revisável
│   ├── cycle.ts                   # Ciclo Diagnosticar→Consolidar
│   ├── proofSelector.ts           # Seleção oficial primária por H1–H30 + proximidade TRI
│   ├── detective.ts               # Detetive de Erros
│   ├── recommend.ts               # Trilha semanal adaptativa + plano de recuperação
│   ├── srs.ts                     # Repetição espaçada adaptativa
│   ├── tri.ts                     # Estimativa formativa estilo TRI (usando a/b/c oficiais)
│   └── gamification.ts            # Streak, metas semanais e XP individual anti-abuso
├── services/
│   ├── api.ts                     # Cliente HTTP autenticado (tratando 402 subscription/quota e 503 IA)
│   └── ai.ts                      # Somente chamadas reais ao servidor (sem DemoProvider em produção)
├── store/
│   └── useStore.ts                # Estado sincronizado com backend
├── components/                    # UI reutilizável (sem badges de modo demo em produção)
└── pages/                         # Apenas rotas do V1: Welcome, Auth, Billing, Onboarding, Diagnostico,
                                   # Dashboard, Trilha, Questoes, Resolver, Tutor, Redacao, Flashcards,
                                   # Simulados, Desempenho, Perfil (LGPD), Admin

tests/
├── unit/                          # Núcleo pedagógico, máquina de estados, cotas, proofSelector, TRI, SRS
└── integration/                   # API ponta a ponta (SQLite :memory:, LocalPaymentGateway, Multi-LLM Mock)
```

**Structure Decision**: Mantida a arquitetura web unificada existente (`src/` + `server/` + `tests/`), adicionando `scripts/` para ingestão offline e modularizando `server/` em `repositories/`, `gateways/`, `ai/` e `routes/`. Rotas e páginas fora do V1 (`Arena`, `Aulas`, `Aula`, `Biblioteca`, `Ensinar`, `Portfolio`) são removidas da navegação e do roteador principal na Onda 1.

## Estratégia de Execução em 4 Ondas Verticais

1. **Onda 1 — Fundação Comercial, LGPD, Limpeza de Escopo & Acervo ENEM (P1)**
   - Esquema SQLite V1 + repositórios; Auth por e-mail/senha + reset + LGPD (`payers` separado de `users`/`student_profiles`, exportação/exclusão sempre livres).
   - `PaymentGateway` + `LocalPaymentGateway` + máquina de estados completa (`active`, `grace_period` 3d, `canceled_until_end`, `suspended`, `refunded` CDC 7d) + webhooks idempotentes + gate `402`.
   - CLI `scripts/ingest-enem.ts` (2009+, `enem.dev` + `ITENS_PROVA` H1–H30/TRI + `AssetStorage` local) + telas de Banco ENEM + remoção de rotas fora do V1.
2. **Onda 2 — Multi-LLM Real, Ledger de Cotas, Redação C1–C5 & Tutoria NEXO (P1)**
   - `FallbackChainProvider` (Claude, Gemini, OpenAI) + Zod; `ai_quota_ledger` atômico (renovação mensal inclusive no Anual, precedência cota mensal → avulso, estorno automático em falha total); remoção do `DemoProvider` do fluxo de produção.
   - Pacotes avulsos + bloqueio seletivo (`402 quota_exceeded`) mantendo banco/simulados/flashcards liberados.
   - Correção de Redação C1–C5 (editor 30 linhas, rascunho, versões, aviso formativo, 1 crédito por envio/reescrita).
   - IA Tutora em tempo real (Metodologia NEXO) + `proofSelector` oficial primário (`H1–H30` + TRI) + fallback por IA somente no esgotamento do acervo.
3. **Onda 3 — Evolução Pedagógica, Flashcards SRS & Simulados TRI (P2)**
   - Onboarding + Diagnóstico Inicial + Trilha semanal adaptativa + sessões cronometradas.
   - Radar de Domínio H1–H30 baseado em evidências + Detetive de Erros conectados às tentativas reais.
   - Flashcards ENEM (baralhos curados + automáticos de erros + manuais privados + SRS) e Simulados cronometrados estilo TRI + plano de recuperação.
4. **Onda 4 — Gamificação Individual, Painel Admin Operacional & Hardening (P3)**
   - Streak diário, metas semanais e XP individual anti-abuso.
   - Painel Admin completo (assinaturas, custo/margem de IA, fallback, métricas pseudonimizadas, triagem de questões reportadas, gestão de temas, estorno manual auditável).
   - Suíte de validação final (todos os cenários do `quickstart.md`, build + lint + testes).

## Complexity Tracking

> Nenhuma violação da Constituição foi identificada. As abstrações introduzidas (`StoreRepositories`, `PaymentGateway`, `AssetStorage` e `FallbackChainProvider`) correspondem diretamente aos requisitos de negócio e ADRs aprovadas (`ADR-001` a `ADR-004`).
