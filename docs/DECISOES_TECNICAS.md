# Registro de decisões técnicas (ADRs)

A seção 15 e o Anexo A do Documento Mestre são a referência. Este registro recebe decisões técnicas complementares, não substitui requisitos aprovados. Cada ADR: ID, data, status (proposta/aceita/rejeitada/substituída), subtópicos, contexto, decisão, impacto, testes e aprovação necessária. Itens marcados **[sócios]** afetam pedagogia, preço, direitos ou escopo e exigem aprovação antes de produção.

## ADR-001 — Arquitetura de referência
Aceita conceitualmente na etapa 15: monólito modular TypeScript/Next.js e PostgreSQL/Supabase; Python para ETL, R2, Workers, IA e Asaas desacoplados. Implementada em `src/` (módulos puros em `src/modules`, serviços em `src/server/services`, integrações em `src/integrations`).

## ADR-002 — Versões (2026-11-25, aceita)
15.1. Next.js 16.4.6, React 19.3.1, TypeScript 5.9.3 (TS 7 nativo ainda não suportado pelo verificador do Next), Tailwind 4.3.5, Zod 4.6.7, ts-fsrs 6.0.1 (API `DefaultScheduler`, FSRS-7), Vitest 5.1.2, Playwright 1.65.1, PGlite 0.6.0 + pgvector/pgTAP. Lockfile versionado; versões exatas no package.json.

## ADR-003 — Banco local sem Docker: PGlite (2026-11-25, aceita)
15.3/15.12. A máquina de desenvolvimento não tem Docker nem PostgreSQL. PGlite (Postgres 17 em WASM) executa as MESMAS migrações do Supabase, com papéis `anon/authenticated/service_role`, RLS, pgvector, pgcrypto e pgTAP. Um *shim* (`supabase/local/00_supabase_shim.sql`) cria `auth.users`, `auth.uid()`, `auth.jwt()` com a semântica do Supabase. Produção usa `postgres.js` (`NEXO_DB_DRIVER=postgres`). `env()` proíbe PGlite em produção. Testes: `tests/db/*`.

## ADR-004 — Acesso a dados e RLS em profundidade (aceita)
13.3/15.3. O cliente nunca acessa o banco diretamente. Leituras próprias usam `asUser()` (transação com `SET LOCAL ROLE authenticated` + claims JWT → RLS ativa); escritas de integridade (evidências, XP, franquias, pagamentos, admin) usam `asService()` somente após autorização na aplicação. Conteúdo e gabaritos não têm GRANT para `authenticated` (anti-extração e correção pós-envio). Verificado em `supabase/tests/001_rls.sql`.

## ADR-005 — Currículo-base a partir da Matriz oficial (proposta) **[sócios]**
3.1/3.3/3.10. O currículo v0 foi gerado mecanicamente da Matriz de Referência do Inep (`scripts/curriculum/build_matriz_v0.py`): 14 disciplinas/eixos, 407 subtópicos, 1 habilidade interna por subtópico, 120 habilidades oficiais H1–H30. Status `draft`. Humanas preserva os eixos temáticos da matriz. A relevância passou a vir do ADR-018 (2026-11-26). Refinar subtópicos/habilidades internas e validar antes do lançamento.

## ADR-006 — Autenticação (aceita, Supabase pendente de teste real)
13.3. Interface `AuthProvider` com dois provedores: Supabase Auth via REST (produção) e provedor local (somente dev/teste: scrypt, tokens de verificação em `auth.local_tokens`, caixa de e-mails de desenvolvimento, TOTP RFC 6238). Sessão em cookie httpOnly assinado (HMAC-SHA256), SameSite=Lax, Secure fora de localhost; verificação de origem em mutações. Admin exige `aal2` (MFA) na aplicação e em `is_admin()`.

## ADR-007 — Equações de domínio e tratamento de ausência (proposta experimental) **[sócios]**
2.9/8.2–8.6/15.6. (a) Dimensões/faixas sem evidência são nulas e seus pesos redistribuídos; (b) peso temporal calculado relativo à evidência MAIS RECENTE da habilidade (inatividade nunca reduz domínio); (c) repetição vale 0,25 e assistência 0,5; (d) provisório = mínimos por relevância (ajustados à disponibilidade de itens) + D ≥ 70; consolidado = provisório + D ≥ 85 + evidência de retenção + compreensão ou transferência. Parâmetros em `engine_parameter_sets` (versão `engine-0.1.0`). Testes: `tests/unit/mastery.test.ts`. Calibrar no piloto.

## ADR-008 — Derivação de evidências (proposta experimental) **[sócios]**
2.12/2.14/A.3.1. Somente a habilidade principal recebe evidência (3.9). Primeira exposição = independente; transferência = item inédito em habilidade com evidência de dia anterior; retenção = evidência ≥ 7 dias após a anterior; leitura de aula não gera evidência; CPE = compreensão assistida; flashcard = só retenção (após intervalo). Mesmo pipeline em todos os modos.

## ADR-009 — Dificuldade por tercis de NU_PARAM_B (proposta) **[sócios]**
3.7. Fácil/média/difícil por tercis do parâmetro oficial b por área no acervo importado; sem parâmetro → classificação pedagógica provisória. Nenhuma estimativa de nota TRI.

## ADR-010 — Fuso e contagem de franquias (proposta) **[sócios]**
11.4/15.9/A.2. Virada de dia/mês em America/Sao_Paulo. Questões: conta questão distinta servida por dia fora de sessões e simulados (reabrir no mesmo dia não conta). Sessões: no início. Simulados: no início (oficial/personalizado). Diagnóstico: não conta. Configuração `app_settings.quota_counting` (status `proposal`).

## ADR-011 — Franquias transacionais (aceita)
6.10/15.9/A.3.6. `reserve_quota()` com `pg_advisory_xact_lock` e idempotência por requisição; reserva confirmada antes da chamada de IA; confirmação apenas com resultado válido; liberação em transação separada em qualquer falha (`withQuotaRollback`). Reservas órfãs expiram em 15 min. Teste de regressão: falha de IA não consome franquia.

## ADR-012 — Motor de prioridade e categorias (proposta experimental) **[sócios]**
4.3/15.5. Pesos 30/25/20/15/10 normalizados; prior 0,5 para dificuldade sem evidência; relevância desconhecida = 0,5; proximidade multiplica o peso de revisão (×1,25/1,5/1,75 em 90/30/7 dias) e renormaliza; reta final ×1,15 por área (LC/CH antes do 1º dia; MT/CN entre os dias). Árvore de decisão de categoria/foco cobre os casos de 15.12. Subtópicos sem acervo publicado não entram na fila. Desempate: prioridade, relevância, código.

## ADR-013 — Simulado personalizado (proposta)
5.9. Distribuição de dificuldade 30/40/30 por área, inéditas primeiro; duração proporcional ao formato oficial do 2º dia (≈3,3 min/questão); cronometrado oficial sem pausa; modo sem cronômetro com pausa.

## ADR-014 — Redação digital (proposta) **[sócios]**
6.1/6.8. Estimativa de linhas para texto digitado: 70 caracteres/linha; mínimo 8 (cartilha: até 7 linhas = texto insuficiente) verificado antes de consumir franquia; máximo 30. Citações devem existir literalmente no texto (normalizado); resposta inválida → 1 nova tentativa → falha sem custo de franquia. Nome do estudante removido com correspondência sensível a maiúsculas.

## ADR-015 — Pagamentos Asaas (aceita, sem teste em sandbox)
11.8/13.7/15.9. Cliente + assinatura (`billingType UNDEFINED`) + fatura hospedada (`invoiceUrl`); CPF enviado ao Asaas e não armazenado. Webhook autenticado por `asaas-access-token`, persistido com `unique(provider,event_id)`, processado com savepoint. Estado da assinatura DERIVADO do conjunto de pagamentos (robusto a eventos repetidos/fora de ordem). Checkout bloqueado enquanto `price_status <> 'approved'`.

## ADR-016 — IA (aceita; modelos pendentes) **[sócios]**
7.2/7.8/15.8. Responses API com `json_schema` estrito e `store:false`; validação Zod + semântica; registro por tentativa (modelo, prompt, tokens, custo, latência, status). Nenhum modelo pré-aprovado: aprovação manual com preço verificado; troca automática proibida. Chamadas pagas exigem `OPENAI_ALLOW_PAID_CALLS=true`. Dublê determinístico somente com `NEXO_ENV=test` e `NEXO_AI_FAKE=1` (E2E).

## ADR-017 — Componentes de UI no padrão shadcn sem CLI (aceita)
15.1/10.3. Componentes próprios (Tailwind + Lucide) no estilo shadcn/ui, sem dependências Radix (disco limitado, controle de acessibilidade com `<dialog>` nativo). Markdown renderizado sem HTML do conteúdo (anti-XSS).

## ADR-018 — Relevância curricular de referência v1 (2026-11-26, proposta experimental) **[sócios]**
3.4/3.5. Leitura das fontes privadas autorizada pelo usuário em 2026-11-26. **Fontes usadas:** Checklist 160+ (2024) — níveis por cor do próprio material (p.1: azul = pouco recorrente/base, amarelo = média, vermelho = alta), extraídos do PDF por cor do texto/realce; Dossiê ENEM 2025 (Aprova Total) — contagens por tema e subtema de todas as aplicações regulares desde 2016 (os dossiês 2023/2024 são cumulativos e foram usados só para conferir estabilidade; não somados). **Não usados:** "Monstro.pdf" e sua cópia de nome longo (cronograma de terceiros com proibição expressa de uso e marca de redistribuição por terceiro — direitos duvidosos); 250 Macetes e Hackeando (princípios já sintetizados; sem dados de relevância). **Regra:** C = média arredondada dos níveis dos itens do Checklist mapeados manualmente para cada subtópico (baixa 1, média 2, alta 3; ≥ 2,5 alta, ≥ 1,5 média); D = faixa da participação somada no dossiê dentro da disciplina (≥ 8% alta, ≥ 3% média); **nível = max(C, D)** — união que preserva "base importante por conexões" (3.4) e alta incidência; piso média para itens de Sociologia/Filosofia (p.25 do Checklist: "todos importantes", sem cor); sem nenhuma base → `unknown` (Educação Física inteira, polinômios, simetrias, metais etc.). **Resultado:** 227 alta, 96 média, 42 baixa, 42 unknown; 68 divergências de dois níveis entre as fontes, listadas em `supabase/seed/relevance_v1.json` (`divergences`) para revisão. A distribuição pende para "alta" porque o próprio Checklist marca ~metade dos itens em vermelho; o max() elevou só 22 subtópicos (todos com participação alta no dossiê). **Direitos/privacidade:** o repositório guarda apenas o nível por subtópico, rótulos curtos de conteúdo e páginas; as cores item a item ficam em cache ignorado pelo Git (`data/private/relevance/`); marcas de licença e dados pessoais presentes nos PDFs não são reproduzidos (teste automatizado). Fontes cadastradas como `private_reference`/`restricted`. **Aplicação:** `loadRelevance()` em `loadReferenceData` (idempotente; nunca sobrescreve decisão manual registrada no painel). **Testes:** `scripts/curriculum/test_relevance_v1.py` (11), `tests/db/relevance.test.ts` (3). **Decisão dos sócios:** validar a regra, limiares, mapeamento e divergências; decidir se a proporção de "alta" é desejável.

## ADR-019 — Benchmark do corretor de redação e trava de lançamento (2026-11-26, proposta) **[sócios]**
6.1/6.3/15.x ("não prometer precisão sem benchmark"). **Critério central:** o mesmo do Inep entre dois avaliadores (Cartilha do Participante 2026, p.8): discrepância quando o total difere > 100 ou uma competência > 80. A nota humana final por competência pode vir em passos de 20 (média de dois avaliadores, p.9); a da IA, em passos de 40. **Métricas:** taxa sem discrepância, erro absoluto médio/RMSE/viés no total e por competência, concordância ±20/±40, correlação, falhas/saídas inválidas, distribuição por faixa (<600, 600–799, ≥800). **Limiares propostos (experimentais):** ≥ 30 redações, ≥ 3 faixas com ≥ 5 redações cada, ≥ 90% sem discrepância, erro médio no total ≤ 60, |viés| ≤ 40 por competência, falhas ≤ 5%. **Execução:** `POST /api/jobs/essay-benchmark` (CRON_SECRET) lê JSONL somente de `data/private/essay-benchmark/` no servidor; usa o MESMO prompt (`buildEssayUserPrompt`), RAG, modelo aprovado e validação da produção; chamadas pagas exigem `OPENAI_ALLOW_PAID_CALLS=true` **e** `confirmPaidCalls=true` por execução; o banco guarda só métricas agregadas e hash do conjunto (`essay_benchmark_runs`, sem textos). **Trava:** em produção, `submitEssay` responde 503 sem consumir franquia até existir execução que atingiu os critérios, com o modelo aprovado e o prompt ativo vigentes, aprovada por administrador em /admin/ia (execuções com dublê de teste nunca liberam). **Conjunto local:** 8 redações da cartilha UFES 2026 (notas oficiais 900–980, nomes removidos) extraídas por `scripts/essay-benchmark/extract_cartilha.py` — insuficiente para aprovação (uma faixa só); faltam redações intermediárias e baixas com notas conhecidas. Redação a Mil 6.0 não é usada (direitos restritos ao próprio documento). **Pendente de autorização:** enviar as redações privadas ao fornecedor de IA (CLAUDE.md: fontes privadas não vão a APIs sem autorização) e custear as chamadas. **Testes:** `tests/unit/essay-benchmark.test.ts`, `tests/db/essay-benchmark.test.ts`, `scripts/essay-benchmark/test_extract_cartilha.py`.

## ADR-020 — Verificação de e-mail desligada provisoriamente (2026-11-26, aceita pelo usuário; revisão antes do lançamento) **[sócios]**
13.3. A pedido do usuário ("pode tirar isso, por enquanto, só criar conta mesmo"), `NEXO_EMAIL_VERIFICATION` (padrão `off`) faz o cadastro criar a conta já autenticada e seguir para o onboarding, sem link de confirmação. Contas antigas não confirmadas passam a entrar. O e-mail **não** é marcado como confirmado (`email_confirmed_at` continua nulo), para permitir reativar a verificação depois sem falsear dados. Com `required`, volta o fluxo anterior (link por e-mail; login bloqueado até confirmar). No Supabase, o comportamento real depende também da opção "Confirm email" do projeto: se o GoTrue devolver sessão no cadastro, a aplicação já entra. **Riscos a reavaliar antes do lançamento:** contas com e-mail digitado errado ou de terceiros; recuperação de senha e contato com responsável (menores) dependem de e-mail válido; o envio real de e-mails ainda não existe (no modo local vai para `.data/dev-mail.log`/`/api/dev/mailbox`). **Testes:** `tests/db/auth-email-verification.test.ts` (os dois modos e contas antigas) e E2E de cadastro direto.

## Pendências obrigatórias (não decidir silenciosamente em produção)
- Validação pedagógica do currículo v0, da relevância v1 (ADR-018) e das conexões/pré-requisitos (ADR-005).
- Benchmark de redação representativo e aprovado antes de liberar correções em produção (ADR-019).
- Equações e parâmetros experimentais (ADR-007/008/012) — calibrar no piloto.
- Contagem de franquias, fuso, aulas gratuitas, prorrata e regras de upgrade (ADR-010/015).
- IDs, preços e benchmark dos modelos de IA (ADR-016); embeddings do RAG.
- Prova de conceito Next.js em Cloudflare Workers (OpenNext/vinext) com postgres.js/Hyperdrive; PGlite não roda em Workers — produção usa Postgres gerenciado.
- Envio de e-mail transacional (consentimento do responsável) — fornecedor a contratar.
- Proteção de menores, termos, privacidade, direitos autorais e tributação — revisão jurídica.
