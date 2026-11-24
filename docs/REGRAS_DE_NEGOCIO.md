# NEXO — Regras de negócio (V0.2)

Regras extraídas do código. Ao mudar uma regra, atualize código, testes e este documento juntos. Todo valor numérico é **experimental** e configurável em Configurações → Parâmetros (`src/engine/params.ts`).

## 1. Princípios

| ID | Regra | Onde |
|---|---|---|
| RN-01.1 | O motor pedagógico decide por regras determinísticas e auditáveis. A IA só interpreta e comunica; não altera indicadores. | `engine/*`, `services/ai.ts` |
| RN-01.2 | O armazenamento guarda só fatos (respostas, explicações, textos). Domínio, indicadores e recomendações são sempre recalculados. | `store/useStore.ts` |
| RN-01.3 | Não avaliado ≠ desconhecido. Indicador sem dados aparece como "—", nunca como zero. | `indicators.ts` |
| RN-01.4 | Perfil novo começa vazio. Histórico fictício só entra por escolha explícita e fica identificado em todas as telas. | `demoStudent.ts`, `Layout.tsx` |
| RN-01.5 | Nada é apresentado como validado sem validação. Questões e aulas são marcadas como não revisadas. | `QuestionPlayer.tsx`, `Aula.tsx` |

## 2. Domínio (`engine/domain.ts`)

Quatro dimensões independentes, sem média ponderada.

| Dimensão | Demonstrada quando | Padrão |
|---|---|---|
| Resolução | acertos sólidos na janela de respostas recentes | 2 acertos e 60% das últimas 5 |
| Compreensão | explicação ativa autônoma demonstrada | 1 |
| Transferência | acerto em questão inédita de contexto novo (gêmea nível 2–3, integração ou em outro dia) | 1 |
| Retenção | acerto ou explicação após o intervalo | 7 dias |

| ID | Regra |
|---|---|
| RN-02.1 | Estados: não avaliado, em aprendizagem, provisório (resolução + compreensão + transferência), consolidado (+ retenção). |
| RN-02.2 | Chute, resposta assistida e explicação inconclusiva não comprovam. Acerto com dúvida vale como evidência parcial. |
| RN-02.3 | Em compreensão, transferência e retenção, a evidência mais recente prevalece: um insucesso desfaz a demonstração até nova comprovação (regressão). |
| RN-02.4 | Gêmea de nível 1 (aplicação direta) não conta como transferência. |
| RN-02.5 | Domínio curricular = habilidades consolidadas ÷ habilidades cadastradas. Cobertura, aproveitamento, domínio e retenção ficam separados. |

## 3. Resolução e correção

| ID | Regra | Onde |
|---|---|---|
| RN-03.1 | Durante resolução independente não há dicas, correção nem IA. O Professor de IA fica bloqueado com questão aberta, explicação em andamento, bateria, simulado, diagnóstico ou redação diagnóstica. | `useStore.ts` (`aiLock`) |
| RN-03.2 | Bateria, simulado e diagnóstico só viram evidência ao concluir; a correção vem depois, começando pelos erros fáceis. | `Atividade.tsx` |
| RN-03.3 | Simulado usa relógio real e não pausa. Diagnóstico e bateria pausam. | `Atividade.tsx` |
| RN-03.4 | CPE só em erros de questões médias e difíceis de Linguagens e Humanas. Fáceis e acertos: resolução direta. | `correctionRules.ts`, `cpe.ts` |
| RN-03.5 | Etapa do CPE demonstrada nas duas últimas correções pode ser ignorada. O resultado de cada etapa é registrado. | `difficulties.ts` |
| RN-03.6 | Formulário de causa (7 categorias, pulável) só em erros de Matemática e Natureza. O erro é registrado mesmo sem causa. | `Correction.tsx` |

## 4. Dificuldades e padrões (`engine/difficulties.ts`)

| ID | Regra |
|---|---|
| RN-04.1 | Dificuldade de bloco: ≥ 3 erros e ≥ 40% nas últimas 10 questões do bloco. |
| RN-04.2 | Padrão de erro: ≥ 3 ocorrências; autoclassificação pesa 1 e alternativa marcada, 0,35. Uma única questão nunca gera padrão. |

## 5. Recomendações e sessões (`engine/recommender.ts`)

| Tipo | Regra de entrada |
|---|---|
| Recuperação | dificuldade de bloco ou regressão |
| Revisão | habilidade com revisão vencida |
| Comprovação | resolução demonstrada com outra dimensão pendente |
| Aprofundamento | domínio provisório ou consolidado com atividade avançada disponível |
| Novo conteúdo | sem evidências e sem pré-requisito com erros; começa verificando o que o estudante já sabe |
| Redação | sinal de dificuldade em ≥ 2 textos, ou média ≤ 120 em ≥ 2 textos |

| ID | Regra |
|---|---|
| RN-05.1 | Composição não rígida: erros conceituais pedem aula; erros de aplicação pedem exemplo resolvido; recordação só se já houve acerto. |
| RN-05.2 | Prioridade = tipo × incidência × intensidade da evidência. No último mês não há conteúdo novo. |
| RN-05.3 | Adiar (1 dia), substituir (1 dia) e ignorar (7 dias) tiram da lista e mantêm a pendência registrada. |
| RN-05.4 | Acerto seguro na verificação inicial dispensa a aula. Toda etapa pode ser pulada. |

## 6. Explicação ativa (`engine/explain.ts`, `server/handlers.ts`)

| ID | Regra |
|---|---|
| RN-06.1 | Cinco critérios (0–2): correção, completude, coerência, relações e autonomia. |
| RN-06.2 | Avalia proposições na mesma frase; lista de palavras, cópia da referência ou concepção incorreta impedem a demonstração. |
| RN-06.3 | Texto consistente fora do alcance das regras é inconclusivo: não conta a favor nem contra. |
| RN-06.4 | A referência só aparece após o envio. Nova tentativa em 24 h é assistida e não comprova. |
| RN-06.5 | Com IA conectada, ela pontua critérios; o resultado é decidido por regra fixa (`verdictFrom`). Erro apontado sem trecho literal é descartado. |

## 7. Questões gêmeas (`engine/twins.ts`, `engine/generator.ts`)

| ID | Regra |
|---|---|
| RN-07.1 | Sempre inéditas. Níveis: aplicação direta, transferência contextual, integração. |
| RN-07.2 | Geradas por modelo paramétrico (não é IA) só entram se o gabarito for recalculado com sucesso; aparecem como não revisadas. |
| RN-07.3 | Sem questão confiável, nada é apresentado. |

## 8. Revisões

| ID | Regra | Onde |
|---|---|---|
| RN-08.1 | Memória: FSRS 4.5 experimental com pesos padrão. | `fsrs.ts` |
| RN-08.2 | Habilidades: intervalo próprio conforme resultado, incidência e proximidade da prova; atividade livre com evidência suficiente reagenda. | `skillReview.ts` |
| RN-08.3 | Recuperação ativa vem antes da releitura. | `RecallCard`, `Revisoes.tsx` |
| RN-08.4 | Estratégica: semanal, mensal e final, por incidência, fragilidade, retenção e pré-requisitos. | `skillReview.ts` |

## 9. Redação (`data/essaySkills.ts`, `engine/essayProfile.ts`)

| ID | Regra |
|---|---|
| RN-09.1 | Cinco competências com habilidades próprias. Só a última versão de cada texto conta como sinal. |
| RN-09.2 | Dificuldade recorrente: sinal em ≥ 2 dos últimos 3 textos. Comprovação: temas diferentes. |
| RN-09.3 | Notas são estimativas formativas. C2 fica limitada a 120 se faltar parte do recorte temático. |

## 10. Currículo, matriz e incidência

| ID | Regra | Onde |
|---|---|---|
| RN-10.1 | Área → disciplina → bloco → conteúdo → habilidade. Conteúdo sem habilidade aparece "em cadastramento" e não entra nos indicadores. | `curriculum.ts` |
| RN-10.2 | Matriz do Inep literal (30 competências, 120 habilidades). A associação é proposta do NEXO. | `matrix.ts` |
| RN-10.3 | Incidência de terceiros (Dossiê ENEM 2025, Aprova Total), identificada como não oficial. Sem dado, nada é estimado. | `incidence.ts` |

## 11. Pontos em aberto

- Diagnóstico: alvo de 180 questões; o banco atual oferece menos, e a interface informa quantas.
- Currículo, questões e aulas sem revisão pedagógica humana.
- Gamificação, rankings, planos e painel institucional retirados até definição.
- Critérios numéricos a calibrar com dados reais.
