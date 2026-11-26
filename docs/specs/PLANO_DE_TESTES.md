# Plano de testes
> Desdobramento técnico do Documento Mestre v1.0 (fonte de verdade). Em caso de conflito, prevalece o mestre. Referências no formato etapa.subtópico.

| Camada | Ferramenta | Arquivos | Comando |
|---|---|---|---|
| Regras puras | Vitest | `tests/unit/*.test.ts` (64 casos: domínio, motor, FSRS, gamificação, franquias, redação, PII, CPE, simulados, assinaturas, gêmeas) | `npm test` |
| Banco/serviços | Vitest + PGlite | `tests/db/migrations.test.ts`, `tests/db/services.test.ts` (pipeline, sessões, franquias, IA com dublê, redação, simulados, webhook, RLS, exclusão) | `npm test` |
| RLS | pgTAP | `supabase/tests/001_rls.sql` (via `tests/db/pgtap.test.ts` ou `supabase test db`) | `npm test` |
| Pipeline de acervo | unittest | `scripts/import-enem/test_pipeline.py` | `npm run test:py` |
| Fluxos web | Playwright (Chrome) | `tests/e2e/flows.spec.ts` (8 fluxos) | `npm run build && npm run test:e2e` |

Pendentes: testes de carga, restauração real de backup, sandbox Asaas, execução real do benchmark de redação (métricas e limiares implementados — ADR-019; falta conjunto representativo e autorização), auditoria de acessibilidade, teste em Supabase real e em Workers.
