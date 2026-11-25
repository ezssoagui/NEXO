# Research & Technical Decisions: Catálogo Oficial do ENEM (Todos os Anos), Paginação de 25 Itens e Imagens

**Feature**: `002-enem-catalog-all-years`  
**Date**: 2026-11-24

## D1 — Descoberta e Ingestão Resiliente de Todos os Anos do ENEM

- **Decision**: Atualizar `scripts/ingest-enem.ts` para que, quando `--years` não for informado (ou for `--years all`), consulte `GET https://api.enem.dev/v1/exams` para descobrir dinamicamente todos os anos publicados (2009 até o mais recente disponível), processando ano a ano com persistência imediata no SQLite, throttle de `>= 1100ms` por página, retentativa com backoff exponencial em respostas `429`/`5xx` (até 3 tentativas) e relatório consolidado por ano (incluindo eventuais falhas sem interromper os demais anos).
- **Rationale**: O padrão anterior (`2023-2023`) importava apenas uma edição. Com ~15+ edições (2009–2023+, ~2.700+ questões), uma falha transitória em um ano não pode abortar nem perder o trabalho já persistido. O `upsertQuestion` idempotente garante que reexecuções completem anos faltantes sem duplicidade.
- **Alternatives considered**:
  - *Hardcode de `2009-2025`*: rejeitado como estratégia primária porque anos ainda não publicados geram 404 desnecessários; mantido apenas como fallback caso `GET /v1/exams` esteja indisponível.
  - *Busca em tempo real na API externa pelo navegador*: rejeitado por violar a Constituição (Guardrail de autonomia do acervo) e sofrer com rate limit de 1 req/s.

## D2 — Espelhamento Completo e Deduplicação de Imagens

- **Decision**: Durante a ingestão (`ingestEnemBatch`), extrair e espelhar imagens de **três origens**: (1) `raw.files[]`, (2) marcações Markdown `!\[[^\]]*\]\(([^)\s]+)[^)]*\)` embutidas em `raw.context`, e (3) `raw.alternatives[].file`. Cada URL é baixada no máximo uma vez por questão (cache por URL no batch), armazenada via `AssetStorage.put` (deduplicado por SHA-256 em `server/data/assets/`), e reescrita em `contextMd` para o endereço interno `/api/assets/<hash>.<ext>`. Na renderização no front-end, imagens já presentes inline no `contextMd` não são repetidas na galeria de anexos `assets[]`.
- **Rationale**: Provas oficiais na `api.enem.dev` frequentemente repetem a mesma imagem em `context` (como `![](url)`) e em `files[]`. Sem reescrita do Markdown, o aluno veria texto bruto `![](https://...)` ou dependeria de hotlink externo; sem deduplicação na renderização, a figura apareceria dobrada.
- **Alternatives considered**:
  - *Remover todas as imagens de `contextMd` e exibir apenas em `assets[]`*: rejeitado porque algumas questões têm texto antes e depois de uma figura/tirinha; preservar a posição inline mantém a fidelidade à prova original.
  - *Renderizar links externos diretamente*: rejeitado pela Constituição (autonomia operacional) e risco de quebra/CORS.

## D3 — Paginação Estrita de 25 Itens por Página no Catálogo

- **Decision**: Fixar o tamanho de página do catálogo em `PAGE_SIZE = 25` no front-end e ajustar o padrão de `server/routes/enem.ts` / `server/repositories/enem.ts` para `25` (com teto de segurança `25` para o catálogo ou `<= 100` no repositório). Adicionar suporte a `page` (1-based) além de `offset`, retornando `{ items, total, page, pageSize, totalPages }`, além de um campo booleano `hasImages` por item e um endpoint leve `GET /api/enem/years` que retorna `{ years: { year: number; count: number }[], total: number }` para popular o filtro de anos dinamicamente. Criar índice SQLite `idx_enem_q_year_status ON enem_questions(status, year DESC, question_index ASC)`.
- **Rationale**: Com 2.700+ questões, trazer apenas 25 registros por consulta mantém payloads pequenos (~20–40 KB), consultas SQLite abaixo de 10ms e DOM leve. Persistir `page` e filtros nos `URLSearchParams` garante continuidade ao navegar para uma questão e voltar.
- **Alternatives considered**:
  - *Scroll infinito*: rejeitado porque o usuário pediu explicitamente mudança de página "como um catálogo" e porque o scroll infinito acumula centenas de nós no DOM ao longo da navegação.
  - *Paginação apenas no cliente*: rejeitado porque exigiria baixar todas as 2.700+ questões na abertura da aba, causando exatamente a sobrecarga que o usuário quer evitar.

## D4 — Coexistência Harmoniosa com a Interface V0.2

- **Decision**: Construir a nova tela paginada em `src/pages/Questoes.tsx` e a visualização com imagens/lightbox em `src/pages/Resolver.tsx` utilizando integralmente o design system V0.2 (`ink`/`brand`, `PageHeader`, `Empty`, `Modal`, `Badge`, `cx`). Em `Resolver.tsx`, rotear por prefixo do ID: se o ID corresponder a uma questão oficial (`enem-...`), carregar via `/api/enem/questions/:id` com renderização completa de imagens + lightbox + reporte; caso contrário (ex.: questões demonstrativas vindas de `Percurso`, `Sessao` ou `Atividade`), manter o fallback para o `QuestionPlayer` da V0.2.
- **Rationale**: Garante que a aba **Questões** entregue o catálogo oficial completo do ENEM sem quebrar os demais fluxos pedagógicos da interface V0.2 (`Inicio`, `Percurso`, `Habilidade`, `Sessao`, `Simulados`).
- **Alternatives considered**:
  - *Remover suporte a IDs locais em `Resolver.tsx`*: rejeitado porque quebraria links internos existentes nas páginas da V0.2.
