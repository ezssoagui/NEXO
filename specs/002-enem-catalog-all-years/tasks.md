# Tasks: Catálogo Oficial do ENEM (Todos os Anos), Paginação de 25 Itens e Exibição de Imagens

**Input**: Design documents from `/specs/002-enem-catalog-all-years/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`

**Tests**: Incluídos conforme o Princípio IV da Constituição do NEXO (cobertura automatizada para ingestão multi-ano, espelhamento/deduplicação de imagens e paginação de 25 itens).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos distintos, sem dependência de tarefa incompleta)
- **[Story]**: User Story atendida (`[US1]`, `[US2]`, `[US3]`, `[US4]`)

---

## Phase 1: Foundational (Pré-requisitos de Banco e Contratos)

**Purpose**: Índice SQLite para paginação rápida e tipos compartilhados usados por backend e front-end.

- [x] T001 Adicionar índice `idx_enem_q_catalog_order ON enem_questions(status, year DESC, question_index ASC)` em `server/db.ts`
- [x] T002 [P] Atualizar tipos DTO (`OfficialEnemQuestionDTO` com `hasImages: boolean`, `EnemCatalogPageDTO` com `items`, `total`, `page`, `pageSize`, `totalPages`, e `EnemYearsSummaryDTO` com `years`, `total`) em `src/services/api.ts`

**Checkpoint**: Esquema indexado e contratos de tipos prontos para as User Stories.

---

## Phase 2: User Story 2 - Importar e Manter o Acervo Oficial de Todos os Anos do ENEM (Priority: P1)

**Goal**: Descobrir e importar todas as edições disponíveis do ENEM (2009 até a mais recente) de forma idempotente, resiliente a rate-limit/falhas pontuais, com espelhamento interno de imagens de `files[]`, Markdown embutido em `contextMd` e `alternatives[].file`.

**Independent Test**: Executar `tests/unit/ingest-enem.test.ts` validando descoberta/ingestão multi-ano, reescrita de URLs de imagem Markdown em `contextMd`, deduplicação em `assets`, preservação de idioma estrangeiro (Inglês/Espanhol), marcação de anuladas e resiliência a falha em um ano.

### Implementation for User Story 2

- [x] T003 [US2] Implementar helpers puros de extração/reescrita de imagens Markdown (`!\[[^\]]*\]\(([^)\s]+)[^)]*\)`), deduplicação de `assets`, `discoverAvailableYears` (`GET /v1/exams` com fallback `2009..anoAtual`) e `fetchWithRetry` (backoff em `429`/`5xx`, throttle `>= 1100ms`) em `scripts/ingest-enem.ts`
- [x] T004 [US2] Atualizar `ingestEnemBatch` e `runCli` em `scripts/ingest-enem.ts` para padrão `--years all` (todos os anos disponíveis), persistência ano a ano com relatório por ano (`IngestYearReport`), espelhamento único por URL em `contextMd` + `files[]` + `alternatives[].file` e continuação em caso de falha isolada de um ano
- [x] T005 [P] [US2] Expandir testes unitários cobrindo multi-ano, reescrita de imagens Markdown em `contextMd`, deduplicação entre `contextMd` e `files[]`, idiomas Inglês/Espanhol e resiliência a falha por ano em `tests/unit/ingest-enem.test.ts`

**Checkpoint**: Pipeline CLI de ingestão de todos os anos pronto e validado por testes unitários.

---

## Phase 3: User Story 1 - Navegar pelo Catálogo Paginado de Questões Oficiais do ENEM (Priority: P1) 🎯 MVP

**Goal**: Disponibilizar paginação estrita de 25 questões por página na API e na aba **Questões** (no visual V0.2), com filtro dinâmico de anos efetivamente cadastrados, navegação numerada tipo catálogo e sincronização com a URL.

**Independent Test**: Executar `tests/integration/enem-catalog.test.ts` (validando `GET /api/enem/years`, `GET /api/enem/questions?page=N&limit=25`, normalização de página fora do intervalo e `hasImages`) e navegar pela aba `/questoes` confirmando 25 itens por página e persistência de página/filtros na URL.

### Implementation for User Story 1

- [x] T006 [US1] Implementar `listYears()` (retornando `{ years: { year, count }[], total }` apenas de `status = 'active'` ordenados por `year DESC`) e atualizar `listQuestions()` em `server/repositories/enem.ts` para suportar `page` (1-based) com `pageSize` padrão `25`, normalização de página `[1, totalPages]`, retorno de `{ items, total, page, pageSize, totalPages }` e campo `hasImages: boolean` em cada questão
- [x] T007 [US1] Expor `listYears()` em `server/routes/enem.ts` (ajustando limite padrão de `listQuestions` para `25` e repassando `page`) e registrar rota `GET /api/enem/years` em `server/index.ts`
- [x] T008 [P] [US1] Criar componente reutilizável de paginação de catálogo (`Pagination.tsx`) com botões Anterior/Próxima, páginas numeradas com reticências, resumo `Exibindo X–Y de Z questões` e helper puro `buildPageRange(current, total)` em `src/components/Pagination.tsx`
- [x] T009 [US1] Atualizar `src/pages/Questoes.tsx` no design system V0.2 (`ink`/`brand`) para consumir `GET /api/enem/questions` (limite fixo de `25` por página) e `GET /api/enem/years`, com filtros dinâmicos, reset para página 1 ao filtrar, sincronização completa com `useSearchParams`, indicador leve "Com imagem" (`hasImages`), estado vazio/gate claro (incluindo ativação dev local em `import.meta.env.DEV`) e preservação do retorno na navegação
- [x] T010 [P] [US1] Criar testes de integração HTTP para `GET /api/enem/years`, paginação de 25 itens, normalização de páginas inválidas/acima do limite, filtro por ano/área e flag `hasImages` em `tests/integration/enem-catalog.test.ts`

**Checkpoint**: Aba Questões funciona como catálogo paginado de 25 itens com filtro dinâmico de anos e testes de integração passando.

---

## Phase 4: User Story 3 - Exibir Imagens de Enunciados e Alternativas na Resolução e Revisão (Priority: P1)

**Goal**: Garantir renderização fiel, responsiva, sem duplicação e ampliável (lightbox) de todas as imagens de enunciados (inline Markdown e anexos) e alternativas A–E, com fallback amigável em erro de carregamento.

**Independent Test**: Executar `tests/unit/enem-media.test.ts` (parsing de Markdown com imagens, deduplicação contra `assets[]` e cálculo de paginação) e abrir questões com imagem no enunciado e nas alternativas em `/questoes/:id`, validando exibição, ampliação e fechamento com `Esc`.

### Implementation for User Story 3

- [x] T011 [P] [US3] Criar `src/components/EnemMedia.tsx` com helpers puros `parseEnemMarkdown(md)` e `dedupeExtraAssets(md, assets)`, renderização segura de texto + imagens inline e anexos extras sem duplicação, componente de imagem com fallback de erro (`onError`), e modal lightbox ampliável com fechamento por clique e tecla `Esc`
- [x] T012 [US3] Atualizar `src/pages/Resolver.tsx` no design system V0.2 para carregar questões oficiais (`/api/enem/questions/:id`) renderizando enunciado e anexos via `EnemMedia`, imagens nas alternativas A–E (`alt.assetUrl`) com ampliação, seleção de confiança, conferência do gabarito oficial mantendo imagens visíveis, reporte de erro (`/api/enem/questions/:id/report`) e preservação de retorno à página exata do catálogo
- [x] T013 [P] [US3] Criar testes unitários para parsing de imagens Markdown, deduplicação entre texto e `assets[]` e `buildPageRange` em `tests/unit/enem-media.test.ts`

**Checkpoint**: Todas as imagens de enunciados e alternativas exibem corretamente com ampliação e fallback.

---

## Phase 5: User Story 4 - Integrar Modos de Estudo da Aba Questões ao Acervo Oficial (Priority: P2)

**Goal**: Garantir coexistência limpa entre o catálogo oficial do ENEM e os fluxos da interface V0.2 (`Percurso`, `Sessao`, `Atividade`, `Habilidade`), preservando fallback em `Resolver.tsx` para IDs locais da V0.2 e navegação fluida de retorno ao catálogo.

**Independent Test**: Abrir uma questão oficial a partir de `/questoes?page=2&year=2023`, responder e clicar em "Voltar ao catálogo" confirmando restauração da página 2; e abrir uma questão local da V0.2 (ex.: vinda de `Percurso` ou `Inicio`) confirmando que o `QuestionPlayer` da V0.2 continua funcionando sem erro.

### Implementation for User Story 4

- [x] T014 [US4] Garantir em `src/pages/Resolver.tsx` o roteamento transparente: IDs oficiais (`enem-*`) carregam do banco oficial via `/api/enem/questions/:id` (com botão "Voltar ao catálogo" preservando `location.state.from`), enquanto IDs locais da V0.2 continuam renderizando via `QuestionPlayer` sem regressão

**Checkpoint**: Fluxo oficial ENEM e fluxos V0.2 coexistem sem regressões.

---

## Phase 6: Polish & Verification

**Purpose**: Validação completa de tipagem, build de produção e suíte inteira de testes.

- [x] T015 Executar `npm run build` (`tsc -b && vite build`) e `npm test` (`vitest run`) validando 100% dos testes unitários e de integração sem regressões

---

## Dependencies & Execution Order

- **Phase 1 (Foundational)**: T001 e T002 podem rodar em paralelo e desbloqueiam todas as fases seguintes.
- **Phase 2 (US2 - Ingestão todos os anos)**: T003 → T004 → T005 (independente da UI).
- **Phase 3 (US1 - Catálogo 25/página)**: T006 → T007 → T009; T008 (`Pagination.tsx`) e T010 (testes) podem rodar em paralelo após T002/T007.
- **Phase 4 (US3 - Imagens & Lightbox)**: T011 (`EnemMedia.tsx`) em paralelo com Phase 3; T012 (`Resolver.tsx`) depende de T011; T013 em paralelo com T012.
- **Phase 5 (US4 - Integração V0.2)**: T014 consolidado junto ou logo após T012.
- **Phase 6 (Polish)**: T015 após conclusão de todas as tarefas anteriores.

## Implementation Strategy

1. Executar Phase 1 (`server/db.ts` + `src/services/api.ts`).
2. Executar Phase 2 (`scripts/ingest-enem.ts` + `tests/unit/ingest-enem.test.ts`).
3. Executar Phase 3 e Phase 4 em paralelo nos arquivos independentes (`server/repositories/enem.ts`, `server/routes/enem.ts`, `server/index.ts`, `src/components/Pagination.tsx`, `src/components/EnemMedia.tsx`, `src/pages/Questoes.tsx`, `src/pages/Resolver.tsx` + testes).
4. Validar com `npm run build` e `npm test` (Phase 6).
