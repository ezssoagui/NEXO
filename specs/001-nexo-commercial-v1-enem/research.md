# Phase 0 Research & Architectural Decisions: NEXO V1 Comercial (ENEM)

**Feature**: `001-nexo-commercial-v1-enem`  
**Date**: 2026-11-23  
**Related ADRs**: `docs/adr/0001` a `docs/adr/0004`

Este documento consolida todas as decisões técnicas para o plano de implementação do V1 comercial, resolvendo integralmente os pontos de arquitetura com foco em **abordagem local-first no V1** (baixo atrito para desenvolver, testar e validar o protótipo comercial completo) e **fronteiras limpas de substituição** para ida a produção.

---

## 1. Backend e Persistência Local-First (ADR-001)

* **Decision**: Evoluir o servidor existente em `server/` (Node.js 22+ com TypeScript e `node:http` modularizado por rotas/serviços) utilizando **SQLite nativo (`node:sqlite`)** para o V1 local, encapsulado atrás de interfaces de repositório (`StoreRepositories`) com SQL compatível com PostgreSQL.
* **Rationale**:
  * O repositório já possui `server/db.ts` funcional sobre `node:sqlite`, zero dependências pesadas externas e execução instantânea em testes (`:memory:` no Vitest).
  * Mantém o ciclo de desenvolvimento e testes locais 100% autocontido (sem exigir Docker/PostgreSQL rodando na máquina durante o V1).
  * Separar o acesso a dados em repositórios bem tipados (`users`, `subscriptions`, `quotaLedger`, `enemQuestions`, `essays`, `flashcards`, `simulations`, `aiLogs`, `auditLogs`) garante migração direta para PostgreSQL em produção sem reescrever regras de negócio.
* **Alternatives considered**:
  * *PostgreSQL + Drizzle + Docker no V1*: ótimo para produção distribuída, mas adiciona atrito operacional desnecessário na fase atual de protótipo funcional local.
  * *Supabase gerenciado*: acopla autenticação, banco e storage a um fornecedor externo antes da validação completa do V1.

---

## 2. Gateway de Pagamento Desacoplado com Simulador Local (ADR-002)

* **Decision**: Definir a interface de domínio `PaymentGateway` no backend para operar toda a máquina de estados comercial (NEXO Mensal, NEXO Anual, Cartão recorrente/parcelado, Pix, pacotes avulsos, reembolso CDC 7 dias, tolerância de 3 dias e eventos idempotentes), fornecendo no V1 a implementação `LocalPaymentGateway` (simulador controlado via endpoints administrativos/de checkout local).
* **Rationale**:
  * Evita bloquear o desenvolvimento do V1 em aprovação de conta PJ, homologação bancária ou credenciais de gateway (Asaas/Pagar.me/Mercado Pago/Stripe).
  * Permite testar 100% das regras críticas da spec — inclusive eventos duplicados, fora de ordem, inadimplência com tolerância de 3 dias, reembolso CDC de 7 dias e separação LGPD Pagador × Estudante — de forma determinística e automatizada.
  * Quando o gateway brasileiro real for escolhido para lançamento, basta implementar `PaymentGateway` (ex.: `AsaasPaymentGateway`) e plugar via variável de ambiente.
* **Alternatives considered**:
  * *Integrar Asaas ou Stripe diretamente agora*: prematuro para a fase atual do protótipo e criaria dependência externa para rodar testes de fluxo comercial.

---

## 3. Camada Multi-LLM Plugável com Fallback e Ledger Persistido (ADR-003)

* **Decision**: Evoluir `server/providers.ts` para uma cadeia multi-LLM configurável por variáveis de ambiente suportando **Anthropic Claude**, **Google Gemini** e **OpenAI GPT** (com ordem configurável de primário e secundário/terciário), mantendo validação obrigatória de saída estruturada com **Zod** e substituindo o controle em memória de `server/usage.ts` por um **Ledger de Cotas persistido no banco** com padrão *reservar → executar → confirmar ou estornar*.
* **Rationale**:
  * Atende diretamente a `FR-011` a `FR-017` e ao Princípio II da Constituição (zero modo demonstrativo em produção, fallback automático entre provedores e estorno garantido em falha total).
  * O projeto já possui `LLMProvider`, `AnthropicProvider`, `MockProvider` e `zod` instalados; estender com `GeminiProvider` e `OpenAIProvider` (via `fetch` nativo do Node 22 ou SDKs leves) mantém a interface única `structured<T>(req)` e permite comparar custo/qualidade entre os 3 provedores durante o protótipo.
  * O padrão *reserve-commit-refund* em transação SQLite elimina condições de corrida (ex.: dois envios simultâneos de redação com apenas 1 crédito) e garante estorno atômico se todos os provedores falharem.
* **Alternatives considered**:
  * *Provedor único (apenas Claude)*: viola `FR-016` (fallback automático entre provedores).
  * *Manter `server/usage.ts` em memória*: perde saldos ao reiniciar o servidor e não suporta pacotes avulsos nem auditoria administrativa.

---

## 4. Pipeline Offline de Ingestão ENEM (2009+) e Espelhamento de Imagens (ADR-004)

* **Decision**: Criar uma CLI offline (`scripts/ingest-enem.ts`) que importa provas oficiais do ENEM (a partir de 2009) a partir da fonte aberta `enem.dev` (ou dump JSON local) e faz o cruzamento determinístico com o CSV oficial `ITENS_PROVA_{ANO}.csv` dos Microdados do INEP (via cor do caderno + posição `CO_POSICAO` + idioma) para anexar `CO_HABILIDADE` (`H1–H30`) e parâmetros TRI (`NU_PARAM_A`, `NU_PARAM_B`, `NU_PARAM_C`), persistindo no banco próprio e espelhando todas as imagens através de uma interface `AssetStorage` (local em `server/data/assets/` no V1, pronta para **Cloudflare R2 / S3** em produção).
* **Rationale**:
  * Elimina dependência de rate limit (1 req/s da `api.enem.dev`) ou indisponibilidade de terceiros durante o uso dos estudantes.
  * Viabiliza nativamente `FR-020`, `FR-025` (comprovação pós-erro com outra questão oficial inédita da mesma habilidade `H1–H30` e dificuldade TRI compatível) e `FR-036` (simulado com estimativa estilo TRI baseada nos parâmetros reais `a/b/c`).
  * Espelhar imagens via `AssetStorage` garante que gráficos, tirinhas e fórmulas das provas nunca quebrem por hotlink externo, mantendo migração trivial para Cloudflare R2/S3.
* **Alternatives considered**:
  * *Consultar `api.enem.dev` em tempo real no front/back*: falha sob concorrência (rate limit 1 req/s), não traz `H1–H30` nem parâmetros TRI do INEP e viola a independência operacional da Constituição.
  * *Manter URLs externas de imagem*: risco de links quebrados e bloqueio de CORS/hotlink em produção.

---

## 5. Evolução do Front-End e Remoção do Não-Escopo V1

* **Decision**: Manter o front-end em **React 18 + TypeScript + Vite + Tailwind CSS + Zustand** já existente, reorganizando navegação e rotas para expor apenas o escopo aprovado do V1 (100% ENEM) e ocultando/removendo rotas fora do V1 (`Arena`, `Aulas`, `Aula`, `Biblioteca`, `Ensinar`, `Portfolio` e seletores de Vestibular/Olimpíadas), além de remover o fallback automático para `DemoProvider` no cliente (`src/services/ai.ts`).
* **Rationale**:
  * Preserva o investimento visual e os 49 testes já existentes no núcleo pedagógico (`src/engine/`), concentrando esforço nas regras comerciais, acervo ENEM real, IA real e fluxo ponta a ponta.
  * Garante estrita conformidade com o Princípio II (sem modo demo em produção) e Princípio V (disciplina de escopo V1).
* **Alternatives considered**:
  * *Reescrever front-end do zero (ex.: Next.js)*: atrasaria desnecessariamente o V1 sem ganho funcional frente ao SPA Vite + API Node existente.
