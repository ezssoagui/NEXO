# Arquitetura
> Desdobramento técnico do Documento Mestre v1.0 (fonte de verdade). Em caso de conflito, prevalece o mestre. Referências no formato etapa.subtópico.

```
Navegador (React/Next.js App Router, sem chaves)
  └─ Route Handlers /api/* — auth, origem, rate limit, Zod, nível de acesso (src/server/http/handler.ts)
       └─ Serviços de domínio (src/server/services) — transações, franquias, auditoria
            ├─ Módulos puros (src/modules) — mastery, adaptive-engine, reviews, fsrs, essays, quotas, subscriptions, twins, simulations
            ├─ PostgreSQL (Supabase em produção; PGlite em dev/teste) com RLS
            └─ Integrações (src/integrations) — OpenAI (Responses API), Asaas (v3)
Python (scripts/import-enem) — acervo oficial → staging JSON → /admin/importacao
Jobs (POST /api/jobs/:job com CRON_SECRET) — reconcile, twins, backup-check, record-backup, load-reference
```
- Monólito modular, sem Redis/Kubernetes/microsserviços (15.2).
- Contextos de banco: `asUser` (RLS) e `asService` (após autorização) — ADR-004.
- Hospedagem: Cloudflare Workers via adaptador a validar em prova de conceito (15.13); alternativa Node (`next start`). PGlite não é usado em produção.
