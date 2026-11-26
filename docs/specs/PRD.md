# PRD — requisitos funcionais
> Desdobramento técnico do Documento Mestre v1.0 (fonte de verdade). Em caso de conflito, prevalece o mestre. Referências no formato etapa.subtópico.

| Área | Requisitos | Implementação |
|---|---|---|
| Conta | cadastro mínimo, verificação de e-mail, recuperação, Google (Supabase), MFA, onboarding com idade (4.1/13.1–13.3) | `/cadastro`, `/onboarding`, `src/server/auth` |
| Início | fila única com filtros Aprender/Melhorar/Aprofundar/Revisar, motivo, adiar/dispensar, retomar sessão, resumo discreto (4.3/4.9) | `/inicio`, `services/recommendations.ts` |
| Estudar | currículo completo, conteúdo por subtópico, aulas, explicação ativa, flashcards, revisões, materiais (5.1/5.4/5.6/5.10/5.11) | `/estudar/*` |
| Sessões | composição prévia ajustável, congelada após início, uma atividade por vez, pausa (4.4/5.8/10.5) | `/estudar/sessao/[id]`, `services/sessions.ts` |
| Questões | banco oficial, filtros, prática adaptativa, lista manual, caderno de erros, CPE, classificação (5.2/5.3/5.7) | `/questoes/*`, `services/questions.ts` |
| Simulados | personalizados, oficiais (quando importados), diagnóstico opcional, cronômetro conforme modo, resultado por acertos (4.11/5.9/8.8) | `/simulados/*`, `services/exams.ts` |
| Redação | temas, editor com autosave, correção estimada C1–C5, reescritas, exercícios, repertórios, teoria, indicadores (6.x) | `/redacao/*`, `services/essays.ts` |
| Desempenho | geral/questões/simulados/redação, período, mapa líquido hierárquico (4.8/8.9/10.1) | `/desempenho` |
| Gamificação | XP, nível/classe, streak, conquistas, ranking opt-in (9.x) | `/perfil` |
| Comercial | planos, franquias, checkout Asaas, cancelamento, arrependimento, cupons, acessos temporários (11.x/13.7) | `/configuracoes`, `services/commerce.ts` |
| Admin | visão geral, usuários, conteúdos, importação, IA, financeiro, monitoramento, feedback, configurações (12.3–12.7) | `/admin/*` |
| Direitos | exportação, correção, exclusão de conta (13.6) | `/configuracoes` (Privacidade) |
