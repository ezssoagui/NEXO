# ADR-0001: Persistência Local-First em SQLite (`node:sqlite`) com Camada de Repositórios

- **Status**: Aceita
- **Data**: 2026-11-23
- **Escopo**: V1 Comercial (`001-nexo-commercial-v1-enem`)

## Contexto

A plataforma NEXO está evoluindo de um protótipo local para uma arquitetura comercial completa (contas por e-mail/senha, separação LGPD Pagador × Estudante, assinaturas, ledger atômico de cotas de IA, banco de questões oficiais ENEM 2009+ e histórico pedagógico). Nesta etapa do V1, precisamos de velocidade de desenvolvimento e validação local sem exigir infraestrutura externa paga ou containers complexos para rodar e testar o sistema, mantendo porém caminho limpo para migração a PostgreSQL em produção.

## Decisão

Adotar uma abordagem **local-first no V1**:
1. Evoluir o backend existente em `server/` (Node.js 22+ com TypeScript) utilizando **SQLite nativo (`node:sqlite`)** armazenado em `server/data/nexo.db` (e `:memory:` na suíte de testes Vitest).
2. Isolar todo acesso SQL atrás de uma camada de repositórios tipados em `server/repositories/` (`users`, `billing`, `quotas`, `enem`, `learning`), evitando SQL espalhado nas rotas ou regras de negócio.
3. Escrever o esquema relacional e consultas em SQL padrão compatível com PostgreSQL (chaves primárias UUID/TEXT, foreign keys explícitas, índices e transações ACID) para que a migração para PostgreSQL em produção exija apenas a troca da implementação dos repositórios.

## Alternativas Consideradas

- **PostgreSQL + Drizzle ORM + Docker desde o Dia 1**: ótima solução para produção multi-instância, porém adiciona complexidade operacional desnecessária na fase atual de validação local do V1.
- **Supabase gerenciado (Auth + DB + Storage)**: acopla autenticação e dados a um fornecedor externo antes de consolidar todas as regras de negócio do produto.

## Consequências

- **Positivas**: setup local imediato (`npm run server` sem serviços externos), testes de integração ultrarrápidos com banco em memória e reaproveitamento direto do `server/db.ts` existente.
- **Negativas / Trade-offs**: SQLite em arquivo não suporta múltiplas instâncias simultâneas de servidor com escrita concorrente em nuvem; antes do lançamento comercial em produção escalável será criada uma ADR de migração para PostgreSQL substituindo o adaptador de persistência.
