# NEXO — Regras de Negócio

> Documento de referência das regras de negócio do sistema, extraídas do código atual.
> Cada regra tem um identificador (`RN-xx.yy`) e aponta o arquivo onde está implementada.
> Quando uma regra mudar, atualize o código, os testes e este documento juntos.

**Convenções**

- *Tentativa* = uma resposta do aluno a uma questão (`Attempt`).
- *Habilidade* = unidade de conteúdo avaliada (`Skill`, ex.: `fis-potencia`).
- *Revisão livre* = tentativa ou revisão marcada `free`: fica no histórico, mas **não altera** programação, XP nem diagnóstico (ver RN-00.03).
- Valores numéricos marcados como **experimentais** são parâmetros iniciais, a calibrar com dados reais.

---

## Sumário

0. [Princípios gerais](#0-princípios-gerais)
1. [Contas, papéis e acesso](#1-contas-papéis-e-acesso)
2. [Privacidade e LGPD](#2-privacidade-e-lgpd)
3. [Perfil e onboarding](#3-perfil-e-onboarding)
4. [Resposta a uma questão](#4-resposta-a-uma-questão)
5. [Evidência pedagógica](#5-evidência-pedagógica)
6. [Diagnóstico da causa do erro](#6-diagnóstico-da-causa-do-erro)
7. [Seleção da intervenção (A–G)](#7-seleção-da-intervenção-ag)
8. [Tutoria: C–P–E e socrático](#8-tutoria-cpe-e-socrático)
9. [Ciclo de Domínio](#9-ciclo-de-domínio)
10. [Questões gêmeas (comprovação)](#10-questões-gêmeas-comprovação)
11. [Radar de Domínio](#11-radar-de-domínio)
12. [Revisão espaçada](#12-revisão-espaçada)
13. [Estratégia de preparação](#13-estratégia-de-preparação)
14. [Recomendações, sessões e planos](#14-recomendações-sessões-e-planos)
15. [Detetive de Erros](#15-detetive-de-erros)
16. [Redação](#16-redação)
17. [Geração de questões](#17-geração-de-questões)
18. [Gamificação](#18-gamificação)
19. [Planos, limites e custos de IA](#19-planos-limites-e-custos-de-ia)
20. [Uso de IA (backend)](#20-uso-de-ia-backend)
21. [Pontos em aberto / inconsistências](#21-pontos-em-aberto--inconsistências)

---

## 0. Princípios gerais

| ID | Regra |
|---|---|
| RN-00.01 | Toda decisão pedagógica (diagnóstico, intervenção, domínio, revisão, próxima atividade) é tomada por **regras determinísticas e auditáveis**. A IA só fornece *evidências* (interpretação de justificativa) e *linguagem*; nunca controla o progresso sozinha. (`engine/learning.ts`) |
| RN-00.02 | Toda classificação é uma **hipótese revisável**: o aluno pode corrigir a classificação, pedir outra abordagem, adiar, interromper ou pedir a explicação direta. |
| RN-00.03 | Revisões/tentativas **livres** são registradas, mas não alteram agenda de revisão, XP, diagnóstico nem indicadores. (`srs.ts`, `gamification.ts`, `diagnosis.ts`) |
| RN-00.04 | Um **único acerto** nunca basta para declarar domínio. (`mastery.ts`) |
| RN-00.05 | Repetir a **mesma questão** não comprova aprendizagem: a comprovação exige questão **inédita** para o aluno. |
| RN-00.06 | Nenhum conteúdo é apresentado como validado sem validação confiável (questão gerada reprovada não é exibida como aprovada; IA sem fonte é sinalizada). |
| RN-00.07 | Sem backend/IA configurados, o sistema opera em **modo demonstrativo identificado** na interface. |

## 1. Contas, papéis e acesso

Arquivos: `server/auth.ts`, `server/learning.ts`, `server/db.ts`

| ID | Regra |
|---|---|
| RN-01.01 | A conta é criada por **apelido + senha**; não se coleta e-mail, CPF ou nome real. |
| RN-01.02 | Apelido: 2 a 20 caracteres (letras, números, espaço, `.`, `_`, `-`), **único** sem distinção de maiúsculas/minúsculas. |
| RN-01.03 | Senha: mínimo de **8 caracteres**; armazenada com scrypt + sal individual. |
| RN-01.04 | Papéis: **student** e **admin**. O papel admin só é concedido se o cadastro informar o código igual a `NEXO_ADMIN_CODE`. |
| RN-01.05 | Sessão por token aleatório; só o **hash** do token é armazenado; validade de **30 dias**. |
| RN-01.06 | Login: após **8 falhas** para o mesmo apelido, novas tentativas são bloqueadas por **15 minutos** (HTTP 429). Um login bem-sucedido zera o contador. |
| RN-01.07 | O estudante acessa **apenas os próprios dados**; o admin vê **apenas métricas agregadas** (usuários, ativos em 7 dias, tentativas, acertos, causas de erro). |
| RN-01.08 | Estado salvo no servidor: limite de **3 MB** por envio; no máximo as **5.000** tentativas mais recentes são sincronizadas; token/conta nunca são persistidos no estado. |
| RN-01.09 | Sem backend, o progresso fica apenas no navegador e o Perfil informa isso. |

## 2. Privacidade e LGPD

Arquivos: `server/privacy.ts`, `server/handlers.ts`, `server/learning.ts`

| ID | Regra |
|---|---|
| RN-02.01 | Antes de enviar texto à IA ou gravar logs, removem-se **e-mail, CPF, telefone e links**. |
| RN-02.02 | Logs usam **identificador pseudonimizado** (hash com sal do servidor), nunca o id original. |
| RN-02.03 | O aluno pode **exportar** todos os seus dados (conta, estado, tentativas). |
| RN-02.04 | O aluno pode **excluir a conta**; a exclusão remove em cascata sessões, tentativas e estado no servidor. |
| RN-02.05 | Ranking, perfil público e portfólio público são **opcionais** (configurações do aluno). |

## 3. Perfil e onboarding

Arquivos: `types.ts` (`Profile`), `store/useStore.ts`, `engine/learning.ts`

| ID | Regra |
|---|---|
| RN-03.01 | Objetivos possíveis: **ENEM, Vestibular, Olimpíadas, Combinada**. O objetivo altera prioridade de conteúdos (RN-13) e fase de preparação. |
| RN-03.02 | Novo perfil começa, por padrão, com **3 semanas de histórico fictício**; o aluno pode desmarcar e começar do zero. |
| RN-03.03 | O primeiro passo recomendado é o **diagnóstico inicial** (6 questões); enquanto não feito, é a recomendação principal. |
| RN-03.04 | **Autonomia** define o limite de dicas por questão: mais autonomia = 1; equilibrado = 3; mais apoio = 3. |
| RN-03.05 | **Pergunta de confiança**: *adaptativo* (padrão) oculta a pergunta em habilidades com domínio consistente; *sempre*; *nunca*. A resposta é sempre opcional. |

## 4. Resposta a uma questão

| ID | Regra |
|---|---|
| RN-04.01 | Confiança declarável: tenho certeza, tenho dúvida, chutei, não consegui, não informada. |
| RN-04.02 | Justificativa livre é opcional; ela é a principal fonte de evidência do diagnóstico. |
| RN-04.03 | Novas respostas dadas durante a correção ficam registradas como `retries` da tentativa original (não contam como novas tentativas). |
| RN-04.04 | Para cada resposta, o motor devolve uma **decisão pedagógica**: dificuldade, evidências, confiança do diagnóstico, intervenção e motivo, próxima atividade, necessidade de revisão e domínio antes/depois. (`learning.ts › decide`) |

## 5. Evidência pedagógica

Arquivo: `engine/evidence.ts`

**RN-05.01 — Classificação da evidência** (avaliada nesta ordem):

| Condição | Evidência |
|---|---|
| Confiança = não consegui | não resolveu |
| Acerto + chute | acerto por chute |
| Acerto + justificativa com raciocínio incorreto | acerto com raciocínio incorreto |
| Acerto + ≥ 2 dicas | acerto com dicas |
| Acerto + justificativa indica eliminação | acerto por eliminação |
| Acerto + certeza + ≥ 1 etapa correta na justificativa | compreensão demonstrada |
| Acerto + certeza | confiança declarada |
| Acerto + não informada | compreensão demonstrada (se ≥ 1 etapa) ou acerto sem confiança |
| Acerto + dúvida | compreensão demonstrada (se ≥ 2 etapas) ou acerto com dúvida |
| Erro de interpretação / alternativas plausíveis | erro interpretativo |
| Erro de fórmula / cálculo / unidade | erro procedimental |
| Erro de desatenção | erro por desatenção |
| Demais erros | erro conceitual |

**RN-05.02 — Peso no Radar de Domínio:** compreensão 1 · confiança 0,85 · sem confiança informada 0,75 · dúvida 0,6 · eliminação 0,55 · dicas 0,45 · raciocínio incorreto 0,25 · desatenção 0,2 · procedimental 0,1 · chute, conceitual, interpretativo, não resolveu 0.

**RN-05.03 — Acerto frágil:** dúvida, eliminação, dicas, raciocínio incorreto ou chute.

## 6. Diagnóstico da causa do erro

Arquivo: `engine/diagnosis.ts`

Causas possíveis: conceitual, interpretação, cálculo, fórmula, unidade, atenção, esquecimento, confusão entre alternativas, lacuna de pré-requisito, indeterminada.

| ID | Regra |
|---|---|
| RN-06.01 | **Acertos** não recebem causa; são classificados em: seguro, dúvida, tentativa (chute), sem confiança, raciocínio incorreto, com dicas (≥ 2). Confiança do diagnóstico: 0,8 (seguro) ou 0,65 (demais). |
| RN-06.02 | Em **erros**, cada fonte soma pontos para uma ou mais causas candidatas. |
| RN-06.03 | A **alternativa escolhida** é evidência fraca: peso máximo **0,35**. Sozinha nunca define a causa. |
| RN-06.04 | "Não consegui" (ou resposta em branco) soma 0,6 para *conceitual*. |
| RN-06.05 | Justificativa (≥ 6 caracteres): concepção equivocada explícita +0,7 *conceitual*; procedimento correto com erro em etapa +0,35 para a causa procedimental; cada sinal textual reconhecido +0,4 para a causa correspondente. |
| RN-06.06 | Dúvida declarada + alternativa plausível: +0,2 *confusão entre alternativas*. |
| RN-06.07 | **Esquecimento:** acerto sólido há ≥ 1 dia e habilidade em domínio provisório/consistente → +0,5; só acerto sólido anterior → +0,15. |
| RN-06.08 | **Erro recorrente:** causa que já ocorreu ≥ 2 vezes na habilidade → +0,2. |
| RN-06.09 | **Pré-requisito:** alternativa típica de lacuna no pré-requisito +0,3; pré-requisito em desenvolvimento com erros +0,35; pré-requisito com domínio consistente −0,4 (dependência improvável). |
| RN-06.10 | **Tempo** só reforça, nunca decide: resposta em < 20% do tempo esperado (Fácil 60 s, Média 90 s, Difícil 150 s) soma +0,2 *atenção*, apenas se já houver outro indício de atenção além da alternativa. |
| RN-06.11 | **Relato do aluno** (reclassificação) soma +1,0 à causa relatada (evidência forte). |
| RN-06.12 | **Sugestão da IA** soma 0,3 × confiança da IA. |
| RN-06.13 | **Decisão:** a causa mais pontuada é adotada se tiver **≥ 0,5** e superar a segunda por **≥ 0,1**. Caso contrário, a causa fica **indeterminada**, a confiança é limitada a 0,45 e o sistema pede uma justificativa curta (pergunta de 4 opções). Confiança máxima: 0,95. |

## 7. Seleção da intervenção (A–G)

Arquivo: `engine/learning.ts › selectIntervention`

Intervenções: **A** dica progressiva · **B** tutoria socrática · **C** microaula · **D** aula estruturada · **E** correção direta · **F** reconstrução do procedimento · **G** revisão de pré-requisitos.

| ID | Situação | Intervenção |
|---|---|---|
| RN-07.01 | Acerto seguro ou sem confiança informada | Nenhuma |
| RN-07.02 | Acerto com raciocínio incorreto | B |
| RN-07.03 | Demais acertos frágeis | E (explicação breve e opcional) |
| RN-07.04 | Interpretação ou confusão entre alternativas | B com **C–P–E** |
| RN-07.05 | Conceitual com ≥ 2 erros conceituais anteriores na habilidade e aula disponível | D |
| RN-07.06 | Conceitual sem conhecimento parcial (sem etapa correta, sem dúvida, sem dica) ou "não consegui" | C |
| RN-07.07 | Conceitual com conhecimento parcial | B |
| RN-07.08 | Cálculo ou atenção | E |
| RN-07.09 | Fórmula ou unidade | F |
| RN-07.10 | Esquecimento | A |
| RN-07.11 | Lacuna de pré-requisito | G |
| RN-07.12 | Indeterminada | A (menos presuntiva) + pedido de justificativa |
| RN-07.13 | As opções alternativas oferecidas ao aluno excluem D quando não há aula da habilidade e G quando ela não tem pré-requisitos. |

**RN-07.14 — Situações A–F (painéis e ciclo):** A = acerto seguro/sem confiança; B = demais acertos; C = interpretação/confusão; E = cálculo/fórmula/unidade; F = atenção; AMB = indeterminada; D = demais causas.

**RN-07.15 — Revisão após a resposta:** erro de cálculo/atenção → revisão em 2 dias; outros erros → 1 dia; acerto frágil → 1 dia; acerto seguro → segue o intervalo adaptativo.

**RN-07.16 — Próxima atividade:**
- erro por lacuna de pré-requisito → questão inédita (ou aula) do pré-requisito;
- erro por esquecimento → revisão antecipada + questão gêmea;
- outros erros → questão gêmea do mesmo conceito;
- acerto frágil → verificação com questão inédita;
- acerto seguro com domínio consistente → **desafio** (integração ou nível difícil), se houver;
- demais → avançar.

## 8. Tutoria: C–P–E e socrático

Arquivos: `engine/cpe.ts`, `engine/socratic.ts`, `server/handlers.ts` (política da IA)

| ID | Regra |
|---|---|
| RN-08.01 | **C–P–E** (Comando → Prova → Eliminação) executa só as etapas necessárias: se a justificativa já mostra leitura correta do comando, começa pela Prova. |
| RN-08.02 | O C–P–E encerra cedo quando o aluno declara que entendeu ou nomeia o erro da própria alternativa (extrapolação, generalização etc.). |
| RN-08.03 | Ao final, o C–P–E recomenda comprovar com **questão diferente**, não a mesma. |
| RN-08.04 | **Socrático:** uma pergunta por vez; etapas já demonstradas (inclusive na justificativa) não são perguntadas. |
| RN-08.05 | Se uma resposta cobre várias etapas, todas são marcadas como resolvidas. |
| RN-08.06 | Contradição com etapa já acertada é apontada ao aluno. |
| RN-08.07 | Após **2 tentativas** sem sucesso numa etapa (ou "não sei" sem pergunta mais simples disponível), o tutor explica curto e segue, rebaixando o nível para básico. |
| RN-08.08 | Pedido de resposta direta é atendido a qualquer momento. |
| RN-08.09 | IA tutora: no máximo ~120 palavras, no máximo uma pergunta por vez, não contradiz o gabarito da plataforma, não inventa fatos e sinaliza incerteza. Contexto limitado às **10 últimas mensagens** e mensagens de até 2.000 caracteres. |

## 9. Ciclo de Domínio

Arquivo: `engine/cycle.ts`

Etapas: Diagnóstico → Investigação → Ensino → Comprovação → Consolidação → Concluído. Status: ativo, adiado, concluído, interrompido.

| ID | Regra |
|---|---|
| RN-09.01 | Acerto seguro (A) **não** abre ciclo. Acerto frágil (B) só abre se houver evidência de dificuldade (verificação futura necessária). Demais situações abrem. |
| RN-09.02 | Ciclo AMB começa em **Investigação** (perguntar ao aluno); B vai direto para **Comprovação**; demais vão para **Ensino**. |
| RN-09.03 | O aluno pode **adiar**, **retomar** ou **interromper**; ao interromper, a comprovação fica para a revisão. |
| RN-09.04 | Comprovação conta como sucesso só com acerto **sem chute** e sem "não consegui". Sucesso → Consolidação e nível da gêmea sobe (máx. 3); falha → volta ao Ensino e nível desce (mín. 1). |
| RN-09.05 | **Duas** comprovações sem sucesso → recomenda microaula antes de nova tentativa. |
| RN-09.06 | Ciclo é **concluído** quando há acerto sem chute, não livre, na mesma habilidade, **≥ 20 h** após a comprovação. |

## 10. Questões gêmeas (comprovação)

Arquivo: `engine/twins.ts`

| ID | Regra |
|---|---|
| RN-10.01 | Níveis: **1** aplicação direta (gerada e validada) · **2** transferência contextual (curada do banco) · **3** integração com outra habilidade. |
| RN-10.02 | Nível inicial: D, E e F → 1; C, B e demais → 2. Depois segue o resultado da última comprovação (sobe/desce um nível). |
| RN-10.03 | A gêmea precisa ser **inédita** para o aluno e diferente da questão de origem. |
| RN-10.04 | Ordem de busca: nível 1 → gerada, banco N2, banco N3; nível 2 → banco N2, gerada, banco N3; nível 3 → banco N3, banco N2, gerada. |
| RN-10.05 | Questão gerada só é aceita se **aprovada** na validação (até 3 tentativas de geração). |
| RN-10.06 | Sem questão inédita e confiável, nada é apresentado: a comprovação é agendada para a revisão e o motivo é exibido. |

## 11. Radar de Domínio

Arquivo: `engine/mastery.ts`

Estados: **não estudado**, **em desenvolvimento**, **domínio provisório**, **domínio consistente**.

| ID | Regra |
|---|---|
| RN-11.01 | **Pontuação** = média ponderada das **5 últimas** tentativas; peso quadrático pela posição (mais recente pesa mais) e **×1,5** em questão inédita/gêmea; cada tentativa vale o peso da sua evidência (RN-05.02). |
| RN-11.02 | **Acerto sólido** = correto, até 1 dica, evidência de compreensão, confiança, dúvida, eliminação ou sem confiança informada (exclui chute e raciocínio incorreto). |
| RN-11.03 | **Domínio provisório:** pontuação ≥ 60% **e** (≥ 2 acertos sólidos **ou** acerto sólido em questão inédita com ≥ 2 tentativas). |
| RN-11.04 | **Domínio consistente:** provisório + acerto sólido em inédita + ≥ 2 acertos sólidos em **≥ 2 dias diferentes** + última tentativa correta. |
| RN-11.05 | **Acerto frágil:** a última tentativa é acerto e o último acerto teve evidência frágil → verificação priorizada. |
| RN-11.06 | **Regressão:** a habilidade esteve em domínio, errou depois e não houve acerto sólido posterior → possível esquecimento. |
| RN-11.07 | Domínio por disciplina = proporção **real** de habilidades em domínio (provisório ou consistente); não é percentual inventado. |
| RN-11.08 | Indicadores exibidos são contagens: seguros, com dúvida, chutes, erros, acertos em inéditas, dicas, revisões e retidos (acerto ≥ 1 dia após acerto sólido). |

## 12. Revisão espaçada

Arquivos: `engine/srs.ts`, `engine/review.ts`

### 12.1 Flashcards (parâmetros **experimentais**, editáveis no admin)

| ID | Regra |
|---|---|
| RN-12.01 | Classificação: **Não sei / Quase sei / Sei**. Facilidade inicial 2,3 (mín. 1,3, máx. 3,0). |
| RN-12.02 | **Não sei:** facilidade −0,2, lapso +1, cartão volta em **10 minutos**. |
| RN-12.03 | **Quase sei:** facilidade −0,05; intervalo × 1,2 (mín. 1 dia). |
| RN-12.04 | **Sei:** 1º acerto → 2 dias; 2º (após reinício) → 3 dias; depois intervalo × facilidade × bônus; facilidade +0,05. |
| RN-12.05 | **Bônus por atraso:** acertar revisão atrasada multiplica o intervalo em até **×1,5**. |
| RN-12.06 | Conteúdo ainda difícil para o aluno reduz o intervalo em até **30%**. |
| RN-12.07 | Intervalo máximo: **120 dias**. |
| RN-12.08 | Retenção prevista = e^(−t/S), com S proporcional ao intervalo e à facilidade (estimativa, não medida). |

### 12.2 Revisão de habilidades

| ID | Regra |
|---|---|
| RN-12.09 | Erro: lapso +1, facilidade −0,2 (mín. 1,3), revisão em 2 dias (desatenção/procedimental) ou 1 dia (demais). |
| RN-12.10 | Acerto não sólido: revisão no dia seguinte. |
| RN-12.11 | Acerto sólido: intervalo cresce ×1,3 (dúvida/eliminação), ×facilidade×1,2 (inédita) ou ×facilidade (demais); mínimo 2 dias (dúvida) ou 3 dias; facilidade +0,1 (inédita) ou +0,03. Máximo **90 dias**. |

### 12.3 Sessão intercalada

| ID | Regra |
|---|---|
| RN-12.12 | Fontes: habilidades com revisão vencida, até 2 padrões do Detetive de Erros, habilidades dominadas **sem contato há > 7 dias**, flashcards vencidos (menor retenção primeiro) e até 3 flashcards novos. |
| RN-12.13 | Para cada habilidade, prioriza questão **inédita**; se não houver, usa questão já vista há **> 3 dias**. |
| RN-12.14 | Cerca de **40%** da sessão são questões (mínimo 2); tamanho padrão 8 itens. |
| RN-12.15 | Intercalação: evitar dois itens seguidos da mesma disciplina e alternar cartões e questões. |

## 13. Estratégia de preparação

Arquivos: `engine/strategy.ts`, `data/incidence.ts`

| ID | Regra |
|---|---|
| RN-13.01 | **Incidência** (ENEM 2016–2025): alta = ≥ 10% da disciplina ou ≥ 75% do assunto líder; baixa = < 5% e < 35% do líder; demais = média. Sem dado = baixa. |
| RN-13.02 | **Peso de prioridade:** alta 1,35 · média 1,0 · baixa 0,7; + bônus de assunto-base de 0,05 por habilidade dependente (máx. 0,15). |
| RN-13.03 | Por objetivo: ENEM usa o peso integral; Vestibular e Combinada usam **metade do desvio** (1 + (w−1)/2); Olimpíadas não usam incidência (só teoria dos números recebe 1,35). |
| RN-13.04 | **Carga de exercícios** (min–teto por habilidade): exatas — alta 15–50, média 5–10, baixa 1–5; Humanas/Linguagens — alta 15–20, média 5–10, baixa sem bateria. |
| RN-13.05 | A bateria se encerra quando: feita a dose mínima **e** ≥ 4 acertos sólidos nas 5 últimas; ou ao atingir o **teto** (pendência volta na revisão). Máx. sugerido: 15 questões por dia na habilidade. |
| RN-13.06 | **Básico primeiro:** a próxima questão inédita vai da mais fácil para a mais difícil (sem questões de integração). |
| RN-13.07 | **Fases** (ENEM/Combinada, data estimada = 1º domingo de novembro): base (> 90 dias) · consolidação (≤ 90) · reta final (≤ 30) · dias de prova (≤ 2) · pós-prova (> 7 dias depois). Vestibular e Olimpíadas ficam sempre em *base*. |
| RN-13.08 | A estratégia altera **ordem e dose** do estudo, nunca o domínio. |

## 14. Recomendações, sessões e planos

Arquivos: `engine/recommend.ts`, `engine/learning.ts › recommendForSkill`

**RN-14.01 — Próxima recomendação (Início)**, primeira condição verdadeira:
1. diagnóstico inicial não feito;
2. ciclo ativo/adiado em Ensino ou Comprovação → comprovar;
3. ≥ 2 habilidades com revisão vencida → revisão intercalada;
4. último erro/chute sem acerto posterior na habilidade → questão gêmea;
5. ≥ 6 flashcards vencidos → revisar;
6. habilidade fraca → questão inédita ou microaula;
7. questão nunca feita → explorar; senão, simulado.

**RN-14.02 — Habilidades fracas:** em desenvolvimento (por peso de prioridade e erro mais recente), depois não estudadas das disciplinas marcadas como difíceis, depois em domínio provisório.

**RN-14.03 — Recomendação por habilidade** (prioridade base × peso de prioridade):

| Condição | Ação | Prioridade |
|---|---|---|
| Regressão | Revisão | 9 |
| Pré-requisito fraco | Revisar pré-requisito | 8 |
| Em desenvolvimento com ≥ 2 erros conceituais | Explicar | 7,5 |
| Em desenvolvimento | Praticar | 7 (5 se dose suficiente) |
| Revisão vencida | Revisão | 6 |
| Último acerto frágil | Praticar | 5,5 |
| Domínio provisório | Praticar (comprovar em inédita/outro dia) | 4 |
| Não estudada | Explicar | 3,5 |
| Consistente | Desafio (2) ou avançar (1) | 2 / 1 |

**RN-14.04 — Sessão cronometrada (5/10/20/40 min):** recuperação ativa ("recordar sem consultar") antes de reler, se o assunto já foi visto; questões da mais fácil para a mais difícil; questões feitas há < 7 dias vão para o fim. Reta final: sem conteúdo novo e mais questões. Dias de prova: só 5 flashcards leves. 20 e 40 min incluem questão gêmea; 40 min inclui um parágrafo de redação.

**RN-14.05 — Plano semanal:** minutos/dia = horas semanais ÷ 6 dias úteis (mín. 15). Seg–Qui: dois blocos de assuntos alternados (quarta: redação no bloco 2) + 5 min de flashcards; Sexta: pendências e revisão; Sábado: simulado (+20 min; rápido na base, com tempo de prova nas demais fases; revisão geral no último sábado do mês); Domingo: descanso. Dias de prova: só descanso.

**RN-14.06 — Plano de recuperação após pausa:** > 14 dias parado → carga 50%, 70%, 85% e depois 100%; 6–14 dias → 70%, 85%, 100%; 1º dia revisa até 10 flashcards; 4º dia, gêmeas dos erros anteriores; 7º dia, simulado rápido para recalibrar.

## 15. Detetive de Erros

Arquivo: `engine/detective.ts`

| ID | Regra |
|---|---|
| RN-15.01 | Padrão por **tipo de erro + habilidade** com ≥ 2 ocorrências. |
| RN-15.02 | Padrão por **tipo de erro** em várias disciplinas com ≥ 3 ocorrências (se ainda não reportado). |
| RN-15.03 | ≥ 2 acertos por **chute** geram alerta: não contam como domínio; recomenda gêmeas. |
| RN-15.04 | Padrões são ordenados por número de ocorrências e trazem uma sequência de estudo sugerida. |

## 16. Redação

Arquivos: `engine/essay.ts`, `server/handlers.ts`

| ID | Regra |
|---|---|
| RN-16.01 | Avaliação **formativa** nas competências C1–C5, notas em múltiplos de 40 (0–200), total 0–1000. Nunca apresentada como nota oficial. |
| RN-16.02 | Nenhum desconto sem trecho identificado no texto. Na IA, citações que não existem literalmente no texto são **descartadas**; competência < 200 sem citação é marcada como "sem sustentação". |
| RN-16.03 | Texto com < 150 palavras limita C1 a 120 (motor local). IA exige ≥ 60 palavras e aceita até 12.000 caracteres. |
| RN-16.04 | C5 avalia agente, ação, meio, finalidade e detalhamento (40 pontos cada; proposta vaga −40). |
| RN-16.05 | A correção não reescreve o texto pelo aluno (preserva autoria); o aluno reescreve e compara versões. |

## 17. Geração de questões

Arquivos: `engine/generator.ts`, `server/handlers.ts`

| ID | Regra |
|---|---|
| RN-17.01 | Validação automática (motor local): coerência do enunciado, unicidade da resposta, recálculo independente, unidades, distratores ligados a erros típicos, aderência ao exame. |
| RN-17.02 | Status: 0 falhas → **aprovada**; 1 falha → **revisão**; ≥ 2 → **rejeitada**. |
| RN-17.03 | Pedido do aluno: 1 a 5 questões por vez. |
| RN-17.04 | Questão gerada por **IA nunca entra como aprovada**: vai para **revisão humana** (painel admin) ou é rejeitada se tiver ≠ 5 alternativas, ≠ 1 correta, alternativas repetidas ou contexto < 40 caracteres. |
| RN-17.05 | Questões são originais; não se copiam provas nem se atribui autoria/fonte falsa. |

## 18. Gamificação

Arquivos: `engine/gamification.ts`, `data/demo.ts`

| ID | Regra |
|---|---|
| RN-18.01 | XP premia **aprendizagem demonstrada**, não volume. XP não pode ser comprado. |
| RN-18.02 | **Antifraude:** repetir a mesma questão em < 24 h ou depois de 3 vezes não gera XP. Revisão livre não gera XP. |
| RN-18.03 | Acerto com certeza e sem dicas: **10 XP**; outros acertos válidos: **6 XP**; chute, erro e "não consegui": 0 XP. |
| RN-18.04 | Acerto em questão inédita: **20 XP** se houve erro anterior na habilidade ("dificuldade corrigida"), senão **12 XP**. |
| RN-18.05 | Marco de domínio: provisório **25 XP**, consistente **50 XP**. |
| RN-18.06 | Regularidade: estudar em ≥ 3 dias diferentes nos últimos 7 → **10 XP**, no máximo uma vez por dia. |
| RN-18.07 | Teto diário de XP de prática: **120**; depois, a plataforma sugere pausa. (Bônus de inédita, marco e regularidade não entram no teto.) |
| RN-18.08 | Nível = ⌊√(XP/40)⌋ + 1. |
| RN-18.09 | Ligas por **pontos de domínio** (consistente = 2, provisório = 1): Iniciante 0 · Bronze 2 · Prata 4 · Ouro 7 · Diamante 11 · Mestre 16. |
| RN-18.10 | Ranking de escolas normalizado por **taxas**: 40% acerto + 25% crescimento (teto em 25%) + 20% participação + 15% regularidade. Só escolas com ≥ **15** alunos ativos são elegíveis. |

## 19. Planos, limites e custos de IA

Arquivos: `engine/billing.ts`, `store/useStore.ts` (cliente), `server/usage.ts` (servidor)

| ID | Regra |
|---|---|
| RN-19.01 | Planos: **Free** (grátis) e **Plus** (R$ 24,90/mês — assinatura **simulada**, sem cobrança). |
| RN-19.02 | Limites **mensais** por plano (cliente): Free — 30 mensagens de tutor, 2 correções de redação, 5 questões geradas; Plus — 600, 12 e 120. Contadores zeram a cada mês. O admin pode alterar os limites. |
| RN-19.03 | Limites **diários** por usuário (servidor, configuráveis por ambiente): tutor 60, redação 4, questões 10; orçamento de 150.000 tokens/dia por usuário. |
| RN-19.04 | Orçamento **mensal** de IA da plataforma: US$ 50 (configurável). Ao atingir, todas as chamadas de IA são recusadas. |
| RN-19.05 | Interpretação de justificativa por IA consome a cota de **tutor**. |
| RN-19.06 | Cada resposta de IA informa motor, consumo de tokens e custo estimado. |

## 20. Uso de IA (backend)

Arquivos: `server/handlers.ts`, `server/providers.ts`

| ID | Regra |
|---|---|
| RN-20.01 | Chaves de IA ficam **somente no servidor**. |
| RN-20.02 | Toda saída de IA é validada por esquema antes de chegar ao aluno; saída inválida/incompleta é erro. |
| RN-20.03 | Falhas retornam estruturadas (não configurado 503, limite 429, recusa 422, provedor 502) e o front cai no modo demonstrativo identificado. |
| RN-20.04 | Diagnóstico por IA: citação inexistente na justificativa é descartada e a confiança é limitada a **0,5**; justificativa com < 6 caracteres é rejeitada. |
| RN-20.05 | Intervenções pedagógicas são registradas em log pseudonimizado para avaliação posterior. |

---

## 21. Pontos em aberto / inconsistências

Encontrados ao levantar as regras; precisam de decisão de negócio.

| # | Ponto | Situação atual | Sugestão |
|---|---|---|---|
| 1 | **Dois sistemas de limite de IA** | Cliente aplica limites *mensais por plano* (RN-19.02); servidor aplica limites *diários fixos* sem saber o plano (RN-19.03). Um aluno Free pode passar do limite mensal chamando a API diretamente. | Gravar o plano na conta e aplicar o limite do plano no servidor (fonte única da verdade). |
| 2 | **Revisão livre e Radar de Domínio** | `skillMastery` não exclui tentativas `free`, mas o diagnóstico e os indicadores excluem — contraria RN-00.03. | Filtrar `free` também em `skillMastery`. |
| 3 | **Autonomia "mais apoio"** | Mesmo limite de dicas que "equilibrado" (3). | Definir diferença (ex.: mais apoio = dicas liberadas automaticamente ou explicação oferecida antes). |
| 4 | **Consentimento de menores (LGPD)** | Previsto no README, não implementado. | Definir fluxo de consentimento do responsável para < 18 anos. |
| 5 | **Bloqueio de login** | Cada falha estende o bloqueio por mais 15 min a partir da última falha; o contador fica só em memória (zera ao reiniciar o servidor). | Confirmar se é o comportamento desejado; persistir se necessário. |
| 6 | **Fase de preparação no Vestibular** | Sempre "base", sem data de prova. | Permitir que o aluno informe a data do vestibular. |
| 7 | **Plano Plus** | Pagamento simulado; não há regra de cancelamento, renovação, inadimplência ou downgrade. | Definir antes de integrar um provedor de pagamento. |
| 8 | **Teto de XP** | Bônus de inédita, marco e regularidade não respeitam o teto diário. | Confirmar se é intencional. |
