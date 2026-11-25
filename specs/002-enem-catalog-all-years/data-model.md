# Data Model: Catálogo Oficial do ENEM (Todos os Anos), Paginação e Imagens

**Feature**: `002-enem-catalog-all-years`  
**Date**: 2026-11-24

## Entidades Persistidas (SQLite — `server/db.ts`)

A tabela `enem_questions` já existente atende à estrutura principal sem quebra de compatibilidade. Esta feature adiciona um índice otimizado para paginação por ano/ordem e amplia o enriquecimento de dados armazenados.

### `enem_questions` (existente, com índice adicional)

| Campo | Tipo | Regras / Notas |
|-------|------|----------------|
| `id` | `TEXT PK` | `enem-{year}-{area}-{index3}` ou `enem-{year}-{area}-{index3}-{language}` (garante unicidade de Inglês vs. Espanhol) |
| `year` | `INTEGER NOT NULL` | `>= 2009` |
| `question_index` | `INTEGER NOT NULL` | Posição oficial na prova (1–180) |
| `booklet_color` | `TEXT NOT NULL` | Normalizado sem acentos (ex.: `AZUL`) |
| `area` | `TEXT NOT NULL` | `LC \| CH \| CN \| MT` |
| `discipline` | `TEXT NOT NULL` | Disciplina de origem |
| `language` | `TEXT NULL` | `'ingles' \| 'espanhol' \| null` |
| `skill_id` | `TEXT NULL FK` | Referência a `enem_skills(id)` (ex.: `MT-H17`) |
| `inep_item_code` | `INTEGER NULL` | `CO_ITEM` dos Microdados INEP |
| `tri_a`, `tri_b`, `tri_c` | `REAL NULL` | Parâmetros TRI oficiais quando disponíveis |
| `context_md` | `TEXT NOT NULL` | Texto do enunciado com referências de imagem `![alt](/api/assets/<sha256>.<ext>)` já reescritas para o storage interno |
| `alternatives_intro` | `TEXT NOT NULL` | Comando da questão antes das alternativas |
| `alternatives_json` | `TEXT NOT NULL` | Array JSON de `{ letter, text, assetUrl }` com `assetUrl` espelhado (`/api/assets/...`) |
| `correct_alternative` | `TEXT NOT NULL` | `A \| B \| C \| D \| E \| ANULADA` |
| `assets_json` | `TEXT NOT NULL` | Array JSON deduplicado de URLs internas `/api/assets/<sha256>.<ext>` |
| `status` | `TEXT NOT NULL` | `active \| annulled \| under_review` |
| `source` | `TEXT NOT NULL` | `official_enem \| ai_generated_fallback` |

**Novo índice recomendado em `server/db.ts`**:
```sql
CREATE INDEX IF NOT EXISTS idx_enem_q_catalog_order
  ON enem_questions(status, year DESC, question_index ASC);
```

## Projeções / DTOs de Leitura

### `OfficialEnemQuestionDTO` (retornado pela API)
Mantém todos os campos de `OfficialEnemQuestionRow` e acrescenta:
- `hasImages: boolean` — verdadeiro quando `assets.length > 0`, ou alguma alternativa possui `assetUrl`, ou `contextMd` contém imagem Markdown `!\[...\]\(...\)`.

### `EnemCatalogPageDTO`
```ts
export interface EnemCatalogPageDTO {
  items: OfficialEnemQuestionDTO[]; // máximo 25 itens
  total: number;                    // total de questões que atendem aos filtros
  page: number;                     // página atual (1-based, normalizada)
  pageSize: number;                 // 25 no catálogo
  totalPages: number;               // Math.max(1, Math.ceil(total / pageSize))
}
```

### `EnemYearsSummaryDTO`
```ts
export interface EnemYearsSummaryDTO {
  years: { year: number; count: number }[]; // ordenado por year DESC
  total: number;                            // total de questões ativas no acervo
}
```

### `IngestYearReport` (saída operacional do CLI)
```ts
export interface IngestYearReport {
  year: number;
  imported: number;
  enrichedWithInep: number;
  annulled: number;
  mirroredAssets: number;
  error?: string;
}
```

## Regras de Validação e Deduplicação

1. **Normalização de paginação**:
   - `pageSize`: padrão `25`, mínimo `1`, máximo `25` na rota de catálogo (ou clamp `[1, 100]` no repositório, com front-end enviando `limit=25`).
   - `page`: inteiro `>= 1`; se `page > totalPages` (quando `total > 0`), normalizar para `totalPages`.
2. **Deduplicação de imagens**:
   - Na ingestão: `assets` contém URLs únicas espelhadas; `contextMd` tem toda imagem Markdown reescrita para a mesma URL espelhada.
   - Na renderização: `extraAssets = question.assets.filter(url => !inlineImageUrlsInContext.has(url))`, impedindo qualquer duplicação visual.
