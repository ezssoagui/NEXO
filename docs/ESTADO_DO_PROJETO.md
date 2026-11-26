# Estado do projeto — registro vivo

Distingue: **implementado** (código existe), **testado local** (teste automatizado verde nesta máquina), **sandbox** (integração real em ambiente de teste do fornecedor), **validado** (revisão humana/pedagógica/jurídica) e **produção**. Nada está em sandbox, validado ou produção até o momento.

## Sessão 2026-11-25/26 — construção inicial (greenfield)
- **Branch:** `develop` (repositório Git local inicializado; **nenhum commit, push ou deploy** realizado — aguardando revisão dos sócios).
- **Ambiente:** Windows 10, Node 26.13.1, npm 11.20, Python 3.13, sem Docker/PostgreSQL (→ PGlite, ADR-003). Disco com ~4–5 GB livres (E2E usa o Chrome do sistema).

### Fases
| Fase | Estado | Evidência |
|---|---|---|
| 0 — Especificações | Concluída | `docs/MATRIZ_DE_RASTREABILIDADE.md` (166/166 subtópicos mapeados), `docs/specs/*` (14), ADR-002…017 |
| 1 — Fundação | Implementada, testada local | 10 migrações; RLS em todas as tabelas; auth local + Supabase (REST); MFA TOTP; rate limit; CI (`.github/workflows/ci.yml`) |
| 2 — Acervo | Pipeline implementado e testado; **acervo não importado** | `scripts/import-enem` (7 testes); currículo-base da Matriz oficial (407 subtópicos, 120 H); rubrica Inep 2026 |
| 3 — Motor adaptativo | Implementado, testado local | `src/modules/mastery`, `adaptive-engine`, `reviews`; casos 15.12 |
| 4 — Módulos pedagógicos | Implementados, testados local (IA com dublê) | questões/listas/CPE/caderno, aulas, explicação ativa, FSRS, gêmeas, simulados/diagnóstico, redação/reescrita/discursivos |
| 5 — Integrações/comercial/admin | Implementadas **sem credenciais reais** | OpenAI (Responses API), Asaas (v3 + webhook), franquias transacionais, painel admin completo |
| 6 — Frontend | Implementado | 6 seções + perfil/configurações + 9 páginas admin; tema claro/escuro/auto; mapa líquido |
| 7 — Validação | Parcial | testes automatizados verdes (abaixo); faltam carga, restore real, sandbox Asaas, benchmark de redação, auditoria de acessibilidade, revisão jurídica |
| 8 — Piloto | Não iniciado | — |

### Comandos executados e resultados reais (última execução)
| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint .` | exit 0 |
| `npx vitest run` | 6 arquivos, **86 testes passando** (unit 64, migrações 3, serviços 18, pgTAP 1 arquivo/12 asserções) |
| `py -m unittest discover -s scripts/import-enem` | **7 testes OK** |
| `npx next build` | compilado com sucesso (todas as páginas e 87 rotas de API) |
| `npx playwright test` | **8 fluxos E2E passando** (cadastro→sessão→evidência; questão avulsa; flashcards; redação; simulado; admin com MFA; exportação/isolamento; acessibilidade/tema) |
| `node scripts/db/migrate.mjs` (PGlite temporário) | 10 migrações aplicadas; segunda execução: 0 (idempotente) |
| `py scripts/curriculum/build_matriz_v0.py` | 407 subtópicos; 120 habilidades oficiais |
| `py scripts/docs/build_matrix.py` | TESTADO 81 · IMPLEMENTADO 35 · PARCIAL 21 · PENDENTE 11 · DOCUMENTAL 15 · FUTURO 1 · REJEITADO 2 |

### Defeitos encontrados e corrigidos durante a sessão
- Liberação de franquia dentro da transação que falhava era revertida (falha de IA consumia franquia) → liberação em transação separada + `withQuotaRollback` (ADR-011), coberto por teste.
- Remoção de nome por PII apagava palavras comuns → correspondência sensível a maiúsculas.
- Parâmetros SQL sem tipo inferível em filtros do banco; webhook sem savepoint; `<nav>` sem nome acessível; regras do React Compiler (estado em efeitos, componentes criados no render).

## Sessão 2026-11-26 (continuação) — leitura autorizada das fontes privadas
- **Autorização:** o usuário autorizou a leitura de `referencias/privadas` ("pode ler sim"). Leitura feita localmente (texto extraído no diretório temporário da sessão, fora do repositório). Nada foi enviado a APIs externas.
- **Subtópicos:** 3.4, 3.5, 3.10, 6.1, 6.3, 7.5, 15.x (testes quantitativos).
- **Relevância v1 (ADR-018):** níveis do Checklist 160+ extraídos por cor e combinados com o Dossiê ENEM 2025. Os 407 subtópicos ficaram em 227 alta, 96 média, 42 baixa e 42 unknown, com 68 divergências listadas para revisão. Arquivos: `scripts/curriculum/{relevance_v1_data,build_relevance_v1,test_relevance_v1}.py`, `supabase/seed/relevance_v1.json`, `src/server/db/relevance-loader.ts`, aplicação em `loadReferenceData`. O seed sintético deixou de forçar `unknown`. Status: **proposta**, pendente dos sócios.
- **Benchmark de redação e trava (ADR-019):** `src/modules/essays/benchmark.ts` (critério oficial de discrepância do Inep, métricas e limiares propostos), `src/server/services/essay-benchmark.ts`, migração `20261126001100_essay_benchmark.sql` (substitui o esboço não usado e recusa-se a rodar se houver dados), job `POST /api/jobs/essay-benchmark`, aprovação e painel em /admin/ia, `buildEssayUserPrompt`/`ragContext` compartilhados com a produção e trava `essayBenchmarkGate`: em produção, a correção completa fica bloqueada até haver benchmark aprovado. Extrator `scripts/essay-benchmark/extract_cartilha.py` gerou 8 redações UFES anonimizadas (notas oficiais 900–980) em `data/private/` (ignorado pelo Git).
- **Não usados:** Monstro.pdf e a cópia de nome longo (direitos duvidosos) e Redação a Mil (direitos restritos ao próprio documento). Detalhes em `referencias/sinteses/FONTES_PRIVADAS_LEITURA_2026-11-26.md`.
- **Correção colateral:** o campo `description` do `package.json` estava com mojibake e foi reescrito em UTF-8. `test:py` e o CI agora incluem `scripts/curriculum` e `scripts/essay-benchmark`.
- **Comandos e resultados reais:** `npm run check`: tsc exit 0, eslint exit 0, Vitest **9 arquivos, 98 testes passando**, Python **22 OK** (7 do acervo, 11 da relevância, 4 do extrator). `npx next build`: sucesso. `npx playwright test`: **8 passando**. `py scripts/docs/build_matrix.py`: TESTADO 82 · IMPLEMENTADO 35 · PARCIAL 21 · PENDENTE 10 · DOCUMENTAL 15 · FUTURO 1 · REJEITADO 2.
- **Limitações:** o benchmark **não foi executado com IA real**, por falta de credenciais, de autorização para chamadas pagas e de autorização para enviar redações privadas ao fornecedor. O conjunto local cobre uma única faixa e não é suficiente para aprovação pelos critérios.

### Ajuste 2026-11-26 — cadastro sem verificação de e-mail (ADR-020)
- Pedido do usuário: o e-mail de confirmação não chegava. Motivo: no modo local nenhum e-mail real é enviado; a mensagem vai para `.data/dev-mail.log`, e não há provedor de e-mail configurado. Com `NEXO_EMAIL_VERIFICATION=off` (padrão), o cadastro já entra e segue para o onboarding; `required` restaura a confirmação por link.
- Resultados: tsc e eslint exit 0; Vitest **10 arquivos, 101 testes**; `next build` ok; Playwright **8 passando**.

## Pendências e bloqueios (não resolvíveis sem terceiros/decisão)
1. **Acervo oficial integral:** inventariar edições elegíveis, baixar provas/gabaritos/microdados (arquivos grandes; disco limitado nesta máquina), extrair, revisar figuras/fórmulas, classificar e publicar com validação técnica/pedagógica/autoral. O banco atual contém apenas itens **sintéticos**.
2. **Fontes privadas:** lidas com autorização em 2026-11-26 e usadas na relevância v1 e no conjunto local de benchmark. Pendente: (a) validação da relevância v1 pelos sócios; (b) confirmar a origem e os direitos de Monstro.pdf (não usado); (c) autorização específica para enviar redações privadas ao fornecedor de IA.
3. **Conteúdo pedagógico validado:** aulas/microaulas, flashcards, atividades conceituais, referências CPE, temas, repertórios, teoria e exercícios de redação.
4. **Credenciais/contas:** Supabase (Auth/Postgres), OpenAI (modelos e preços confirmados + autorização para chamadas pagas), Asaas sandbox (API key e token de webhook), e-mail transacional (consentimento do responsável), Cloudflare (R2/Workers), repositório GitHub remoto.
5. **Decisões dos sócios:** preços/descontos; regras propostas de contagem de franquias, fuso e aulas gratuitas (ADR-010); parâmetros experimentais do motor (ADR-007/008/012); currículo v0 (ADR-005); datas do ENEM em `app_settings.enem_exam_dates`.
6. **Jurídico:** termos, privacidade, menores (ECA Digital/LGPD art. 14), direitos autorais das provas, tributação/notas fiscais. Os documentos publicados no ambiente local são rascunhos.
7. **Infraestrutura:** prova de conceito Next.js em Workers (OpenNext/vinext) com postgres.js/Hyperdrive; backups executados de fato; testes de carga e de restauração.
8. **Benchmark de redação:** mecanismo, critérios e trava implementados (ADR-019). Faltam um conjunto representativo (≥ 30 redações em ≥ 3 faixas, com notas por competência e direito de uso), a execução com o modelo aprovado e a aprovação em /admin/ia. Até lá, a correção fica bloqueada em produção.

## Próxima tarefa (para retomar)
1. Sócios: revisar ADRs marcados **[sócios]**, em especial ADR-018 (relevância v1 e divergências) e ADR-019 (limiares do benchmark), e decidir sobre preços.
2. Criar repositório remoto, commit inicial em `develop` e abrir PR para revisão.
3. Configurar Supabase de homologação: `supabase db push`, variáveis de produção, `POST /api/jobs/load-reference`, cadastrar admin real com MFA.
4. Executar o pipeline de acervo para uma edição (ex.: 2023 regular) em máquina com espaço, revisar staging e importar via /admin/importacao.
5. Asaas sandbox e modelos de IA aprovados; rodar os testes de integração reais e o benchmark de redação.

## Modelo de atualização por sessão
Data; branch; subtópicos; arquivos; alterações; comandos executados e resultado; testes/limitações; pendências; próxima tarefa; decisões que dependem dos sócios. Distinguir implementado, testado local, sandbox, validado e produção. Não marcar como concluído por existir um componente visual.
