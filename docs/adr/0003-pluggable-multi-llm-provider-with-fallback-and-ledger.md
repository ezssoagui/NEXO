# ADR-0003: Camada Multi-LLM Plugável (Claude, Gemini, GPT) com Fallback e Ledger Persistido

- **Status**: Aceita
- **Data**: 2026-11-23
- **Escopo**: V1 Comercial (`001-nexo-commercial-v1-enem`)

## Contexto

O NEXO depende de IA em tempo real para três recursos essenciais (correção de redação C1–C5, tutoria/diagnóstico pedagógico e geração eventual de questão de comprovação quando esgotadas as oficiais). A especificação e a Constituição exigem:
- Proibição de "modo demonstrativo" heurístico simulado em produção paga (`FR-015`).
- Fallback automático entre provedores em caso de falha técnica, timeout ou saída estruturada inválida (`FR-016`).
- Garantia de que nenhum crédito seja descontado quando todos os provedores falharem (`FR-017`).
- Flexibilidade na fase atual para testar e comparar **Claude (Anthropic)**, **Gemini (Google)** e **GPT (OpenAI)** via API.

## Decisão

1. Evoluir `server/ai/providers.ts` mantendo a interface única `LLMProvider.structured<T>(req)` com validação obrigatória via **Zod** e implementar três adaptadores oficiais plugáveis por variáveis de ambiente:
   - `AnthropicProvider` (Claude)
   - `GeminiProvider` (Google Gemini)
   - `OpenAIProvider` (GPT)
2. Introduzir `FallbackChainProvider`, que percorre a lista ordenada configurada em `NEXO_AI_PROVIDERS` (ex.: `anthropic,gemini,openai`) utilizando apenas os provedores com credenciais configuradas e acionando automaticamente o próximo provedor em erros recuperáveis (`timeout`, `rate_limited`, `unavailable`, `invalid_output`).
3. Remover o fallback automático para `DemoProvider` no cliente (`src/services/ai.ts`) para fluxos comerciais.
4. Substituir o controle de uso em memória (`server/usage.ts`) por um **Ledger de Cotas persistido (`ai_quota_ledger`)** com transação atômica em 3 passos:
   - **Reservar** 1 crédito (precedência: cota mensal vigente → pacote avulso válido mais próximo do vencimento);
   - **Executar** a cadeia multi-LLM com validação Zod;
   - **Confirmar (`committed`)** em sucesso ou **Estornar (`refunded`)** automaticamente para a mesma origem em falha total, registrando métricas pseudonimizadas em `ai_operation_logs`.

## Alternativas Consideradas

- **Provedor único fixo (somente Claude)**: cria ponto único de falha, impede fallback automático e dificulta otimização futura de custo por recurso (ex.: modelo mais econômico para tutoria vs. mais robusto para redação C1–C5).
- **Manter controle de cota em memória**: perde saldos ao reiniciar o servidor e não garante consistência transacional nem auditoria de pacotes avulsos.

## Consequências

- **Positivas**: alta disponibilidade de IA, flexibilidade total para testar Claude, Gemini e GPT com a mesma interface e proteção rigorosa de margem e justiça na cobrança de créditos.
- **Negativas / Trade-offs**: exige manter schemas Zod estritos e compatíveis com saída estruturada JSON nos três provedores, além de tabelas de preço estimadas por modelo para cálculo de custo no Painel Admin.
