# Quickstart & Validation Guide: Catálogo Oficial do ENEM (Todos os Anos), Paginação e Imagens

**Feature**: `002-enem-catalog-all-years`  
**Date**: 2026-11-24

## Pré-requisitos

- Node.js 22+ (`node:sqlite` nativo)
- Dependências instaladas (`npm install`)

## 1. Validar Testes Automatizados e Build

```bash
npm run build
npm test
```

**Resultado esperado**:
- Build de produção (`tsc -b && vite build`) conclui sem erros.
- Todos os testes existentes e novos passam (incluindo ingestão multi-ano + reescrita/espelhamento de imagens Markdown, paginação de 25 itens com normalização de página, endpoint `/api/enem/years` e renderização/deduplicação de imagens).

## 2. Popular o Banco Oficial do ENEM (Todos os Anos ou Intervalo)

Para importar **todos os anos disponíveis** na fonte oficial:
```bash
npm run ingest:enem
```

Para um teste rápido com um intervalo menor (ex.: 2022–2023):
```bash
npm run ingest:enem -- --years 2022-2023
```

**Resultado esperado**:
- Log por ano exibindo quantidade importada, anuladas e imagens espelhadas em `server/data/assets/`.
- Reexecutar o comando mantém o mesmo total sem duplicar registros.

## 3. Validação Ponta a Ponta na Interface

1. Inicie o backend e o front-end em terminais separados:
   ```bash
   npm run server
   npm run dev
   ```
2. Acesse `/questoes` no navegador (ative a sessão dev local se estiver sem login no ambiente de desenvolvimento).
3. **Catálogo paginado (25 por página)**:
   - Verifique que exatamente **25 questões** são listadas na página 1, com contador `Exibindo 1–25 de <total>`.
   - Navegue para a página 2, página 3 e última página usando os botões "Anterior", "Próxima" e números de página.
   - Aplique um filtro (ex.: Ano `2023` ou Área `CN`) e confirme o retorno automático para a página 1 e atualização da URL.
4. **Exibição e ampliação de imagens**:
   - Localize uma questão com o indicador "Com imagem" e abra-a.
   - Confirme que todas as imagens do enunciado (inclusive as que vieram em Markdown) e das alternativas são exibidas sem código bruto e sem duplicação.
   - Clique na imagem para abrir a visualização ampliada (lightbox) e feche com `Esc` ou clique fora.
   - Volte para o catálogo e confirme que a página e os filtros anteriores foram preservados.
