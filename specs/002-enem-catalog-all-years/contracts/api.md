# API & CLI Contracts: Catálogo Oficial do ENEM (Todos os Anos), Paginação e Imagens

**Feature**: `002-enem-catalog-all-years`  
**Date**: 2026-11-24

## 1. HTTP API (`server/routes/enem.ts` + `server/index.ts`)

Todas as rotas pedagógicas abaixo respeitam o controle de acesso existente (`requirePaidStudent`).

### `GET /api/enem/years`

Retorna os anos efetivamente presentes no banco local (apenas questões com `status = 'active'`) ordenados do mais recente para o mais antigo.

**Response `200 OK`**:
```json
{
  "years": [
    { "year": 2023, "count": 178 },
    { "year": 2022, "count": 180 },
    { "year": 2009, "count": 175 }
  ],
  "total": 2680
}
```

### `GET /api/enem/questions`

Lista questões oficiais de forma paginada.

**Query Parameters**:
- `page` *(opcional, número 1-based, padrão `1`)* — se informado, calcula `offset = (page - 1) * limit` e normaliza para `[1, totalPages]`.
- `offset` *(opcional, retrocompatível)* — usado caso `page` não seja fornecido.
- `limit` *(opcional, padrão `25`, clamp `[1, 100]`; o catálogo do front-end sempre envia `25`)*.
- `area` *(opcional: `LC | CH | CN | MT`)*.
- `discipline` *(opcional)*.
- `skillId` *(opcional, ex.: `MT-H17`)*.
- `year` *(opcional, inteiro `>= 2009`)*.
- `difficultyBand` *(opcional: `facil | media | dificil`)*.
- `status` *(opcional: `unanswered | wrong | fragile`)*.
- `includeAnnulled` *(opcional: `true | false`, padrão `false`)*.

**Response `200 OK`**:
```json
{
  "items": [
    {
      "id": "enem-2023-CN-091",
      "year": 2023,
      "questionIndex": 91,
      "bookletColor": "AZUL",
      "area": "CN",
      "discipline": "ciencias-natureza",
      "language": null,
      "skillId": "CN-H03",
      "triB": 0.42,
      "contextMd": "Observe o gráfico...\n\n![Gráfico](/api/assets/abc...def.png)",
      "alternativesIntro": "Com base no gráfico, conclui-se que:",
      "alternatives": [
        { "letter": "A", "text": "...", "assetUrl": null }
      ],
      "correctAlternative": "C",
      "assets": ["/api/assets/abc...def.png"],
      "hasImages": true,
      "status": "active",
      "source": "official_enem"
    }
  ],
  "total": 2680,
  "page": 1,
  "pageSize": 25,
  "totalPages": 108
}
```

### `GET /api/enem/questions/:id`

Retorna uma única questão oficial com todas as referências de imagens internas (`contextMd`, `assets`, `alternatives[].assetUrl`, `hasImages`).

### `GET /api/assets/:key` *(existente)*

Serve arquivos de imagem espelhados em `server/data/assets/` com `Content-Type` apropriado e `Cache-Control: public, max-age=31536000, immutable`.

---

## 2. CLI de Ingestão (`scripts/ingest-enem.ts`)

### Execução padrão (todos os anos disponíveis)
```bash
npm run ingest:enem
```
- Consulta `GET https://api.enem.dev/v1/exams` para descobrir todos os anos disponíveis (fallback `2009..anoAtual`).
- Percorre cada ano sequencialmente, respeitando throttle (`>= 1100ms`) e backoff em `429`/`5xx`.
- Espelha todas as imagens de `files[]`, Markdown em `context` e `alternatives[].file` no `LocalAssetStorage`.
- Persiste no SQLite de forma idempotente ano a ano.

### Flags opcionais
- `--years all` *(padrão)* ou `--years 2009-2023` ou `--years 2022` (um único ano).
- `--source-dir <dir>` — importa dumps JSON locais (modo offline).
- `--inep-dir <dir>` — cruza com `ITENS_PROVA_{ANO}.csv` dos Microdados INEP.
- `--assets-dir <dir>` — diretório de destino das imagens espelhadas.

---

## 3. Contrato de URL da Aba Questões (Front-end)

Rota `/questoes` sincroniza estado via query string:
- `page` (1-based; omitido quando `1`)
- `year`, `area`, `skill`, `tri`, `status`

Ao abrir uma questão a partir da página `N`, o link preserva o retorno (`state.from` ou query) para que "Voltar ao catálogo" restaure a página `N` e todos os filtros ativos.
