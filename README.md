# NEXO — protótipo V0.2

Preparação adaptativa para o ENEM. **O currículo é completo, mas o percurso é individual.**

## Rodar

```bash
npm install
npm run dev            # http://localhost:5173
npm test
npm run build
```

IA é opcional. Sem provedor, as interações são simuladas por regras e identificadas. Com provedor, a chave fica só no servidor:

```bash
ANTHROPIC_API_KEY=... npm run server   # porta 8787
```

## Como experimentar

- **Perfil vazio:** diagnóstico progressivo, sem prova inicial obrigatória.
- **Marina ou Caio:** históricos fictícios, identificados em todas as telas.

## Arquitetura

| Camada | Pasta | Papel |
|---|---|---|
| Dados | `src/data` | currículo, matriz do Inep, incidência, questões, aulas, rubricas |
| Motor pedagógico | `src/engine` | domínio, dificuldades, recomendações, revisões, explicação; funções puras, sem IA |
| Estado | `src/store` | fatos no navegador (`nexo-v3`); derivações em `selectors.ts` |
| IA | `src/services`, `server` | interpretação e comunicação; nunca altera indicadores |
| Interface | `src/pages`, `src/components` | React e Tailwind |

Regras detalhadas: [docs/REGRAS_DE_NEGOCIO.md](docs/REGRAS_DE_NEGOCIO.md).

## Limites atuais

- Questões, aulas e rubricas são originais e **ainda sem revisão pedagógica humana**.
- O diagnóstico prevê 180 questões; o banco atual tem menos e a tela informa quantas.
- Parâmetros experimentais, sem validação científica.
- Incidência: Dossiê ENEM 2025 (Aprova Total), não oficial. Matriz: texto do Inep.
- Os materiais de referência (`referencies/`) não fazem parte do repositório.
