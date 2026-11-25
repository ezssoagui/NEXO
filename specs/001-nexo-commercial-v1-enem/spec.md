# Feature Specification: Regras de Negócio da Plataforma Comercial NEXO (V1 — Foco 100% ENEM)

**Feature Branch**: `001-nexo-commercial-v1-enem`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "Especificação completa das Regras de Negócio da plataforma comercial NEXO (V1 — Foco 100% ENEM) — evolução do protótipo atual para plataforma SaaS 100% paga (assinatura Mensal ou Anual), reunindo banco de questões oficiais do ENEM (2009+, H1–H30, TRI), IA de correção de redação (C1–C5), IA de acompanhamento e ensino de resolução em tempo real (Metodologia NEXO), flashcards ENEM (SRS), acompanhamento de evolução (Radar de Domínio + Detetive de Erros), diagnóstico inicial + trilha adaptativa, simulados cronometrados estilo TRI, gamificação individual leve, governança/resiliência de IA em produção (sem modo demonstrativo) e painel administrativo operacional."

## Escopo e Limites do V1 *(Product Boundary)*

### Incluído no V1
- Foco exclusivo no **ENEM**: 4 áreas oficiais do conhecimento (Linguagens, Ciências Humanas, Ciências da Natureza e Matemática), **Matriz Oficial de Habilidades (H1–H30 por área)** e **Redação ENEM (C1–C5)**.
- Modelo comercial **100% pago** com **1 plano único completo** nas modalidades **NEXO Mensal** e **NEXO Anual** (com desconto), cotas mensais renováveis de IA e **pacotes avulsos** de créditos extras de IA.
- Contas por e-mail e senha (com apelido na interface pedagógica), pagamentos brasileiros (Cartão de Crédito recorrente/parcelado e Pix) e conformidade LGPD para menores com separação entre **Pagador** e **Estudante**.
- Diagnóstico inicial, trilha/plano semanal adaptativo e sessões cronometradas.
- Banco próprio de questões oficiais do ENEM (a partir de 2009) com habilidades oficiais (H1–H30) e parâmetros oficiais da TRI, sem pré-enriquecimento editorial em lote.
- IA de acompanhamento e ensino de resolução em tempo real (Metodologia NEXO: Diagnosticar → Investigar → Ensinar → Comprovar → Consolidar) com comprovação primária via outra questão oficial inédita da mesma habilidade/TRI.
- IA de correção de redação ENEM (texto digitado até 30 linhas, C1–C5, destaques no texto, proposta de intervenção e comparação de versões).
- Flashcards ENEM com repetição espaçada (baralhos prontos, flashcards automáticos de erros e flashcards manuais privados do aluno).
- Radar de Domínio baseado em evidências, Detetive de Erros e Simulados ENEM cronometrados com nota estimada estilo TRI e plano de recuperação.
- Gamificação individual leve (ofensiva diária, metas semanais e XP individual anti-abuso).
- Governança e resiliência de IA em produção (proibição de modo demonstrativo, provedor secundário automático, estorno/não desconto em falha e bloqueio seletivo ao zerar cota).
- Painel Administrativo operacional com métricas agregadas/pseudonimizadas, acompanhamento de custos/margem de IA e suporte operacional.

### Explicitamente Fora do V1 (Não-Escopo)
- Vestibulares tradicionais e Olimpíadas científicas.
- Plano gratuito permanente ou período de teste grátis (trial).
- Arena social, escolas, equipes, desafios multiplayer e rankings competitivos entre usuários.
- Microaulas extensas e Biblioteca de aulas gravadas ou escritas.
- Modo "Aprender Ensinando" (Feynman) e Portfólio público/compartilhável.
- Envio de foto ou documento de redação manuscrita com leitura óptica (OCR) — previsto para V2.
- Compartilhamento público ou comunidade de baralhos de flashcards criados por alunos.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Contratação, Ciclo de Vida da Assinatura e Proteção LGPD (Priority: P1)

Um estudante (ou seu responsável financeiro) cria uma conta com e-mail, senha e apelido, escolhe o plano **NEXO Mensal** ou **NEXO Anual**, conclui o pagamento por Cartão de Crédito ou Pix e recebe acesso imediato às ferramentas da plataforma. Ao longo do uso, o assinante consegue gerenciar sua assinatura (cancelar renovação, solicitar reembolso nos primeiros 7 dias conforme o Código de Defesa do Consumidor, regularizar pagamento pendente), bem como exercer seus direitos de privacidade (exportar ou excluir seus dados).

**Why this priority**: Sem a camada comercial 100% paga, o ciclo de vida confiável da assinatura e a conformidade legal (CDC e LGPD para menores), o produto não pode ser comercializado nem operar com segurança jurídica e financeira.

**Independent Test**: Pode ser testada integralmente simulando o cadastro de um estudante, contratação Mensal e Anual (Cartão e Pix), recebimento de confirmações de pagamento, exercício de arrependimento em até 7 dias, cancelamento após 7 dias, falha de renovação com tolerância de 3 dias e solicitação de exportação/exclusão de dados.

**Acceptance Scenarios**:

1. **Given** um visitante sem assinatura ativa que cria conta com e-mail, senha e apelido, **When** ele tenta acessar ferramentas de estudo sem concluir pagamento, **Then** o sistema não libera acesso gratuito nem trial e direciona para a escolha do plano NEXO Mensal ou NEXO Anual.
2. **Given** um comprador (o próprio estudante ou um responsável) que conclui o pagamento do plano Mensal (Cartão recorrente ou Pix) ou Anual (Cartão parcelado ou Pix), **When** o pagamento é confirmado pelo provedor financeiro, **Then** a assinatura passa ao estado `Ativa`, os dados fiscais/de pagamento ficam vinculados apenas ao registro do pagador (sem exigir CPF do estudante menor no perfil pedagógico) e as cotas mensais iniciais de IA são creditadas.
3. **Given** um assinante em sua primeira contratação dentro de 7 dias corridos, **When** ele solicita cancelamento por arrependimento (CDC), **Then** o sistema registra o estorno integral incondicional, encerra imediatamente o acesso às ferramentas pagas e muda a assinatura para `Reembolsada`.
4. **Given** um assinante ativo após 7 dias da contratação, **When** ele cancela a assinatura, **Then** a renovação automática é desativada, a assinatura passa para `Cancelada (Acesso até o Fim do Ciclo)` e o estudante mantém acesso completo até o último dia do período já pago.
5. **Given** um assinante cuja renovação falha no vencimento, **When** ocorre a falha de cobrança, **Then** a assinatura entra em `Em Tolerância` por 3 dias corridos com avisos claros e novas tentativas automáticas de cobrança; se não regularizada após os 3 dias, muda para `Suspensa`, bloqueia ferramentas de estudo, preserva 100% do histórico pedagógico e mantém acessíveis a regularização da assinatura e os direitos LGPD (exportação e exclusão de dados).
6. **Given** qualquer estudante autenticado (ativo ou suspenso), **When** solicita exportação de seus dados ou exclusão definitiva da conta, **Then** o sistema entrega os dados em formato portável ou executa a remoção definitiva respeitando obrigações legais/fiscais do pagador.

---

### User Story 2 - Banco de Questões Oficiais do ENEM e Ensino de Resolução por IA em Tempo Real (Priority: P1)

Um assinante ativo navega pelo banco de questões oficiais do ENEM (a partir de 2009), filtra por área, disciplina, habilidade oficial (H1–H30), ano, dificuldade TRI ou status de estudo e resolve questões. Quando erra, acerta com dúvida/chute ou solicita ajuda, a IA de acompanhamento atua em tempo real conduzindo a Metodologia NEXO (Diagnosticar → Investigar → Ensinar → Comprovar → Consolidar) e, ao final do ensino, comprova o aprendizado com outra questão oficial inédita do ENEM da mesma habilidade e dificuldade TRI compatível.

**Why this priority**: É o núcleo de valor diário da plataforma e o principal diferencial competitivo do NEXO frente a bancos de questões estáticos.

**Independent Test**: Pode ser testada filtrando questões oficiais do ENEM por habilidade H1–H30 e dificuldade TRI, errando uma questão no modo guiado, percorrendo a intervenção em tempo real (com possibilidade de corrigir classificação, adiar ou interromper) e validando a entrega automática de outra questão oficial inédita da mesma habilidade/TRI para comprovação.

**Acceptance Scenarios**:

1. **Given** um assinante ativo na área de Questões, **When** aplica filtros por área, disciplina, habilidade oficial H1–H30, ano (2009+), faixa de dificuldade TRI ou status (não respondida, errada, acerto frágil), **Then** o sistema exibe apenas questões oficiais do ENEM correspondentes com enunciado, textos-base, imagens, alternativas e metadados oficiais.
2. **Given** um assinante que responde incorretamente ou marca baixa confiança (dúvida/chute) em uma questão, **When** inicia o acompanhamento pedagógico, **Then** a IA analisa a resposta em tempo real (sem depender de análise pré-escrita na questão), propõe uma hipótese de causa de erro (interpretação, conceitual, procedimental/cálculo, fórmula, unidade, desatenção ou lacuna de pré-requisito) e permite que o aluno confirme, corrija a classificação, adie ou interrompa a intervenção.
3. **Given** uma causa de erro identificada na intervenção, **When** o estudante avança para a etapa de ensino, **Then** o sistema conduz a estratégia adequada: diálogo C–P–E adaptativo para interpretação, tutoria socrática (uma pergunta por vez, com explicação direta após tentativas ou a pedido) para lacuna conceitual, ou correção guiada de etapa para erro procedimental.
4. **Given** um estudante que concluiu a etapa de ensino de uma habilidade `Hx`, **When** o sistema inicia a etapa de comprovação, **Then** seleciona automaticamente outra questão oficial inédita do ENEM da mesma habilidade `Hx` e dificuldade TRI compatível, sem consumir cota de geração de questão.
5. **Given** um estudante que já respondeu todas as questões oficiais disponíveis daquela habilidade `Hx`, **When** o sistema precisa apresentar uma questão de comprovação, **Then** gera uma questão inédita por IA em tempo real, valida sua consistência (enunciado, 5 alternativas e gabarito único) antes de exibi-la e a rotula explicitamente como "Questão inédita gerada por IA".

---

### User Story 3 - Correção de Redação ENEM por IA (C1–C5) e Reescrita Versionada (Priority: P1)

Um assinante escolhe um tema de redação (oficial de edições anteriores ou atual no formato ENEM), escreve seu texto em um editor no padrão ENEM (até 30 linhas com salvamento automático de rascunho) e envia para correção por IA. O estudante recebe uma nota estimada de 0 a 1000 dividida nas 5 competências oficiais (C1–C5), destaques no texto, análise dos 5 elementos da proposta de intervenção e sugestões práticas, podendo reescrever e comparar versões.

**Why this priority**: A correção de redação por IA é um dos principais fatores de decisão de compra em plataformas de preparação para o ENEM e o recurso de maior impacto no custo unitário de IA.

**Independent Test**: Pode ser testada selecionando um tema, digitando uma redação dentro do limite de 30 linhas, submetendo para correção, verificando o desconto exato de 1 crédito de redação, validando a estrutura completa C1–C5 + aviso de estimativa formativa e submetendo uma reescrita para verificar o histórico comparativo e o novo consumo de 1 crédito.

**Acceptance Scenarios**:

1. **Given** um assinante ativo com saldo de correção de redação disponível, **When** escolhe um tema, digita sua redação (até 30 linhas) e confirma o envio, **Then** o sistema consome exatamente 1 crédito de redação (primeiro da cota mensal; se zerada, do saldo avulso) e retorna a avaliação completa nas 5 competências (C1–C5), soma total (0–1000), destaques posicionados no texto, diagnóstico dos 5 elementos da proposta de intervenção e sugestões acionáveis.
2. **Given** qualquer correção de redação exibida na plataforma, **When** o estudante visualiza o resultado, **Then** o sistema exibe aviso claro e permanente de que a nota e a correção são estimativas formativas geradas por IA e não substituem a banca oficial do INEP.
3. **Given** uma redação já corrigida, **When** o estudante cria uma versão reescrita e a envia para nova correção por IA, **Then** o sistema consome 1 novo crédito de redação, preserva todas as versões anteriores e permite comparar lado a lado evolução de texto e pontuações C1–C5.
4. **Given** um assinante que ainda está redigindo o texto, **When** pausa ou fecha o editor antes de enviar, **Then** o rascunho é salvo automaticamente sem consumir créditos de correção.

---

### User Story 4 - Diagnóstico Inicial, Trilha Adaptativa Semanal e Acompanhamento de Evolução (Priority: P2)

No primeiro acesso após ativar a assinatura, o estudante preenche seu perfil de estudo e conclui um diagnóstico inicial. Com base nos resultados e em cada nova atividade realizada, o sistema gera e recalcula uma trilha semanal adaptativa com sessões cronometradas e exibe a evolução real no **Radar de Domínio** (por habilidade H1–H30) e no **Detetive de Erros** (padrões recorrentes de falha).

**Why this priority**: Transforma o acervo de questões em um método estruturado de evolução mensurável, essencial para retenção mensal e renovação do plano anual.

**Independent Test**: Pode ser testada criando um assinante recém-ativado, completando o diagnóstico inicial, verificando a geração da trilha semanal priorizando lacunas críticas, respondendo questões com diferentes níveis de confiança e confirmando a atualização do Radar de Domínio (incluindo diferenciação entre acerto confiante e acerto frágil) e do Detetive de Erros.

**Acceptance Scenarios**:

1. **Given** um assinante que acabou de ativar sua primeira assinatura, **When** conclui o perfil de estudo (objetivo/curso, horas semanais, dificuldades) e o diagnóstico inicial, **Then** o sistema gera um plano semanal adaptativo priorizando habilidades de maior impacto e menor domínio, permitindo iniciar sessões cronometradas diretamente da trilha.
2. **Given** um estudante que acumula tentativas em uma habilidade H1–H30, **When** o sistema calcula seu estado no Radar de Domínio, **Then** classifica a habilidade em estados progressivos (`Não estudado` → `Em desenvolvimento` → `Domínio provisório` → `Domínio consistente`), distinguindo acerto confiante de acerto frágil (dúvida, dica, chute) e sinalizando regressão caso o desempenho caia em avaliações posteriores.
3. **Given** um estudante que erra múltiplas questões ao longo da semana, **When** acessa o Detetive de Erros, **Then** visualiza o agrupamento das causas de erro mais frequentes (ex.: interpretação, conceitual, cálculo/unidade, desatenção) com recomendação direta de treino corretivo.

---

### User Story 5 - Flashcards ENEM (SRS) e Simulados Cronometrados estilo TRI (Priority: P2)

O assinante consolida a memória de longo prazo usando Flashcards ENEM com repetição espaçada (oriundos de baralhos prontos por área/habilidade, gerados automaticamente a partir de erros em questões/redações ou criados manualmente de forma privada) e testa seu preparo real em Simulados ENEM cronometrados, recebendo estimativa formativa de nota estilo TRI e plano automático de recuperação.

**Why this priority**: Repetição espaçada e simulados cronometrados fecham o ciclo de consolidação e mensuração do preparo real para os dois dias de prova do ENEM.

**Independent Test**: Pode ser testada revisando um cartão de baralho pronto, errando uma questão para verificar a criação automática de flashcard, criando/editando um flashcard manual privado, e concluindo um simulado cronometrado para validar a nota estimada estilo TRI e o plano de recuperação gerado.

**Acceptance Scenarios**:

1. **Given** um assinante na área de Flashcards, **When** estuda um cartão e registra sua avaliação (`Errei`, `Com dúvida` ou `Com segurança`), **Then** o sistema recalcula a próxima data de revisão conforme o algoritmo adaptativo de repetição espaçada e atualiza o calendário de revisões e o indicador de retenção.
2. **Given** um estudante que erra uma questão ou recebe apontamento crítico em redação, **When** o ciclo de correção é finalizado, **Then** o sistema disponibiliza automaticamente um flashcard vinculado àquela habilidade/lacuna no acervo do estudante, que também pode criar, editar ou excluir seus próprios flashcards privados (sem compartilhamento público).
3. **Given** um assinante que inicia um Simulado ENEM cronometrado por área ou dia de prova, **When** finaliza ou encerra o tempo, **Then** o sistema corrige o simulado usando os parâmetros TRI das questões oficiais aplicadas, apresenta estimativa formativa de nota (explicitamente rotulada como estimativa estilo TRI, não oficial do INEP) e gera um plano de recuperação focado nas habilidades erradas de menor dificuldade TRI (maior potencial de ganho rápido).

---

### User Story 6 - Governança de Cotas de IA, Pacotes Avulsos e Resiliência em Produção (Priority: P2)

O assinante acompanha de forma transparente o saldo de suas cotas mensais de IA e créditos avulsos. Caso atinja o limite mensal, apenas os recursos dependentes de IA são pausados (com opção clara de compra de pacote avulso), mantendo todo o restante da plataforma liberado. Caso ocorra instabilidade técnica no provedor primário de IA, o sistema aciona automaticamente um provedor secundário e nunca cobra créditos quando a entrega falha — sem jamais recorrer a respostas simuladas ("modo demonstrativo") em produção.

**Why this priority**: Garante sustentabilidade financeira (margem sobre custo de IA) e confiança comercial de quem paga mensalidade/anuidade esperando IA real e cobrança justa.

**Independent Test**: Pode ser testada consumindo 100% da cota mensal de um assinante para validar o bloqueio seletivo + compra de pacote avulso, e simulando falha do provedor primário (acionamento transparente do secundário) e falha total (mensagem de indisponibilidade sem débito de cota e sem fallback heurístico fake).

**Acceptance Scenarios**:

1. **Given** um assinante no plano Mensal ou Anual, **When** inicia um novo ciclo mensal (mesmo durante a vigência do plano Anual), **Then** suas cotas mensais de IA são restabelecidas para o valor padrão do plano sem acumular sobras do mês anterior, preservando eventuais créditos de pacotes avulsos ainda não consumidos conforme sua regra de validade.
2. **Given** um assinante com cota mensal e saldo avulso zerados para determinado recurso de IA (ex.: redação ou tutoria), **When** tenta acionar esse recurso de IA, **Then** o sistema bloqueia apenas o recurso de IA exibindo oferta de pacote avulso, enquanto Banco de Questões ENEM, Simulados, Flashcards, Radar de Domínio e Histórico permanecem 100% funcionais.
3. **Given** um assinante com cota zerada que compra um pacote avulso de créditos extras, **When** o pagamento do pacote é confirmado, **Then** os créditos extras ficam disponíveis imediatamente e são consumidos apenas após o esgotamento da cota mensal vigente.
4. **Given** uma requisição de correção de redação ou tutoria em produção em que o provedor primário de IA falha, excede o tempo limite ou retorna saída inválida, **When** o erro é detectado, **Then** o sistema aciona automaticamente o provedor secundário de IA; se todos os provedores falharem, informa indisponibilidade temporária clara, não utiliza modo demonstrativo simulado e garante que nenhum crédito seja descontado do assinante.

---

### User Story 7 - Gamificação Individual Leve e Painel Administrativo Operacional (Priority: P3)

O estudante acompanha sua constância diária por meio de ofensiva (streak), metas semanais configuráveis e XP individual (sem comparações sociais ou rankings públicos). Em paralelo, a equipe operacional (`admin`) acompanha a saúde do negócio, o consumo e custo de IA, a estabilidade dos provedores de IA, métricas pedagógicas agregadas e pseudonimizadas, e realiza ações operacionais de suporte e manutenção de conteúdo.

**Why this priority**: A gamificação individual fortalece o hábito de estudo com baixo risco operacional, enquanto o Painel Admin é indispensável para controlar margem de IA, qualidade do banco e suporte a assinantes.

**Independent Test**: Pode ser testada validando incremento de streak/XP em atividades reais (e bloqueio de abuso repetitivo), e acessando o Painel Admin com conta `admin` (garantindo bloqueio a contas `student`) para inspecionar métricas financeiras/IA/pedagógicas pseudonimizadas e realizar ajuste manual auditável de crédito de IA.

**Acceptance Scenarios**:

1. **Given** um assinante ativo que completa atividades válidas de estudo (questões, revisões de flashcards, redação ou simulado), **When** conclui a atividade, **Then** recebe XP individual conforme regras anti-abuso (sem premiar cliques repetitivos na mesma questão no mesmo dia) e atualiza sua ofensiva diária e progresso na meta semanal.
2. **Given** um operador autenticado com papel `admin`, **When** acessa o Painel Administrativo, **Then** visualiza indicadores consolidados de assinaturas (ativas, em tolerância, canceladas, suspensas, reembolsos CDC), consumo e custo estimado de IA por recurso, margem estimada por usuário, taxa de erro/acionamento do provedor secundário e métricas pedagógicas agregadas pseudonimizadas.
3. **Given** um operador `admin` atendendo um chamado de suporte ou revisão de acervo, **When** concede ajuste/estorno manual de crédito de IA a um assinante ou registra correção em questão/tema/baralho sinalizado por usuários, **Then** a ação é aplicada imediatamente e registrada em trilha de auditoria administrativa.

---

### Edge Cases

- **Notificação de pagamento duplicada ou fora de ordem**: Se o provedor financeiro enviar duas confirmações para o mesmo pagamento ou enviar um evento antigo após um cancelamento mais recente, o sistema deve processar de forma idempotente (sem duplicar créditos avulsos nem reativar uma assinatura já cancelada/reembolsada por evento atrasado).
- **Falha de IA durante correção de redação**: Se todos os provedores de IA falharem após o clique em "Enviar para correção", o texto digitado deve permanecer íntegro no rascunho, o crédito de redação não pode ser debitado (ou deve ser estornado automaticamente) e nenhuma correção simulada pode ser exibida.
- **Esgotamento de questões oficiais em uma habilidade H1–H30**: Se o estudante já tiver respondido todas as questões oficiais disponíveis de uma habilidade específica durante a comprovação pós-erro, o sistema aciona a geração em tempo real por IA com validação estrutural obrigatória e selo explícito de "Gerada por IA"; se a geração ou validação falhar, informa ao aluno sem marcar falsamente a habilidade como comprovada nem debitar cota.
- **Solicitação de reembolso CDC (7 dias) após uso intenso de IA**: O direito legal de arrependimento em até 7 dias corridos da primeira contratação deve ser honrado integralmente (estorno total + encerramento imediato do acesso), registrando o evento para monitoramento antifraude no Painel Admin (por exemplo, impedindo reutilização abusiva recorrente do mesmo pagador/e-mail para ciclos consecutivos de arrependimento).
- **Estudante menor de 18 anos com pagador responsável**: O responsável pode pagar usando seu próprio e-mail fiscal/CPF no checkout sem sobrescrever o login pedagógico do estudante; comunicações financeiras (recibos, falhas de cobrança, renovação) vão ao contato financeiro cadastrado, enquanto o perfil pedagógico do menor mantém coleta mínima.
- **Upgrade de Mensal para Anual durante ciclo ativo**: Se um assinante Mensal decidir migrar para o plano Anual, o sistema deve calcular a transição de forma transparente (aplicando crédito proporcional do ciclo restante ou iniciando o anual ao término do mês pago, sem cobrança dupla simultânea) e preservar todo histórico e saldo avulso.
- **Cancelamento durante a janela de tolerância de 3 dias**: Se o usuário cancelar enquanto estiver em `Em Tolerância` por falha de cobrança, interrompem-se as retentativas imediatamente e a assinatura transita para `Suspensa` (histórico preservado, sem nova cobrança).
- **Redação fora dos limites de entrada**: Texto vazio, abaixo do mínimo razoável para avaliação ou acima do limite de 30 linhas padrão ENEM deve ser validado antes do envio, impedindo consumo indevido de crédito de correção e orientando o estudante no editor.
- **Questão oficial do ENEM anulada pelo INEP ou com imagem indisponível**: Questões anuladas oficialmente devem ser marcadas como tal e excluídas de simulados/comprovações automáticas; questões sinalizadas por alunos por erro de imagem/formatação entram na fila operacional do Admin.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Domínio 1 — Contas, Papéis e LGPD
- **FR-001**: O sistema MUST exigir cadastro e autenticação por e-mail e senha (com fluxo completo de recuperação de senha) para acesso à plataforma, mantendo um apelido configurável para exibição na interface pedagógica.
- **FR-002**: O sistema MUST suportar dois papéis distintos com controle estrito de autorização: `student` (acesso restrito aos próprios dados pedagógicos, assinatura e privacidade) e `admin` (acesso ao Painel Administrativo operacional e métricas agregadas/pseudonimizadas).
- **FR-003**: O sistema MUST separar os dados cadastrais/fiscais do **Pagador** (que podem pertencer a um pai ou responsável financeiro) do perfil pedagógico do **Estudante**, não exigindo CPF nem documentos sensíveis do estudante menor de 18 anos para uso das ferramentas de estudo.
- **FR-004**: O sistema MUST garantir a qualquer estudante autenticado (independentemente do status da assinatura) o exercício dos direitos da LGPD: visualização do uso de dados, exportação completa do próprio histórico em formato portável e solicitação de exclusão definitiva da conta/dados pessoais pedagógicos.
- **FR-005**: O sistema MUST pseudonimizar identificadores pessoais em logs operacionais de IA e relatórios analíticos agregados exibidos no Painel Admin.

#### Domínio 2 — Modelo Comercial, Assinaturas e Pagamentos
- **FR-006**: O sistema MUST operar em modelo 100% pago, sem plano gratuito permanente e sem período de trial grátis, bloqueando o acesso às ferramentas de estudo para contas sem assinatura em estado válido (`Ativa`, `Cancelada (Acesso até o Fim do Ciclo)` ou `Em Tolerância`).
- **FR-007**: O sistema MUST oferecer um plano único completo em duas modalidades de cobrança: **NEXO Mensal** e **NEXO Anual** (com preço promocional/desconto sobre o valor mensal equivalente).
- **FR-008**: O sistema MUST suportar pagamento via Cartão de Crédito (recorrente no Mensal e parcelado no Anual) e Pix, sincronizando o ciclo de vida da assinatura a partir das confirmações do provedor de pagamentos de forma idempotente e resistente a eventos duplicados ou fora de ordem.
- **FR-009**: O sistema MUST implementar a seguinte máquina de estados da assinatura:
  - `Sem Assinatura` → `Ativa` (após confirmação de pagamento);
  - `Ativa` → `Reembolsada` (solicitação de arrependimento em até 7 dias corridos da primeira contratação, com estorno integral e bloqueio imediato do acesso);
  - `Ativa` → `Cancelada (Acesso até o Fim do Ciclo)` (cancelamento após 7 dias, sem renovação futura e mantendo acesso até o fim do período pago);
  - `Cancelada (Acesso até o Fim do Ciclo)` → `Suspensa` (ao término do período pago);
  - `Ativa` → `Em Tolerância` (falha na cobrança de renovação, com duração de 3 dias corridos e retentativas automáticas);
  - `Em Tolerância` → `Ativa` (pagamento regularizado dentro dos 3 dias);
  - `Em Tolerância` → `Suspensa` (após 3 dias sem regularização ou cancelamento manual durante a tolerância);
  - `Suspensa` → `Ativa` (mediante nova contratação/regularização de pagamento).
- **FR-010**: Quando a assinatura transitar para `Suspensa`, o sistema MUST preservar integralmente todo o histórico pedagógico do estudante (questões respondidas, Radar de Domínio, flashcards, redações e simulados) para retomada sem perdas caso reative a assinatura, mantendo acessíveis apenas a área de regularização/assinatura e os controles de privacidade LGPD.

#### Domínio 3 — Cotas de IA, Pacotes Avulsos e Resiliência em Produção
- **FR-011**: Cada assinatura ativa MUST conceder cotas mensais definidas por categoria de uso de IA: (a) correções de redação, (b) interações de acompanhamento/ensino de resolução e (c) geração eventual de questão de comprovação.
- **FR-012**: As cotas mensais de IA MUST ser renovadas a cada ciclo de 30 dias/mês civil de assinatura tanto no plano Mensal quanto no plano Anual, sem acúmulo de saldo mensal não utilizado para o mês seguinte.
- **FR-013**: O sistema MUST permitir que assinantes com acesso vigente comprem **pacotes avulsos** de créditos extras de IA; os créditos avulsos MUST ser consumidos somente após o esgotamento da cota mensal vigente da respectiva categoria.
- **FR-014**: Ao atingir saldo zero (cota mensal + saldo avulso) em uma categoria de IA, o sistema MUST bloquear exclusivamente o recurso de IA correspondente e apresentar opção clara de compra de pacote avulso, mantendo 100% liberados o Banco de Questões ENEM, Simulados, Flashcards, Radar de Domínio e Histórico.
- **FR-015**: O sistema MUST proibir a ativação de qualquer "modo demonstrativo" ou resposta heurística simulada em ambiente de produção pago.
- **FR-016**: Em falha técnica, tempo excedido ou resposta estruturada inválida do provedor primário de IA, o sistema MUST tentar automaticamente um provedor secundário de IA antes de reportar erro ao estudante.
- **FR-017**: Se todos os provedores de IA falharem ou não entregarem uma saída válida, o sistema MUST exibir mensagem transparente de indisponibilidade temporária e garantir que nenhum crédito seja descontado (ou efetuar estorno automático imediato caso tenha havido reserva prévia).

#### Domínio 4 — Onboarding, Diagnóstico e Trilha Adaptativa
- **FR-018**: No primeiro acesso após ativação da assinatura, o sistema MUST conduzir o estudante pelo cadastro de perfil pedagógico (curso/meta, disponibilidade semanal em horas e dificuldades percebidas) e por um diagnóstico inicial cobrindo as 4 áreas do ENEM.
- **FR-019**: Com base no diagnóstico inicial e nas tentativas contínuas, o sistema MUST gerar e recalcular automaticamente uma trilha/plano semanal adaptativo priorizando habilidades H1–H30 com maior lacuna e relevância no ENEM, oferecendo sessões cronometradas de prática.

#### Domínio 5 — Banco de Questões Oficiais do ENEM e Ensino de Resolução (Metodologia NEXO)
- **FR-020**: O sistema MUST manter acervo próprio persistido de questões oficiais do ENEM (a partir de 2009), contemplando enunciado, textos-base, imagens, 5 alternativas, gabarito oficial, ano, área, disciplina, idioma (quando aplicável), código oficial da habilidade (`H1–H30`) e parâmetros oficiais da TRI (dificuldade, discriminação e acerto ao acaso), sem exigir pré-enriquecimento editorial em lote.
- **FR-021**: O sistema MUST permitir filtrar e praticar questões por área, disciplina, habilidade H1–H30, ano, faixa de dificuldade TRI, status do estudante (não respondida, errada, acerto frágil) e modo de resolução (prática livre, tutoria guiada ou sessão cronometrada).
- **FR-022**: O sistema MUST excluir automaticamente questões oficialmente anuladas pelo INEP das rotas de diagnóstico, simulado e comprovação pós-erro, sinalizando seu status caso consultadas no acervo.
- **FR-023**: Em cada tentativa de resolução, o sistema MUST registrar a resposta escolhida, o nível de confiança declarado (ou inferido por dicas/tempo) e classificar a evidência pedagógica correspondente (diferenciando acerto confiante de acerto frágil e tipos de erro).
- **FR-024**: Quando o estudante errar, acertar com fragilidade ou solicitar ajuda, o sistema MUST acionar a IA de ensino de resolução em tempo real conduzindo o ciclo **Diagnosticar → Investigar → Ensinar → Comprovar → Consolidar**:
  - Propor hipótese de causa de erro revisável (interpretação, conceitual, procedimental/cálculo, fórmula, unidade, desatenção ou lacuna de pré-requisito);
  - Permitir ao estudante corrigir a causa sugerida, adiar a intervenção ou interrompê-la sem penalidade;
  - Aplicar a estratégia adequada (diálogo C–P–E adaptativo para interpretação, tutoria socrática progressiva para lacuna conceitual, ou correção guiada de etapa para erro procedimental).
- **FR-025**: Na etapa de **Comprovação** pós-intervenção, o sistema MUST selecionar prioritariamente outra questão oficial inédita do ENEM da mesma habilidade (`H1–H30`) e faixa de dificuldade TRI compatível, sem consumir crédito de geração de questão.
- **FR-026**: Somente quando o estudante já tiver esgotado todas as questões oficiais válidas e inéditas disponíveis para aquela habilidade `H1–H30`, o sistema MUST poder gerar uma questão inédita de comprovação via IA em tempo real, condicionada a validação estrutural prévia (enunciado coerente, 5 alternativas distintas e gabarito único verificável) e exibição com rótulo explícito de "Gerada por IA".

#### Domínio 6 — IA de Correção de Redação ENEM (C1–C5)
- **FR-027**: O sistema MUST disponibilizar biblioteca de temas de redação (temas oficiais de edições anteriores do ENEM e temas atuais no formato ENEM) e editor exclusivo para texto digitado no padrão ENEM (limite máximo de 30 linhas, contador de linhas/palavras e salvamento automático de rascunho).
- **FR-028**: Antes de submeter à IA e debitar crédito, o sistema MUST validar que a redação não está vazia, atende ao mínimo de extensão avaliável e respeita o limite de 30 linhas.
- **FR-029**: Cada correção de redação concluída com sucesso pela IA (seja envio inicial ou reescrita de uma redação anterior) MUST consumir exatamente 1 crédito de redação e retornar:
  - Nota estimada de 0 a 1000 e notas individuais das 5 competências oficiais (`C1` a `C5`, em múltiplos de 40 pontos de 0 a 200);
  - Justificativas e sugestões práticas por competência;
  - Destaques vinculados a trechos do texto (erro, ponto de atenção e ponto positivo);
  - Verificação explícita dos 5 elementos da proposta de intervenção na C5 (agente, ação, meio/modo, finalidade e detalhamento).
- **FR-030**: Toda tela de resultado de redação MUST exibir aviso visível de que a nota e os comentários constituem avaliação formativa produzida por IA e não substituem a correção oficial da banca do INEP.
- **FR-031**: O sistema MUST manter o histórico versionado de todas as redações e reescritas do estudante, permitindo comparação visual entre versões e evolução das notas C1–C5.

#### Domínio 7 — Flashcards ENEM (SRS), Evolução e Simulados
- **FR-032**: O sistema MUST disponibilizar módulo de Flashcards ENEM com repetição espaçada adaptativa (avaliações `Errei`, `Com dúvida` e `Com segurança`), calendário de revisões pendentes e indicador de retenção por área/habilidade.
- **FR-033**: O sistema MUST suportar exatamente três origens de flashcards no V1: (a) baralhos curados do sistema organizados por área e habilidade ENEM, (b) flashcards gerados automaticamente a partir de erros em questões e pontos de melhoria em redações, e (c) flashcards criados, editados e excluídos manualmente de forma privada pelo próprio estudante.
- **FR-034**: O sistema MUST manter o **Radar de Domínio** por habilidade oficial H1–H30 nos estados `Não estudado`, `Em desenvolvimento`, `Domínio provisório` e `Domínio consistente`, incorporando pesos de evidência (acerto frágil não promove sozinho para consistente) e detecção de regressão.
- **FR-035**: O sistema MUST consolidar o **Detetive de Erros** apresentando ao estudante a distribuição histórica das suas causas de erro e recomendando ações diretas de correção.
- **FR-036**: O sistema MUST permitir a realização de Simulados ENEM cronometrados (por área ou no formato de dia de prova oficial), calculando nota estimada formativa estilo TRI com base nos parâmetros TRI das questões aplicadas, sinalizando claramente que se trata de estimativa formativa e gerando automaticamente um plano de recuperação pós-simulado.

#### Domínio 8 — Gamificação Individual Leve e Painel Administrativo
- **FR-037**: O sistema MUST oferecer gamificação estritamente individual composta por ofensiva diária (streak), metas semanais configuráveis pelo estudante e XP individual com regras anti-abuso (ex.: não pontuar novamente repetições imediatas da mesma questão ou cliques sem resolução válida), sem rankings sociais, equipes ou escolas.
- **FR-038**: O sistema MUST disponibilizar Painel Administrativo exclusivo para usuários `admin` exibindo:
  - Saúde comercial (assinaturas por estado, proporção Mensal × Anual, renovações, inadimplências e reembolsos CDC);
  - Governança de IA (volume consumido por categoria, custo estimado de IA, margem estimada por assinante, taxa de falha e frequência de acionamento do provedor secundário);
  - Métricas pedagógicas agregadas e pseudonimizadas (engajamento, causas de erro predominantes, evolução média de domínio);
  - Ferramentas operacionais (gestão de temas de redação e baralhos prontos, triagem de questões oficiais reportadas por estudantes por erro de imagem/texto e ajuste/estorno manual auditável de créditos de IA).

---

### Key Entities *(include if feature involves data)*

- **Estudante (StudentAccount)**: Identidade pedagógica com e-mail único, credencial de acesso, apelido exibido na interface, papel (`student` ou `admin`), perfil de estudo (curso-alvo, horas semanais, ano da prova) e preferências de privacidade LGPD.
- **Pagador (PayerProfile)**: Entidade financeira separada do perfil pedagógico (podendo ser o próprio estudante maior de idade ou um responsável), vinculada ao identificador externo no provedor de pagamento para fins de cobrança, recibos e cumprimento fiscal/CDC.
- **Assinatura (Subscription)**: Vínculo comercial entre conta, pagador e modalidade (`NEXO Mensal` ou `NEXO Anual`), contendo estado atual na máquina de estados, datas de início/término de ciclo, histórico de eventos financeiros idempotentes, data-limite de arrependimento CDC (7 dias) e marcador de janela de tolerância (3 dias).
- **Carteira de Cotas de IA (AIQuotaLedger)**: Controle por assinante do ciclo mensal vigente (cotas mensais por categoria com data de reinício e sem acúmulo) somado ao saldo de créditos de **Pacotes Avulsos** comprados, acompanhado de registro auditável de débitos, estornos automáticos por falha técnica e ajustes manuais de suporte.
- **Questão Oficial ENEM (OfficialEnemQuestion)**: Item oficial de edição do ENEM (2009+) contendo enunciado, textos-base, mídia/imagens, 5 alternativas, gabarito oficial, ano, área, disciplina, idioma, habilidade oficial (`H1–H30`), parâmetros TRI (`a`, `b`, `c`) e status editorial (ativa, anulada pelo INEP, reportada para revisão de formatação).
- **Tentativa e Ciclo de Domínio (Attempt & MasteryCycle)**: Registro de cada resposta do estudante (alternativa, acerto, confiança, tempo, modo, evidência pedagógica) e do ciclo de intervenção NEXO associado (hipótese de causa de erro, reclassificações do aluno, estágio atual e resultado da questão oficial ou gerada de comprovação).
- **Redação e Versão (Essay & EssayVersion)**: Trabalho de redação vinculado a um tema ENEM, contendo rascunho atual e histórico imutável de versões submetidas com suas respectivas avaliações C1–C5, destaques no texto, análise da proposta de intervenção e crédito consumido.
- **Flashcard e Estado de Revisão (Flashcard & CardReviewState)**: Cartão de estudo (origem `curado`, `erro_automatico` ou `manual_privado`) vinculado a área/habilidade ENEM, com estado de repetição espaçada (intervalo, facilidade, próxima revisão, histórico de acertos/lapsos).
- **Simulado (SimulationSession)**: Execução cronometrada de um conjunto de questões oficiais ENEM, contendo tempo decorrido, respostas, nota formativa estimada estilo TRI e plano de recuperação gerado.
- **Registro de Auditoria e Saúde de IA (AIOperationLog)**: Registro pseudonimizado de cada execução de IA (categoria, provedor utilizado, se houve acionamento do secundário, sucesso/falha, custo estimado e crédito debitado/estornado) para governança financeira e operacional.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001 (Conversão e Ativação Comercial)**: 90% dos novos pagantes concluem cadastro, pagamento (Cartão ou Pix) e acesso à tela de onboarding/diagnóstico em menos de 4 minutos após a confirmação do pagamento.
- **SC-002 (Integridade Financeira e LGPD)**: 100% das notificações de pagamento duplicadas ou fora de ordem são processadas sem duplicação de créditos nem alteração indevida de status, e 100% dos estudantes menores conseguem usar a plataforma sem que o perfil pedagógico armazene CPF.
- **SC-003 (Acurácia na Cobrança de Cotas de IA)**: 100% das falhas completas de provedores de IA resultam em 0 crédito debitado (ou estorno automático concluído em até 1 minuto) e 0 ocorrências de respostas simuladas ("modo demonstrativo") exibidas a assinantes pagantes em produção.
- **SC-004 (Continuidade de Estudo sem Cota de IA)**: 100% das funcionalidades não dependentes de IA (Banco de Questões ENEM, Simulados, Flashcards, Radar de Domínio e Histórico) permanecem operacionais quando um assinante atinge saldo zero de IA.
- **SC-005 (Eficiência da Comprovação Oficial)**: Pelo menos 95% das etapas de comprovação pós-erro utilizam outra questão oficial inédita do ENEM da mesma habilidade H1–H30 e dificuldade TRI compatível, sem acionar geração de questão por IA.
- **SC-006 (Experiência de Correção de Redação)**: 95% das redações submetidas recebem avaliação completa nas 5 competências (C1–C5), destaques no texto e análise da proposta de intervenção em até 45 segundos, com aviso explícito de avaliação formativa presente em 100% dos resultados.
- **SC-007 (Evolução Pedagógica Mensurável)**: Assinantes que concluem o diagnóstico inicial e completam ao menos 4 ciclos de intervenção NEXO por semana elevam pelo menos 2 habilidades H1–H30 de estado no Radar de Domínio nos primeiros 30 dias de uso.
- **SC-008 (Retenção e Consolidação)**: Pelo menos 70% dos assinantes ativos no primeiro mês completam pelo menos 1 simulado cronometrado ou 3 sessões semanais de revisão de flashcards dentro dos primeiros 30 dias.
- **SC-009 (Sustentabilidade de Margem)**: O Painel Admin permite acompanhar em tempo real o custo médio de IA por assinante mensal/anual e identificar qualquer usuário ou categoria cujo consumo exceda os limites de margem definidos antes do fechamento do ciclo mensal.

---

## Assumptions

- **Valores comerciais e volumes exatos de cota são parâmetros configuráveis de negócio**: A especificação define as regras estruturais (1 plano único Mensal/Anual, renovação mensal de cotas sem acúmulo, consumo de 1 crédito por correção/reescrita de redação, pacotes avulsos pós-cota). Os valores nominais iniciais (por exemplo, preço Mensal/Anual, percentual de desconto do Anual e teto exato de créditos mensais por categoria — como 8 correções de redação/mês, 300 interações de tutoria/mês e 20 gerações eventuais/mês) serão definidos na parametrização comercial e ajustáveis operacionalmente sem alterar a regra de negócio.
- **Validade de créditos de pacotes avulsos**: Assume-se como padrão razoável que créditos comprados em pacotes avulsos permanecem válidos enquanto a assinatura estiver ativa (ou por até 12 meses, o que ocorrer primeiro) e são sempre consumidos somente após o saldo mensal do ciclo vigente zerar.
- **Recorrência via Pix**: Como o Pix recorrente depende do suporte do provedor/instituição ou pagamento avulso a cada renovação, assume-se que assinaturas mensais pagas via Pix geram cobrança antecipada de renovação antes do vencimento (com lembretes e a mesma janela de tolerância de 3 dias), enquanto no plano Anual o Pix quita os 12 meses à vista mantendo a renovação mensal das cotas de IA.
- **Disponibilidade do acervo ENEM oficial**: Assume-se que o acervo oficial do ENEM (2009 em diante) será populado e mantido internamente na plataforma a partir de fontes públicas oficiais/abertas do ENEM e dos microdados públicos de itens do INEP (`H1–H30` e parâmetros TRI), sem dependência em tempo de execução de serviços externos para exibir questões aos assinantes.
- **Política de consentimento de menores (LGPD)**: Assume-se que o termo de uso e a política de privacidade incluem cláusula explícita de ciência/consentimento do responsável legal para estudantes menores de 18 anos, reforçada no fluxo de pagamento quando o pagador é o responsável.
- **Evolução incremental do protótipo atual**: Os módulos fora do escopo do V1 que existem hoje no protótipo (Arena social, Microaulas/Biblioteca, Aprender Ensinando, Portfólio e filtros de Vestibular/Olimpíadas) serão ocultados ou descontinuados na versão comercial V1 para manter foco total na proposta ENEM.
