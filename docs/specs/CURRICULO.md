# Currículo
> Desdobramento técnico do Documento Mestre v1.0 (fonte de verdade). Em caso de conflito, prevalece o mestre. Referências no formato etapa.subtópico.

- **Hierarquia (3.1):** área → disciplina → tópico → subtópico → habilidade interna (`areas/subjects/topics/subtopics/skills`).
- **Fonte v0 (3.3/3.10):** Matriz de Referência ENEM (Inep), objetos de conhecimento e H1–H30 (`supabase/seed/curriculum_matriz_v0.json`, gerado por `scripts/curriculum/build_matriz_v0.py`). 407 subtópicos; Humanas organizada pelos eixos da matriz. Status `draft` (ADR-005).
- **Relevância (3.4):** baixa/média/alta com fonte e localizador (`relevance_source_id`, `relevance_locator`); `unknown` até processamento de fontes autorizadas. Alteração via Administração → Configurações (exige fonte cadastrada).
- **Versionamento (3.11):** `curriculum_versions` (uma ativa), `curriculum_change_log`, proibição de exclusão física (aposentar com `retired`).
- **Conexões (3.6):** `skill_connections` (pré-requisito, conexão, transversal) — nunca bloqueiam acesso.
- **Pendências:** validação pedagógica, granularidade das habilidades internas, vínculos com habilidades oficiais e relevância.
