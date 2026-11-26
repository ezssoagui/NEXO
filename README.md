# NEXO — preparação adaptativa para o ENEM

Plataforma web (monólito modular Next.js + PostgreSQL) com motor adaptativo determinístico, banco de questões oficiais, sessões, revisões (FSRS), redação por competências, simulados, gamificação, planos e painel administrativo. Especificação: `docs/NEXO_DOCUMENTO_MESTRE.md`. Estado real: `docs/ESTADO_DO_PROJETO.md`. Rastreabilidade: `docs/MATRIZ_DE_RASTREABILIDADE.md`.

> **Situação:** software implementado e testado localmente. **Não está pronto para lançamento**: faltam acervo oficial importado e validado, conteúdo pedagógico validado, credenciais reais (Supabase, OpenAI, Asaas, e-mail, R2), preços aprovados, revisão jurídica e piloto. Os dados do ambiente de desenvolvimento são **sintéticos** e identificados como tal.

## Requisitos
- Node.js ≥ 22.12 (testado com 26), npm 11
- Python 3.11+ (pipeline de acervo e currículo; `pip install pypdf`)
- Google Chrome instalado (testes E2E usam o Chrome do sistema)
- Não é necessário Docker: o desenvolvimento usa **PGlite** (Postgres embutido) com as mesmas migrações do Supabase.

## Primeiros passos (Windows/PowerShell)
```powershell
npm ci
Copy-Item .env.example .env.local    # ajuste NEXO_SESSION_SECRET (veja o comentário no arquivo)
npm run dev                          # http://localhost:3000
```
Na primeira requisição, o banco local (`.data/pglite`) recebe as migrações, o currículo-base oficial (Matriz do Inep), a rubrica oficial da redação e, com `NEXO_SEED_SYNTHETIC=1`, conteúdo **sintético** de teste.

Contas de desenvolvimento (somente provedor local, nunca em produção):
- estudante: `estudante@nexo.local` / `nexo-estudante-123`
- administrador: `admin@nexo.local` / `nexo-admin-dev-123` — o painel exige configurar MFA (TOTP) no primeiro acesso.

E-mails de verificação/recuperação no modo local vão para `.data/dev-mail.log` e `GET /api/dev/mailbox`.

## Comandos
| Comando | Descrição |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | desenvolvimento, build e servidor de produção |
| `npm run typecheck` · `npm run lint` | TypeScript estrito · ESLint (regras do Next/React Compiler) |
| `npm test` | Vitest: unidade, integração com PGlite e pgTAP (RLS) |
| `npm run test:py` | testes do pipeline de acervo (Python) |
| `npm run test:e2e` | Playwright (requer `npm run build` antes) |
| `npm run check` | typecheck + lint + testes TS + testes Python |
| `npm run db:migrate` | aplica migrações em `DATABASE_URL` (ou PGlite local) |
| `npm run curriculum:build` | regenera o currículo-base a partir da Matriz oficial |
| `npm run relevance:build` | regenera `supabase/seed/relevance_v1.json` a partir do cache privado; para reextrair: `python scripts/curriculum/build_relevance_v1.py --checklist-pdf "referencias/privadas/Checklist+160++2024.pdf"` (requer `pip install pdfplumber`) |

## Estrutura
```
src/app/            páginas (Início, Estudar, Questões, Simulados, Redação, Desempenho, Perfil, Configurações, Admin) e /api
src/modules/        regras puras: mastery, adaptive-engine, reviews, flashcards (ts-fsrs), essays, quotas, subscriptions, twins, simulations, ai
src/server/         auth (local/Supabase), db (PGlite/Postgres, RLS), http (rotas), services (casos de uso)
src/integrations/   openai.ts (Responses API), asaas.ts (v3)
supabase/           migrations, tests (pgTAP), seed (currículo oficial, rubrica Inep), local (shim de desenvolvimento)
scripts/            import-enem (acervo oficial), curriculum, db, backup, docs
docs/               mestre, specs, ADRs, matriz, estado do projeto
tests/              unit, db, e2e
```

## Produção (resumo — ver `docs/specs/ARQUITETURA.md`)
1. Criar projeto Supabase; aplicar `supabase/migrations` (`supabase db push`); **não** aplicar `supabase/local`.
2. Variáveis: `NEXO_ENV=production`, `NEXO_DB_DRIVER=postgres`, `DATABASE_URL`, `NEXO_AUTH_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXO_SESSION_SECRET`, `CRON_SECRET`, `ASAAS_*`, `OPENAI_*`. O app recusa iniciar com provedor local, PGlite ou seed sintético em produção.
3. Carregar dados de referência: `POST /api/jobs/load-reference` (Bearer `CRON_SECRET`).
4. Agendar jobs: `reconcile` (diário), `twins` (sob orçamento), `backup-check` (diário) e `scripts/backup/backup.sh` (a cada 3 dias) + `restore-test.sh` (mensal).
5. Cadastrar e aprovar modelos de IA com preços verificados (/admin/ia) e definir orçamento; habilitar `OPENAI_ALLOW_PAID_CALLS=true` somente com autorização dos sócios.
6. **Correção de redação fica bloqueada em produção** até um benchmark aprovado (ADR-019): colocar conjuntos JSONL com notas humanas em `data/private/essay-benchmark/` no servidor (ex.: `python scripts/essay-benchmark/extract_cartilha.py ...`), executar `POST /api/jobs/essay-benchmark` com `{"label": "...", "datasets": ["arquivo.jsonl"], "confirmPaidCalls": true}` e, se os critérios forem atingidos, aprovar a execução em /admin/ia. Enviar redações privadas ao fornecedor exige autorização.
7. Hospedagem em Cloudflare Workers depende de prova de conceito do adaptador (pendente); alternativa Node (`next start`).

## Regras inegociáveis
Ver `CLAUDE.md`. Em especial: motor sem IA para decidir rotas; nada de chat/professor IA, OCR, voz, favoritos gerais ou anotações; nenhuma estimativa TRI; banco exclusivamente oficial (gêmeas separadas); falhas não consomem franquia; preços não definidos não são publicados; dados privados e segredos fora do Git.
