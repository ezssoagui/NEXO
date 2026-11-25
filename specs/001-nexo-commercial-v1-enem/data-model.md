# Data Model: NEXO V1 Comercial (Foco 100% ENEM)

**Feature**: `001-nexo-commercial-v1-enem`  
**Storage Engine (V1)**: SQLite (`node:sqlite`, `PRAGMA foreign_keys = ON`), com SQL ANSI compatível para futura migração a PostgreSQL.

---

## 1. Visão Geral das Entidades e Relacionamentos

```text
users (Estudante / Admin)
 ├── 1:N sessions (autenticação por e-mail + senha)
 ├── 1:N password_reset_tokens (recuperação de senha)
 ├── 1:1 student_profiles (perfil pedagógico — SEM CPF)
 ├── 1:N subscriptions ── N:1 payers (dados fiscais/pagamento separados — LGPD)
 │    └── 1:N payment_events (idempotência de eventos financeiros)
 ├── 1:N ai_quota_cycles (cota mensal por categoria, sem acúmulo)
 ├── 1:N ai_addon_balances (pacotes avulsos comprados)
 ├── 1:N ai_quota_ledger (trilha atômica de débitos, estornos e ajustes manuais)
 ├── 1:N attempts ── N:1 enem_questions (acervo oficial 2009+, H1–H30, TRI)
 ├── 1:N mastery_cycles (ciclo Diagnosticar→Consolidar)
 ├── 1:N essays ── 1:N essay_versions (C1–C5 versionado)
 ├── 1:N flashcards ── 1:1 flashcard_reviews (SRS adaptativo)
 ├── 1:N simulations (simulados cronometrados estilo TRI)
 ├── 1:N xp_events & daily_streaks (gamificação individual leve)
 └── 1:N ai_operation_logs (auditoria pseudonimizada de IA)

question_reports (sinalizações de erro de imagem/texto para fila do Admin)
admin_audit_logs (trilha auditável de ações administrativas)
```

---

## 2. Tabelas e Regras de Validação

### 2.1 Contas, Sessões e LGPD (`FR-001` a `FR-005`)

#### `users`
| Campo | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY (UUID) | Identificador interno do usuário |
| `email` | TEXT | UNIQUE NOT NULL (lowercase) | Credencial principal de login e recuperação |
| `nickname` | TEXT | NOT NULL (2–20 chars) | Apelido exibido na interface pedagógica |
| `pass_hash` | TEXT | NOT NULL | Hash `scrypt` da senha |
| `salt` | TEXT | NOT NULL | Sal criptográfico único |
| `role` | TEXT | NOT NULL CHECK (`'student'`, `'admin'`) | Papel de autorização |
| `lgpd_consent_at` | INTEGER | NOT NULL | Timestamp de aceite dos termos/LGPD |
| `is_minor` | INTEGER | NOT NULL DEFAULT 0 | Flag declarativa de menor de 18 anos |
| `created_at` | INTEGER | NOT NULL | Timestamp de criação |
| `deleted_at` | INTEGER | NULL | Soft-delete técnico apenas durante purga; dados pessoais removidos na exclusão definitiva |

#### `sessions` & `password_reset_tokens`
- `sessions(token_hash PK, user_id FK CASCADE, expires INTEGER NOT NULL)`
- `password_reset_tokens(token_hash PK, user_id FK CASCADE, expires INTEGER NOT NULL, used_at INTEGER NULL)`

#### `student_profiles`
| Campo | Tipo | Restrições | Descrição |
|---|---|---|---|
| `user_id` | TEXT | PRIMARY KEY FK `users(id)` CASCADE | Vínculo 1:1 com estudante |
| `target_course` | TEXT | NULL | Curso/objetivo desejado no ENEM |
| `weekly_hours` | INTEGER | NOT NULL DEFAULT 10 | Horas semanais disponíveis |
| `exam_year` | INTEGER | NOT NULL | Ano-alvo do ENEM |
| `perceived_difficulties` | TEXT | NOT NULL DEFAULT `'[]'` | JSON com áreas de maior dificuldade |
| `weekly_goal_questions` | INTEGER | NOT NULL DEFAULT 30 | Meta semanal configurável (gamificação leve) |
| `onboarding_completed_at` | INTEGER | NULL | Marca conclusão do diagnóstico inicial |
| `updated_at` | INTEGER | NOT NULL | Última atualização |

> **Regra LGPD (FR-003)**: `student_profiles` e `users` **nunca** armazenam CPF, RG ou dados de cartão do estudante.

---

### 2.2 Pagadores, Assinaturas e Idempotência Financeira (`FR-006` a `FR-010`)

#### `payers`
| Campo | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY (UUID) | Identificador do pagador |
| `external_customer_id` | TEXT | UNIQUE NULL | ID do cliente no gateway externo (ou simulador) |
| `financial_email` | TEXT | NOT NULL | E-mail para recibos e avisos de cobrança |
| `payer_name` | TEXT | NOT NULL | Nome do pagador (estudante maior ou responsável) |
| `is_guardian` | INTEGER | NOT NULL DEFAULT 0 | Indica se o pagador é responsável legal |
| `document_last4` | TEXT | NULL | Apenas referência mascarada (documento completo reside no gateway) |
| `created_at` | INTEGER | NOT NULL | Timestamp |

#### `subscriptions`
| Campo | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY (UUID) | Identificador da assinatura |
| `user_id` | TEXT | NOT NULL FK `users(id)` CASCADE | Estudante beneficiário |
| `payer_id` | TEXT | NOT NULL FK `payers(id)` | Pagador vinculado |
| `plan_code` | TEXT | NOT NULL CHECK (`'nexo_monthly'`, `'nexo_annual'`) | Modalidade única (Mensal ou Anual) |
| `payment_method` | TEXT | NOT NULL CHECK (`'credit_card'`, `'pix'`) | Meio de pagamento |
| `status` | TEXT | NOT NULL CHECK (`'pending'`, `'active'`, `'grace_period'`, `'canceled_until_end'`, `'suspended'`, `'refunded'`) | Estado na máquina de estados |
| `current_period_start` | INTEGER | NOT NULL | Início do período pago atual |
| `current_period_end` | INTEGER | NOT NULL | Fim do período pago atual |
| `cdc_deadline_at` | INTEGER | NOT NULL | `first_activated_at + 7 dias corridos` (arrependimento CDC) |
| `grace_until` | INTEGER | NULL | `failed_at + 3 dias corridos` quando em `grace_period` |
| `external_subscription_id` | TEXT | UNIQUE NULL | ID no gateway |
| `last_event_ts` | INTEGER | NOT NULL DEFAULT 0 | Proteção contra eventos fora de ordem |
| `updated_at` | INTEGER | NOT NULL | Última transição |

#### `payment_events`
| Campo | Tipo | Restrições | Descrição |
|---|---|---|---|
| `event_id` | TEXT | PRIMARY KEY | ID único do evento do gateway (**garante idempotência**) |
| `subscription_id` | TEXT | NULL FK `subscriptions(id)` | Assinatura afetada |
| `event_type` | TEXT | NOT NULL | `payment_confirmed`, `payment_failed`, `refund_confirmed`, `addon_confirmed`, `subscription_canceled` |
| `event_ts` | INTEGER | NOT NULL | Timestamp de origem do evento |
| `payload_json` | TEXT | NOT NULL | Carga sanitizada (sem dados de cartão) |
| `processed_at` | INTEGER | NOT NULL | Momento do processamento |

#### Máquina de Estados de `subscriptions.status`
```text
(sem assinatura / pending)
   └─[payment_confirmed]──────────────────────────────► active
active
   ├─[cdc_refund_requested && now <= cdc_deadline_at]─► refunded       (bloqueio imediato)
   ├─[cancel_requested && now > cdc_deadline_at]──────► canceled_until_end (acesso até period_end)
   └─[renewal_payment_failed]─────────────────────────► grace_period   (grace_until = +3 dias)
grace_period
   ├─[payment_confirmed]──────────────────────────────► active
   └─[now > grace_until || cancel_requested]──────────► suspended      (histórico preservado)
canceled_until_end
   └─[now > current_period_end]───────────────────────► suspended      (histórico preservado)
suspended
   └─[new_payment_confirmed]──────────────────────────► active         (retoma sem perda)
```
> **Acesso às ferramentas pedagógicas**: liberado **apenas** quando `status IN ('active', 'canceled_until_end', 'grace_period')`.  
> **Acesso à área de assinatura e LGPD (exportação/exclusão)**: sempre liberado para qualquer usuário autenticado.

---

### 2.3 Carteira de Cotas de IA e Auditoria (`FR-011` a `FR-017`)

#### `ai_quota_cycles`
| Campo | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `user_id` | TEXT | NOT NULL FK `users(id)` CASCADE | Assinante |
| `cycle_start` | INTEGER | NOT NULL | Início do ciclo mensal (renova a cada mês, inclusive no Anual) |
| `cycle_end` | INTEGER | NOT NULL | Fim do ciclo mensal (sem rollover de sobra) |
| `essay_limit` / `essay_used` | INTEGER | NOT NULL | Limite e uso mensal de correções de redação |
| `tutor_limit` / `tutor_used` | INTEGER | NOT NULL | Limite e uso mensal de interações de tutoria/diagnóstico |
| `question_gen_limit` / `question_gen_used` | INTEGER | NOT NULL | Limite e uso mensal de geração eventual de questão |

#### `ai_addon_balances`
| Campo | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `user_id` | TEXT | NOT NULL FK `users(id)` CASCADE | Assinante |
| `kind` | TEXT | NOT NULL CHECK (`'essay'`, `'tutor'`, `'question_gen'`) | Categoria de IA |
| `credits_total` | INTEGER | NOT NULL | Créditos comprados no pacote avulso |
| `credits_remaining` | INTEGER | NOT NULL CHECK (`>= 0`) | Saldo restante |
| `payment_event_id` | TEXT | UNIQUE NOT NULL | Garante que evento duplicado nunca credita em dobro |
| `expires_at` | INTEGER | NOT NULL | Validade (padrão: 12 meses) |
| `created_at` | INTEGER | NOT NULL | Data da compra |

#### `ai_quota_ledger`
| Campo | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `user_id` | TEXT | NOT NULL FK `users(id)` CASCADE | Assinante |
| `kind` | TEXT | NOT NULL CHECK (`'essay'`, `'tutor'`, `'question_gen'`) | Categoria |
| `source` | TEXT | NOT NULL CHECK (`'monthly_cycle'`, `'addon'`, `'admin_grant'`) | Origem do crédito |
| `delta` | INTEGER | NOT NULL | `-1` (reserva/débito), `+1` (estorno automático por falha ou ajuste admin) |
| `status` | TEXT | NOT NULL CHECK (`'reserved'`, `'committed'`, `'refunded'`) | Estado da operação |
| `operation_id` | TEXT | UNIQUE NOT NULL | Chave de idempotência da chamada |
| `reason` | TEXT | NOT NULL | Motivo (ex.: `essay_eval`, `provider_total_failure_refund`, `admin_support`) |
| `created_at` | INTEGER | NOT NULL | Timestamp |

> **Regra de precedência (FR-013)**: Ao reservar 1 crédito em transação, consome-se primeiro `ai_quota_cycles` (se `used < limit`); somente se zerado, consome-se o `ai_addon_balances` válido mais próximo do vencimento. Em falha de todos os provedores de IA, a transação de estorno restaura exatamente a mesma origem (`monthly_cycle` ou `addon`).

---

### 2.4 Banco Oficial ENEM (2009+), H1–H30 e TRI (`FR-020` a `FR-026`)

#### `enem_skills`
| Campo | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Ex.: `LC-H01`, `CH-H15`, `CN-H21`, `MT-H19` |
| `area` | TEXT | NOT NULL CHECK (`'LC'`, `'CH'`, `'CN'`, `'MT'`) | Grande área oficial do ENEM |
| `competency_num` | INTEGER | NOT NULL | Competência da matriz (1–9) |
| `skill_num` | INTEGER | NOT NULL | Número oficial da habilidade (`1` a `30`) |
| `description` | TEXT | NOT NULL | Descritor oficial da Matriz de Referência do INEP |

#### `enem_questions`
| Campo | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Ex.: `enem-2023-LC-001-ingles` ou `enem-2023-MT-136` |
| `year` | INTEGER | NOT NULL CHECK (`>= 2009`) | Ano da edição oficial |
| `question_index` | INTEGER | NOT NULL | Número da questão no caderno de referência |
| `booklet_color` | TEXT | NOT NULL | Cor do caderno de referência (para cruzamento INEP) |
| `area` | TEXT | NOT NULL CHECK (`'LC'`, `'CH'`, `'CN'`, `'MT'`) | Área oficial |
| `discipline` | TEXT | NOT NULL | Disciplina (`linguagens`, `humanas`, `natureza`, `matematica`) |
| `language` | TEXT | NULL CHECK (`'ingles'`, `'espanhol'`, NULL) | Idioma estrangeiro (quando aplicável) |
| `skill_id` | TEXT | NULL FK `enem_skills(id)` | Habilidade oficial `H1–H30` (`CO_HABILIDADE` do INEP) |
| `inep_item_code` | INTEGER | NULL | `CO_ITEM` oficial do BNI/INEP |
| `tri_a` / `tri_b` / `tri_c` | REAL | NULL | Parâmetros oficiais da TRI (discriminação, dificuldade, chute) |
| `context_md` | TEXT | NOT NULL | Texto-base / enunciado contextual |
| `alternatives_intro` | TEXT | NOT NULL | Comando da questão |
| `alternatives_json` | TEXT | NOT NULL | Array das 5 alternativas `{letter, text, assetPath?}` |
| `correct_alternative` | TEXT | NOT NULL CHECK (`'A'..'E'`, `'ANULADA'`) | Gabarito oficial |
| `assets_json` | TEXT | NOT NULL DEFAULT `'[]'` | Caminhos internos no `AssetStorage` (espelhados) |
| `status` | TEXT | NOT NULL CHECK (`'active'`, `'annulled'`, `'under_review'`) | Exclui `annulled` de simulados/comprovações |
| `source` | TEXT | NOT NULL CHECK (`'official_enem'`, `'ai_generated_fallback'`) | Selo transparente de origem |

---

### 2.5 Aprendizagem, Redações, Flashcards, Simulados e Operação

- **`attempts`**: `(id, user_id, question_id, skill_id, area, chosen, correct, confidence, evidence, cause, intervention, mode, cycle_id, time_sec, hints_used, created_at)` — alimenta Radar de Domínio (`mastery.ts`) e Detetive de Erros (`detective.ts`).
- **`mastery_cycles`**: `(id, user_id, skill_id, origin_question_id, situation, stage, status, proof_question_id, proof_source, history_json, created_at, updated_at)`.
- **`essay_themes`**: `(id, title, year, source, motivating_texts_json, active)`.
- **`essays`** & **`essay_versions`**:
  - `essays(id PK, user_id FK, theme_id FK, draft_text, updated_at)`
  - `essay_versions(id PK, essay_id FK, version_number, submitted_text, line_count, total_score, competencies_json, highlights_json, intervention_json, general_comment, provider_engine, quota_ledger_id FK, created_at)`
- **`flashcards`** & **`flashcard_reviews`**:
  - `flashcards(id PK, owner_user_id FK NULL, origin CHECK('curated','error_auto','manual_private'), area, skill_id, front, back, source_ref_id, created_at)` — se `origin='curated'`, `owner_user_id IS NULL`; se `manual_private` ou `error_auto`, pertence exclusivamente ao `owner_user_id`.
  - `flashcard_reviews(user_id, flashcard_id, box, ease, interval_days, due_at, lapses, last_reviewed_at, PRIMARY KEY(user_id, flashcard_id))`.
- **`simulations`**: `(id PK, user_id FK, mode, areas_json, question_ids_json, answers_json, started_at, finished_at, duration_sec, estimated_tri_scores_json, recovery_plan_json)`.
- **`daily_streaks`** & **`xp_events`**:
  - `daily_streaks(user_id PK, current_streak, best_streak, last_active_date)`
  - `xp_events(id PK, user_id FK, event_key UNIQUE per user, amount, reason, created_at)` — `event_key` garante regra anti-abuso (`FR-037`).
- **`ai_operation_logs`**: `(id PK, pseudo_user_id, kind, primary_provider, final_provider, used_fallback, model, status, input_tokens, output_tokens, cost_usd, latency_ms, quota_action, created_at)`.
- **`question_reports`** & **`admin_audit_logs`**: triagem de erros reportados no acervo e registro imutável de ações administrativas (`admin_user_id`, `action`, `target_id`, `reason`, `created_at`).
