# Implementation Plan: Catálogo Oficial do ENEM (Todos os Anos), Paginação de 25 Itens e Exibição de Imagens

**Branch**: `001-nexo-commercial-v1-enem` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-enem-catalog-all-years/spec.md`

## Summary

Expandir o pipeline offline de ingestão do ENEM para descobrir e importar **todos os anos disponíveis (2009+)** com espelhamento interno de imagens de todas as origens (`files[]`, Markdown embutido em `contextMd` e `alternatives[].file`), conectar a aba **Questões** da interface V0.2 ao catálogo oficial com **paginação estrita de 25 questões por página** (estilo catálogo sincronizado com a URL e filtro dinâmico de anos), e garantir a **exibição fiel, deduplicada e ampliável (lightbox)** de todas as imagens nas questões e alternativas.

## Technical Context

**Language/Version**: TypeScript 5.6 (Node.js 22+ com `node:sqlite` nativo no backend; React 18 no front-end)  
**Primary Dependencies**: React 18, React Router 6, Zustand, Tailwind CSS 3 (design system V0.2 `ink`/`brand`), Lucide React, `node:http`, `node:sqlite`, Vitest  
**Storage**: SQLite local-first (`server/data/nexo.db`) + `LocalAssetStorage` em disco (`server/data/assets/` com deduplicação SHA-256, servido via `/api/assets/:key`)  
**Testing**: Vitest (`npm test`) — testes unitários e de integração HTTP + SQLite in-memory  
**Target Platform**: Aplicação Web (desktop e mobile responsivo) + CLI Node.js de ingestão offline  
**Project Type**: Full-stack web application (`src/` front-end + `server/` backend + `scripts/` CLI)  
**Performance Goals**: Paginação e filtros no catálogo em < 1s (consultas SQLite < 10ms via índice dedicado); máximo de 25 questões por página em memória/rede/DOM  
**Constraints**: Sem dependência de APIs externas em tempo de execução do estudante; rate limit de 1 req/s respeitado na ingestão offline; imagens servidas exclusivamente pelo storage interno `/api/assets/:key`  
**Scale/Scope**: ~15+ edições do ENEM (2009–2023+), ~2.700–3.500 questões oficiais e milhares de figuras espelhadas com deduplicação SHA-256

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Rigor Pedagógico ENEM e Transparência**: PASS — 100% questões oficiais do ENEM no catálogo, questões anuladas excluídas por padrão, idioma estrangeiro (Inglês/Espanhol) preservado, metadados oficiais exibidos com transparência.
- **II. Integridade de IA em Produção e Proteção de Margem**: PASS — Feature não aciona IA nem modo demonstrativo de IA; foco no acervo oficial estático/interno.
- **III. Privacidade por Design e Conformidade LGPD/CDC**: PASS — Nenhum dado pessoal sensível novo; reportes de erro continuam pseudonimizados.
- **IV. Qualidade Guiada por Testes e Contratos**: PASS — Cobertura automatizada prevista para ingestão multi-ano, espelhamento/reescrita de imagens Markdown, paginação de 25 itens, endpoint `/api/enem/years` e deduplicação de imagens.
- **V. Evolução em Ondas Verticais e Simplicidade Disciplinada**: PASS — Reutiliza `EnemRepository`, `LocalAssetStorage` e o design system V0.2 sem adicionar dependências externas nem módulos fora do escopo V1.
- **VI. Observabilidade e Auditabilidade Operacional**: PASS — CLI emite relatório estruturado por ano; relatos de imagens quebradas continuam alimentando `question_reports`.
- **Guardrail de Autonomia do Acervo**: PASS — Todas as questões e imagens (incluindo Markdown embutido) são persistidas internamente antes do uso pelos estudantes.

*Re-check pós-design (Phase 1)*: PASS — Todos os contratos, modelo de dados e fluxos de UI permanecem 100% aderentes aos seis princípios.

## Project Structure

### Documentation (this feature)

```text
specs/002-enem-catalog-all-years/
├── spec.md              # Especificação funcional e critérios de aceitação
├── plan.md              # Este arquivo
├── research.md          # Decisões técnicas (Phase 0)
├── data-model.md        # Modelo de dados, índice e DTOs (Phase 1)
├── quickstart.md        # Guia de validação ponta a ponta (Phase 1)
├── contracts/
│   └── api.md           # Contratos HTTP, CLI e URL (Phase 1)
├── checklists/
│   └── requirements.md  # Checklist de qualidade da spec
└── tasks.md             # Lista de tarefas (gerada por /speckit-tasks)
```

### Source Code (repository root)

```text
scripts/
└── ingest-enem.ts                 # Descoberta de todos os anos, retry/throttle, espelhamento Markdown + files + alternativas

server/
├── db.ts                          # Índice idx_enem_q_catalog_order para paginação rápida
├── index.ts                       # Rota GET /api/enem/years
├── repositories/
│   └── enem.ts                    # listYears(), paginação page/pageSize=25, totalPages, hasImages
└── routes/
    └── enem.ts                    # Handlers listYears() e listQuestions() com page/limit=25

src/
├── services/
│   └── api.ts                     # Tipos EnemCatalogPageDTO, EnemYearsSummaryDTO, hasImages
├── components/
│   ├── EnemMedia.tsx              # Renderizador seguro de Markdown + imagens deduplicadas + lightbox + fallback
│   └── Pagination.tsx             # Controle de catálogo paginado (Anterior, Próxima, números com reticências)
└── pages/
    ├── Questoes.tsx               # Catálogo oficial paginado (25/página) no visual V0.2 + filtros + URL sync
    └── Resolver.tsx               # Resolução de questão oficial ENEM com imagens/lightbox + fallback V0.2 para IDs locais

tests/
├── unit/
│   ├── ingest-enem.test.ts        # Testes multi-ano, reescrita Markdown de imagens e deduplicação
│   └── enem-media.test.ts         # Testes de extração/deduplicação de imagens e cálculo de páginas
└── integration/
    └── enem-catalog.test.ts       # Testes HTTP de /api/enem/years, paginação 25/página e normalização de página
```

**Structure Decision**: Mantida a estrutura full-stack existente (`scripts/`, `server/`, `src/`, `tests/`), adicionando apenas dois componentes focados de UI (`EnemMedia.tsx` e `Pagination.tsx`) e estendendo os módulos de ingestão e repositório já existentes.

## Complexity Tracking

Nenhuma violação da Constituição. Nenhuma complexidade adicional injustificada.
