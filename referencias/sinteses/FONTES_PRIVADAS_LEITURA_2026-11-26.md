# Leitura das fontes privadas — 2026-11-26

Leitura autorizada pelo usuário nesta data. Esta síntese é original: não reproduz trechos, tabelas ou redações dos materiais e não concede licença de uso. Os PDFs continuam apenas em `referencias/privadas/` (ignorado pelo Git). Algumas cópias trazem marca d'água de licenciamento com dados pessoais de terceiros (nome, e-mail e, em um caso, CPF). Esses dados não foram copiados para nenhum arquivo do projeto.

| Arquivo | O que contém | Uso no NEXO | Restrições e observações |
|---|---|---|---|
| Checklist+160++2024.pdf (28 p.) | Lista de cerca de 500 conteúdos por área e disciplina. A relevância de cada item vem pela cor (legenda na p.1). Sociologia e Filosofia aparecem sem cor, com a nota de que todos os assuntos são importantes (p.25). | Fonte principal da relevância v1 (ADR-018). Os níveis foram extraídos pela cor do texto e do realce e mapeados manualmente para os 407 subtópicos da Matriz. | Cópia licenciada individualmente. O cronograma e as colunas R1–R5 não foram importados. A crítica do material à revisão espaçada não é tratada como fato. |
| intavanalises-de-provasenem-2025 (56 p.) | Dossiê de incidência por disciplina, tema e subtema, cobrindo todas as aplicações regulares desde 2016 (p.2). Inclui a lista de temas de redação de 2021–2025. | Fonte complementar da relevância v1: participação do tema dentro da disciplina, com denominador explícito por disciplina. | As proporções descrevem o passado e não são a probabilidade do próximo exame. |
| INT_AV_ANÁLISES…2023 e intavanalise…2024 | Mesmo formato, cumulativos. | Só conferência de estabilidade: Ecologia ficou entre 25% e 26% nas três edições. Não foram somados. | Mesma ressalva. |
| Hackeando as Competências do ENEM (19 p.) | Leitura comentada das competências de área, com dicas. | Princípio já registrado na síntese pedagógica: competência é aplicação do conteúdo e não substitui o estudo. Não gerou dados. | Marca d'água com dados pessoais de terceiro. Não reproduzir. |
| 250 Macetes ENEM (111 p.) | Estratégias de estudo e dicas por disciplina. | Princípios de aprendizagem ativa já sintetizados. Não gerou dados. | "Todos os direitos reservados". |
| Monstro.pdf e o PDF de nome longo (202 p., mesmo conteúdo) | Cronograma comercial de 169 tópicos. | **Não usado.** | Proíbe expressamente uso e compartilhamento sem permissão e traz marca de redistribuição por terceiro. Os direitos de uso são duvidosos. Recomenda-se não usar e confirmar a origem com os sócios. |
| Cartilha Redação a Mil 6.0 (200 p.) | 47 redações nota 1000 de 2023, com espelho e comentário. | Apenas referência de leitura. | O próprio documento limita o direito de uso dos textos a ele mesmo. Fica fora de RAG, benchmark e produto sem autorização. |
| cartilha_ufes_2026.pdf (73 p.) | Material de calouros. Inclui 8 redações (pp.17–24) do tema de 2025, com nota total e notas por competência, e dados de notas e perfil dos ingressantes. | 8 redações anonimizadas (nomes removidos) no conjunto **local** de benchmark (`data/private/essay-benchmark/ufes2026.jsonl`, ignorado pelo Git). Notas por competência entre 140 e 200, somando 900 a 980. | Uso restrito a medição interna. Não publicar, não usar como RAG e não enviar a APIs sem autorização específica. O conjunto cobre só uma faixa de nota. |

## Achados que afetaram o código
- **Notas oficiais por competência vêm em passos de 20** (por exemplo, 180), porque a nota final é a média de dois avaliadores (Cartilha do Participante 2026, p.9). O benchmark aceita esse formato para a nota humana. A IA continua corrigindo em passos de 40, como um avaliador.
- **Critério de discrepância do Inep** (Cartilha 2026, p.8: mais de 100 pontos no total ou mais de 80 em uma competência). É o critério central de concordância entre IA e avaliação humana (ADR-019).
- A distribuição de relevância pende para "alta" porque o próprio Checklist marca cerca de metade dos itens em vermelho, inclusive bases importantes por suas conexões.

## O que continua faltando
- Redações com notas intermediárias e baixas, com notas por competência conhecidas e direito de uso, para um benchmark representativo.
- Autorização para enviar redações privadas ao fornecedor de IA e para custear as chamadas.
- Validação dos sócios para a relevância v1 (regra, limiares e 68 divergências).
