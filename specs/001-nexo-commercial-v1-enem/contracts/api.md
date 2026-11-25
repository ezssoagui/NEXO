# Interface Contracts: NEXO V1 Comercial (HTTP API & CLI)

**Feature**: `001-nexo-commercial-v1-enem`  
**Base URL (dev)**: `http://localhost:8787/api` (proxy via Vite `/api`)  
**Auth Header**: `Authorization: Bearer <token>`

---

## 1. Autenticação, Conta e LGPD (`FR-001` a `FR-005`)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `POST` | `/api/auth/register` | Público | Cria conta com `{ email, password, nickname, isMinor?, lgpdConsent: true, adminCode? }`. Retorna `{ token, user }`. |
| `POST` | `/api/auth/login` | Público | Autentica com `{ email, password }`. Throttling contra força bruta. |
| `POST` | `/api/auth/logout` | Autenticado | Revoga sessão atual. |
| `POST` | `/api/auth/forgot-password` | Público | Gera token de redefinição (em modo local, retorna/loga link de dev; em produção, envia e-mail). |
| `POST` | `/api/auth/reset-password` | Público | Redefine senha com `{ token, newPassword }`. |
| `GET` | `/api/me` | Autenticado | Retorna conta, perfil pedagógico, estado da assinatura e resumo de cotas de IA. |
| `PUT` | `/api/me/profile` | Assinante | Atualiza perfil pedagógico (`targetCourse`, `weeklyHours`, `examYear`, `perceivedDifficulties`, `weeklyGoalQuestions`, `nickname`). |
| `GET` | `/api/me/export` | Autenticado (qualquer status) | Exportação LGPD completa do histórico do estudante em JSON portável. |
| `DELETE` | `/api/me` | Autenticado (qualquer status) | Exclusão definitiva da conta e dados pessoais pedagógicos (LGPD). |

---

## 2. Assinaturas, Pagamentos e Pacotes Avulsos (`FR-006` a `FR-013`)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/api/billing/plans` | Público | Lista `nexo_monthly`, `nexo_annual` e pacotes avulsos (`addon_essay`, `addon_tutor`, `addon_question_gen`) com cotas e preços configurados. |
| `POST` | `/api/billing/checkout` | Autenticado | Inicia assinatura `{ planCode, paymentMethod: 'credit_card' \| 'pix', payer: { name, financialEmail, isGuardian } }`. Delega ao `PaymentGateway`. |
| `POST` | `/api/billing/addons/checkout` | Assinante ativo | Inicia compra de pacote avulso `{ addonCode, paymentMethod }`. |
| `POST` | `/api/billing/cancel` | Assinante | Solicita cancelamento. Se `now <= cdc_deadline_at` (≤ 7 dias da 1ª contratação), dispara reembolso integral CDC (`refunded`); caso contrário, muda para `canceled_until_end` (ou `suspended` se em `grace_period`). |
| `POST` | `/api/billing/upgrade-annual` | Assinante Mensal | Migra plano Mensal ativo para Anual preservando histórico e saldo avulso. |
| `POST` | `/api/billing/webhook` | Gateway / Simulador | Recebe `{ eventId, eventType, eventTs, externalSubscriptionId, payload }`. Processamento **idempotente** por `eventId` e protegido contra eventos fora de ordem por `last_event_ts`. |
| `POST` | `/api/billing/dev/simulate` | Somente dev/local | Dispara eventos controlados no `LocalPaymentGateway` (`confirm_payment`, `fail_renewal`, `advance_grace_expired`, `confirm_addon`, `duplicate_event`) para validação manual e testes. |

**Regra de Gate de Assinatura (Middleware)**:
- Rotas pedagógicas retornam `402 Payment Required` com `{ error: 'subscription_required', status: '<status>', canReactivate: true }` se a assinatura não estiver em `active | canceled_until_end | grace_period`.
- Rotas de `/api/me*` e `/api/billing*` permanecem sempre acessíveis.

---

## 3. Banco Oficial ENEM, Resolução, Evolução, Flashcards e Simulados (`FR-018` a `FR-037`)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/api/assets/:key` | Público / Assinante | Serve imagens espelhadas das provas oficiais ENEM a partir do `AssetStorage` local (em produção, redireciona ou usa URL CDN R2/S3). |
| `GET` | `/api/enem/skills` | Assinante | Lista as 120 habilidades oficiais do ENEM (`LC`, `CH`, `CN`, `MT` × `H01–H30`). |
| `GET` | `/api/enem/questions` | Assinante | Filtra questões oficiais por `area`, `discipline`, `skillId`, `year`, `difficultyBand` (derivada de `tri_b`), `status` (`unanswered`, `wrong`, `fragile`), paginação `limit/offset`. |
| `GET` | `/api/enem/questions/:id` | Assinante | Detalhe completo da questão oficial (enunciado, imagens, 5 alternativas, metadados H1–H30/TRI). |
| `POST` | `/api/enem/questions/:id/report` | Assinante | Reporta erro de formatação/imagem para a fila operacional do Admin. |
| `POST` | `/api/learning/attempts` | Assinante | Registra tentativa (`questionId`, `chosen`, `confidence`, `timeSec`, `hintsUsed`, `mode`), calcula evidência pedagógica, atualiza Radar de Domínio, cria flashcard automático se erro e registra XP/streak anti-abuso. |
| `POST` | `/api/learning/proof-question` | Assinante | Seleciona próxima questão de comprovação pós-erro para `skillId` + `targetTriB`: retorna **questão oficial inédita** (`source: 'official_enem'`, custo 0 de IA) ou sinaliza `officialExhausted: true` para acionar fallback por IA (`FR-025`/`FR-026`). |
| `GET` | `/api/learning/dashboard` | Assinante | Retorna Radar de Domínio (H1–H30), Detetive de Erros, Trilha semanal adaptativa, ofensiva diária e metas semanais. |
| `GET` / `POST` | `/api/essays` | Assinante | Lista temas/redações e salva rascunho automático (`PUT /api/essays/:id/draft`). |
| `POST` | `/api/essays/:id/submit` | Assinante | Valida texto (não vazio, mínimo de palavras, ≤ 30 linhas), reserva 1 crédito de redação, executa IA C1–C5 com fallback multi-LLM, grava `essay_versions` ou estorna automaticamente em falha total. |
| `GET` / `POST` / `PUT` / `DELETE` | `/api/flashcards` | Assinante | Lista baralhos prontos + automáticos + manuais privados; CRUD para cartões manuais privados; `POST /api/flashcards/:id/review` aplica SRS (`errei`, `duvida`, `seguro`). |
| `POST` / `GET` | `/api/simulations` | Assinante | Gera simulado ENEM cronometrado (excluindo anuladas), finaliza e calcula estimativa formativa estilo TRI + plano de recuperação (`POST /api/simulations/:id/finish`). |

---

## 4. IA Multi-LLM em Tempo Real e Cotas (`FR-011` a `FR-017`, `FR-024`, `FR-026`)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/api/ai/health` | Autenticado | Lista provedores configurados (`claude`, `gemini`, `openai`) e ordem primário/fallback. Nunca ativa modo demo em produção. |
| `GET` | `/api/ai/quotas` | Assinante | Retorna saldo mensal vigente (por categoria + data de renovação) e saldo de pacotes avulsos. |
| `POST` | `/api/ai/diagnose` | Assinante | Classifica hipótese de causa de erro em tempo real com base na justificativa do estudante (consome 1 crédito `tutor`). |
| `POST` | `/api/ai/tutor` | Assinante | Conduz C–P–E adaptativo, tutoria socrática ou correção guiada de etapa em tempo real (consome 1 crédito `tutor`). |
| `POST` | `/api/ai/questions/fallback` | Assinante | Gera questão inédita de comprovação **apenas** quando o aluno esgotou as oficiais daquela `skillId`; valida 5 alternativas + gabarito único, marca `source: 'ai_generated_fallback'` e consome 1 crédito `question_gen`. |

**Códigos de Erro Padronizados de IA**:
- `402` `{ error: 'quota_exceeded', kind, canBuyAddon: true, nonAiFeaturesAvailable: true }` — bloqueia apenas o recurso de IA sem bloquear o restante da plataforma.
- `503` `{ error: 'ai_unavailable', refunded: true, message: '...' }` — falha em todos os provedores configurados; crédito garantidamente não descontado/estornado; **sem fallback heurístico simulado**.

---

## 5. Painel Administrativo Operacional (`FR-038`)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/api/admin/overview` | `admin` | Assinaturas por estado, proporção Mensal × Anual, reembolsos CDC, consumo e custo estimado de IA, margem por usuário, taxa de erro/fallback entre provedores e métricas pedagógicas pseudonimizadas. |
| `POST` | `/api/admin/quotas/adjust` | `admin` | Ajuste ou estorno manual de créditos de IA (`{ userId, kind, delta, reason }`) com registro obrigatório em `admin_audit_logs`. |
| `GET` / `PATCH` | `/api/admin/reports` | `admin` | Lista e resolve questões oficiais sinalizadas por estudantes (`under_review` → `active` ou `annulled`). |
| `GET` / `POST` / `PATCH` | `/api/admin/themes` | `admin` | Gestão da biblioteca de temas de redação ENEM. |
| `GET` / `POST` / `PATCH` / `DELETE` | `/api/admin/flashcards` | `admin` | Gestão de baralhos e flashcards curados do sistema (`origin: 'curated'`). |

---

## 6. CLI Offline de Ingestão do Acervo ENEM (`ADR-004`)

```bash
npm run ingest:enem -- --years 2009-2025 --inep-dir ./data-import/inep --assets-dir ./server/data/assets
```
- **Entradas**:
  - Questões oficiais por ano (`enem.dev` API com throttle respeitando rate limit ou dump JSON local `--source-dir`).
  - Arquivos `ITENS_PROVA_{ANO}.csv` oficiais do INEP (opcionais por ano; quando presentes, vinculam `CO_HABILIDADE` → `H01–H30`, `CO_ITEM` e `NU_PARAM_A/B/C`).
- **Saídas**:
  - Upsert idempotente em `enem_skills` e `enem_questions`.
  - Download e espelhamento de todas as imagens para `AssetStorage` (hash SHA-256 por arquivo para deduplicação).
  - Relatório resumido em stdout: questões importadas, questões cruzadas com `H1–H30`/TRI, anuladas detectadas e imagens espelhadas.
