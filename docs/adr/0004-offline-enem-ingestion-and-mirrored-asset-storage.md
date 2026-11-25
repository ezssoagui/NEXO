# ADR-0004: Pipeline Offline de Ingestão ENEM (2009+) e Espelhamento de Imagens

- **Status**: Aceita
- **Data**: 2026-11-23
- **Escopo**: V1 Comercial (`001-nexo-commercial-v1-enem`)

## Contexto

O banco de questões do NEXO V1 precisa conter questões oficiais do ENEM (2009+) enriquecidas com a habilidade oficial da Matriz de Referência (`H1–H30`) e parâmetros oficiais da TRI (`a`, `b`, `c`) — sem pré-enriquecimento manual por alternativa — para alimentar filtros, simulados estilo TRI e a seleção automática de outra questão oficial inédita na comprovação pós-erro (`FR-025`). APIs públicas comunitárias como a `enem.dev` possuem limite de taxa (1 req/s), não trazem os códigos `CO_HABILIDADE` e parâmetros TRI dos Microdados do INEP e não devem ser dependência em tempo real de um produto pago.

## Decisão

1. Criar uma ferramenta CLI offline idempotente (`scripts/ingest-enem.ts`) responsável por:
   - Ler provas oficiais do ENEM (a partir de 2009) via dump local ou coleta controlada respeitando rate limit da `enem.dev`;
   - Cruzar cada questão com o arquivo oficial `ITENS_PROVA_{ANO}.csv` dos Microdados do INEP (usando cor do caderno de referência + `CO_POSICAO` + idioma estrangeiro quando aplicável) para associar `CO_ITEM`, `CO_HABILIDADE` (`H01–H30`) e parâmetros TRI (`NU_PARAM_A`, `NU_PARAM_B`, `NU_PARAM_C`);
   - Identificar e marcar questões oficialmente anuladas pelo INEP (`status = 'annulled'`) para exclusão automática de diagnósticos, simulados e comprovações;
   - Persistir de forma idempotente nas tabelas `enem_skills` e `enem_questions`.
2. Espelhar todas as imagens das questões e alternativas através de uma interface `AssetStorage` (`server/gateways/assets.ts`), usando deduplicação por hash SHA-256:
   - **V1 local**: armazenamento em `server/data/assets/` servido pela rota `/api/assets/:key`;
   - **Produção futura**: adaptador para **Object Storage / CDN próprio (Cloudflare R2 ou Amazon S3)** sem alterar referências no banco nem no front-end.

## Alternativas Consideradas

- **Consumir `api.enem.dev` em tempo real no runtime da aplicação**: inviável para múltiplos assinantes (rate limit 1 req/s), sem garantia de SLA e sem acesso aos metadados H1–H30/TRI do INEP.
- **Referenciar URLs externas de imagem no V1**: risco de quebra de imagens, lentidão e dependência de terceiros na hora da prova/simulado.

## Consequências

- **Positivas**: latência baixa e previsível no banco de questões, zero dependência externa durante o estudo, suporte nativo a comprovação oficial por `H1–H30`/TRI e migração limpa das imagens para R2/S3 em produção.
- **Negativas / Trade-offs**: exige executar o script de ingestão uma vez por edição do ENEM (e sempre que o INEP liberar novos microdados) e manter espaço em disco/object storage para os arquivos de imagem das provas.
