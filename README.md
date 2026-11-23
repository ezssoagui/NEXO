# NEXO — Aprender. Evoluir. Conquistar.

Protótipo navegável de alta fidelidade de uma plataforma brasileira de preparação para ENEM, vestibulares e olimpíadas.
**Todos os dados são fictícios e as funções de "IA" são simuladas localmente por regras** — sinalizadas na interface.

## Executar

Requisitos: Node.js 18+.

```bash
npm install
npm run dev        # http://localhost:5173 (modo demonstrativo de IA)
npm test           # 49 testes do núcleo pedagógico e da integração de IA
npm run build      # site estático em dist/
```

**IA real (opcional):** em um segundo terminal, com uma chave da Anthropic:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm run server   # backend em :8787; o Vite encaminha /api
```

Sem chave, o backend responde 503 e a interface continua no **modo demonstrativo, identificado** (selo "IA em modo demonstrativo" no topo e motor indicado em cada resposta). Veja `.env.example`.

Todo estudante começa com **dados zerados**. Os perfis de exemplo (Lia, Caio, Iara) apenas preenchem o cadastro.

## Metodologia: Diagnosticar → Investigar → Ensinar → Comprovar → Consolidar

| Situação (hipótese revisável) | Intervenção |
|---|---|
| A — acerto com confiança | Feedback curto e avanço; sem justificativa obrigatória |
| B — acerto frágil (dúvida, eliminação, dicas, chute, raciocínio incorreto) | Explicação opcional e breve; verificação futura priorizada só se houver evidência de dificuldade |
| C — erro de interpretação | C–P–E adaptativo (só as etapas necessárias; encerra quando o aluno compreende) |
| D — erro conceitual | Tutor socrático adaptativo (uma pergunta por vez, reconhece o que o aluno já sabe, detecta contradições, explica curto após 2 tentativas, resposta direta a pedido); microaula se a dificuldade for recorrente |
| E — erro procedimental | Identifica a etapa (cálculo, fórmula, unidade, procedimento) e o aluno corrige a própria resposta |
| F — desatenção | Só com evidência (resposta muito rápida, justificativa correta ou histórico de acertos); lembrete breve |
| Ambígua | Pergunta curta de 4 opções e reclassifica |

O aluno pode **corrigir a classificação**, **adiar** ou **interromper** a intervenção. Depois do ensino vem a **comprovação** com questão gêmea inédita: nível 1 (aplicação direta, gerada e validada), nível 2 (transferência contextual, curada), nível 3 (integração com outra habilidade, 6 questões novas). Sem questão inédita confiável, nada é apresentado como validado. A **consolidação** usa revisão espaçada adaptativa por cartão e por habilidade.

### Novos módulos (`src/engine/`)

| Arquivo | Responsabilidade |
|---|---|
| `evidence.ts` | Evidência pedagógica de cada resposta (12 tipos) e seus pesos |
| `intervention.ts` | Motor de intervenção: situações A–F/ambígua, hipótese com confiança e justificativa, reclassificação |
| `concepts.ts` | Base curada de etapas de raciocínio, concepções equivocadas e leitura de justificativas |
| `cpe.ts` | Diálogo C–P–E adaptativo |
| `socratic.ts` | Tutor socrático adaptativo |
| `twins.ts` | Questões gêmeas em 3 níveis, priorizando questões revisadas |
| `cycle.ts` | Ciclo de Domínio (funções puras) |
| `review.ts` | Sessão de revisão intercalada (flashcards + questões inéditas, de recuperação, de erros recorrentes e de conteúdos antigos) |
| `mastery.ts` / `srs.ts` | Reescritos: Radar baseado em evidências (acerto frágil, regressão) e intervalos adaptativos |
| `server/` | Backend de IA: provedor substituível, saídas estruturadas validadas (zod), limites e custos, logs pseudonimizados, remoção de dados pessoais |

## Jornadas testadas na versão 1 (automação Playwright)

| Jornada | Caminho |
|---|---|
| A — Aprendizado | Cadastro → diagnóstico (6 questões) → plano adaptativo → questão q01 no modo tutoria → erro (tutora aponta "grandeza constante") → nova tentativa → correção em 9 partes → questão gêmea gerada → Radar de Domínio sobe (ex.: Em desenvolvimento → Domínio provisório) |
| B — Redação | Redação → tema → texto → correção demonstrativa (C1–C5, destaques) → "Explique meu erro" → reescrever → comparar versões |
| C — Revisão | Flashcards → baralho → Errei / Com dúvida / Com segurança → explicação do reagendamento → calendário e Mapa de Esquecimento |
| D — Gamificação | Arena → escola fictícia → equipe → desafio → questões → receber XP → ranking normalizado |
| E — Comercial | Planos → comparação Free × Plus → assinatura simulada (sem cobrança) |

## Arquitetura

```
src/
  types.ts                 contratos de dados
  data/                    conteúdo demonstrativo (30 questões, 12 aulas, 40 flashcards, 5 temas, 3 redações, escolas, desafios)
  engine/                  lógica pura (sem React)
    mastery.ts             Radar de Domínio (regras explicáveis)
    srs.ts                 repetição espaçada (caixas de Leitner) + previsão de retenção
    recommend.ts           motor de recomendações, sessões 5/10/20/40, plano semanal e de recuperação
    detective.ts           Detetive de Erros
    generator.ts           gerador paramétrico de questões + validador + Questão Gêmea
    essay.ts               avaliador heurístico de redação (5 competências) e laboratório C3
    tutor.ts               Nexo Tutor (6 modos, dicas em 3 níveis, Aprender Ensinando)
    gamification.ts        XP com antifraude, níveis, ligas por domínio, ranking normalizado de escolas
    billing.ts             planos, limites e custo simulado de IA
  services/ai.ts           contratos TutorService/EssayService/QuestionGenService (DemoProvider ativo; RemoteProvider esqueleto)
  store/                   estado persistente (zustand + localStorage) e perfis fictícios
  components/ pages/       interface (React + TypeScript + Tailwind, Recharts, lucide-react)
```

## O que funciona de verdade × o que é simulado

**Funciona de verdade (no navegador):** navegação, cadastro, diagnóstico, resolução de questões com diagnóstico de erro por alternativa, modo tutoria com nova tentativa, questões gêmeas (geradas com novos dados para 5 conteúdos), Radar de Domínio, Detetive de Erros, repetição espaçada e calendário, sessões cronometradas, simulados com resultado e plano de recuperação, XP/níveis/ligas/desafios, limites de uso por plano, controle de limites no admin, exportação e exclusão de dados. Tudo persiste em `localStorage`.

**Simulado / demonstrativo:**
- Sem o backend configurado, *IA Tutora, correção de redação e gerador* usam regras e conteúdo curado, **não modelos de linguagem**, e a interface indica isso. As intervenções dentro da tela de resolução (C–P–E, socrático, correção de etapa) são sempre do motor curado local, propositalmente determinístico e testável.
- Estimativas de redação (0–1000) e no estilo TRI são formativas e aproximadas, não notas oficiais.
- Escolas, equipes, adversários, resultados de turma e métricas do admin são fictícios.
- Assinatura, upload de foto/PDF (sem OCR), compartilhamento de portfólio e trilhas: sem serviço externo.
- Nenhuma questão é de prova anterior; todas são originais e rotuladas como tal.

## Publicação futura (orientações)

1. **Site estático agora:** `npm run build` e publicar `dist/` (Vercel, Netlify, Cloudflare Pages). Usa `HashRouter`, então não precisa de configuração de rotas.
2. **Backend:** API (ex.: Next.js route handlers ou Node/Fastify) com PostgreSQL. Os tipos em `src/types.ts` servem de base para o esquema; o estado do `store/` vira tabelas (attempts, card_states, essays, xp_events…).
3. **IA:** implementar `RemoteProvider` em `services/ai.ts` chamando `/api/ai/*`. **As chaves ficam só no servidor**, que verifica plano/limites, aplica a política pedagógica de `engine/tutor.ts`, valida a saída (mesmo validador de `generator.ts`) e registra consumo.
4. **Autenticação e papéis:** estudante/admin com controle de acesso por papel; consentimento do responsável para menores (LGPD), coleta mínima, exclusão de conta.
5. **Pagamentos:** provedor certificado (sem armazenar dados de cartão), webhooks atualizando o plano.
6. **Revisão editorial:** a fila de revisão do painel administrativo vira um fluxo persistido; conteúdo de IA só é publicado após aprovação humana.

## Limitações conhecidas

- O avaliador de redação reconhece padrões textuais (conectivos, elementos da proposta, desvios frequentes); não avalia qualidade argumentativa como um corretor humano.
- A tutora cobre bem 7 conteúdos (potência elétrica, velocidade média, energia, equilíbrio químico, hormônios, porcentagem, interpretação/C-P-E); fora disso avisa que não tem segurança em vez de inventar.
- O gerador paramétrico cobre 5 conteúdos de cálculo.
- O histórico de simulados fica em uma chave separada do `localStorage` (`nexo-sims`).

## Perfis de acesso

A plataforma tem dois perfis: **estudante** e **administração**. A revisão humana de conteúdo gerado por IA (questões e materiais) fica no painel administrativo.

## Metodologia NEXO de Aprendizagem Adaptativa (versão atual)

### NEXO Learning Engine (`src/engine/learning.ts`)
Recebe a questão, a resposta, a confiança, a justificativa, o tempo e o histórico, e devolve uma **decisão pedagógica estruturada e auditável**: dificuldade identificada, evidências usadas, confiança do diagnóstico, intervenção recomendada com o motivo, próxima atividade, necessidade de revisão e atualização do domínio. A decisão aparece para o aluno em "Decisão pedagógica". As regras são determinísticas e testadas. A IA, quando conectada, só fornece evidências (interpretação de justificativa) e linguagem; ela não controla o progresso.

| Serviço | Arquivo |
|---|---|
| Diagnóstico (10 causas de erro) | `engine/diagnosis.ts` |
| Decisão e intervenções A–G | `engine/learning.ts` |
| Tutoria (C–P–E, socrático) | `engine/cpe.ts`, `engine/socratic.ts`, `engine/concepts.ts` |
| Domínio (indicadores interpretáveis, regressão, recomendações por habilidade) | `engine/mastery.ts`, `engine/learning.ts` |
| Revisão (algoritmo configurável, Mapa de Revisão, sessão intercalada) | `engine/srs.ts`, `engine/review.ts` |

**Diagnóstico:** soma evidências da justificativa, da confiança, do histórico, dos pré-requisitos, das revisões anteriores, do tempo (com cautela), do relato do aluno e, opcionalmente, da IA. A alternativa escolhida é evidência fraca (peso máximo 0,35) e **nunca define a causa sozinha**. Se a evidência não basta, a causa fica "indeterminada" e o sistema pede uma justificativa curta.

**Intervenções:** A dica progressiva · B tutoria socrática (com C–P–E nos erros de interpretação e de confusão entre alternativas) · C microaula · D aula estruturada · E correção direta · F reconstrução do procedimento · G revisão de pré-requisitos. O aluno pode pedir outra abordagem, corrigir a causa, adiar, interromper ou pedir a explicação direta. A quantidade de dicas segue a preferência de autonomia definida no Perfil.

### Persistência, autenticação e LGPD (`server/`)
O backend guarda os dados num banco SQLite nativo do Node (`node:sqlite`, sem dependências; requer Node 22.5 ou mais recente). Ele grava contas por apelido e senha (scrypt, sem e-mail ou documento), sessões por token (só o hash é armazenado), cada tentativa do aluno (inclusive as respostas dadas durante a correção) e o estado completo. Cada aluno acessa apenas os próprios dados, e o administrador vê apenas métricas agregadas. Exportar e excluir a conta apaga também os dados do servidor. Para criar uma conta de administrador, defina `NEXO_ADMIN_CODE` e informe o código no cadastro.

```bash
NEXO_ADMIN_CODE=um-codigo npm run server     # com ANTHROPIC_API_KEY=... para IA real
```

Sem o backend, o progresso fica só no navegador, e o Perfil mostra isso.

### Como testar os 8 cenários (pela interface)
| Cenário | Passos |
|---|---|
| A — acerto seguro | Questão q13 → alternativa B, "Tenho certeza" → "Correto", sem intervenção |
| B — acerto com dúvida | q17 → B, "Tenho dúvida" → explicação breve opcional; a decisão mostra revisão em ~1 dia |
| C — interpretação | q23 → C, "Tenho dúvida", justificativa "Fiquei em dúvida entre a C e a D" → C–P–E |
| D — conceitual | q01 → B, "Tenho certeza", justificativa "A potência cai pela metade" → microaula + verificação + questão inédita (com "Tenho dúvida", vira tutoria socrática) |
| E — cálculo | q02 → E, justificativa "R constante, usei U²/R e multipliquei por 8" → correção da etapa |
| F — pré-requisito | Erre q38 (A) e depois q09 (A) → revisão de pré-requisito (proporção), com verificação rápida |
| G — esquecimento | Depois de dominar uma habilidade (acertos em dias diferentes, incluindo uma questão inédita), erre uma questão dela → dica progressiva e revisão antecipada |
| H — avançado | Com domínio consistente, um acerto não mostra explicação, a confiança deixa de ser perguntada e a recomendação passa a "Desafio mais difícil" |

Os testes automatizados (`npm test`) cobrem todos esses cenários, além do diagnóstico, da revisão, da tutoria, do ciclo de domínio, da redação, da IA e do backend.
