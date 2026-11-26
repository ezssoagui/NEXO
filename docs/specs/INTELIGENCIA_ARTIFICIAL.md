# Inteligência artificial
> Desdobramento técnico do Documento Mestre v1.0 (fonte de verdade). Em caso de conflito, prevalece o mestre. Referências no formato etapa.subtópico.

- **Escopo (7.1):** explicações ativas, redação completa, reescritas, exercícios discursivos, classificação administrativa, gêmeas. Proibidos: chat/professor, voz, OCR, assistência durante atividades, geração dinâmica de materiais (A.1).
- **Roteamento (7.2):** finalidades `essay` (superior), `mini`, `nano`, `validator`, `embedding`; explicações simples → nano, complexas → mini. Nenhum ID pré-aprovado: cadastrar e aprovar em /admin/ia com preço verificado.
- **Prompts (7.10):** `src/modules/ai/prompts.ts`, versionados em `prompt_versions` (rollback). Conteúdo do estudante e documentos recuperados delimitados como dados.
- **Privacidade (13.4):** `scrubPII` remove e-mail, CPF, telefone, CEP e nome; `store:false`; contexto pedagógico sem identificadores.
- **Qualidade (7.8):** schema estrito + Zod + validação semântica (notas em passos de 40, total = soma, citações literais); retry limitado; falha não consome franquia nem altera domínio; alertas de falha recorrente.
- **Custos (7.9/12.7):** custo por tentativa em `ai_usage`; orçamento mensal com alertas 70/90/100% e bloqueio de segurança.
- **RAG (6.3/15.8):** rubrica oficial Inep 2026 em `rag_documents` (rag); exemplos reais só com autorização e notas conhecidas; benchmark humano separado do RAG. Embeddings pendentes.
- **Benchmark e trava (ADR-019):** `runEssayBenchmark` usa o mesmo prompt/RAG/modelo/validação da produção; critério central = discrepância oficial do Inep (>100 no total ou >80 numa competência); limiares propostos; `POST /api/jobs/essay-benchmark`; aprovação em /admin/ia; em produção `submitEssay` responde 503 sem consumir franquia até haver execução aprovada para o modelo aprovado e o prompt ativo.
- **Pendências:** confirmar modelos/preços; conjunto de benchmark representativo (hoje 8 redações UFES de 900–980); autorização para enviar redações privadas à API e para as chamadas pagas.
