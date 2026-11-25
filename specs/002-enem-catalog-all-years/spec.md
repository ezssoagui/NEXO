# Feature Specification: Catálogo Oficial do ENEM (Todos os Anos), Paginação de 25 Itens e Exibição de Imagens

**Feature Branch**: `001-nexo-commercial-v1-enem`

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "vamos implementar a logica de puxar as questões enem dessa vez de todos os anos. além disso pra evitar sobrecarga deixe um limite de 25 questões por pagina na aba questões. se quiser ver outras muda de pagina, como um catalogo. além disso questões que tem imagem precisam exibila. avalie"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navegar pelo Catálogo Paginado de Questões Oficiais do ENEM (Priority: P1)

Como estudante preparando-me para o ENEM, quero navegar pela aba **Questões** como um catálogo organizado com exatamente **25 questões por página**, filtrando por ano, área, disciplina, habilidade, dificuldade ou situação do meu histórico, para explorar milhares de questões oficiais de todos os anos sem lentidão ou sobrecarga na tela.

**Why this priority**: Com a entrada de todos os anos do ENEM (de 2009 em diante, superando 2.500 questões), carregar a lista inteira travaria a experiência do estudante e sobrecarregaria o carregamento. A paginação de 25 itens por página é o alicerce para tornar o acervo completo utilizável no dia a dia.

**Independent Test**: Pode ser testado de forma independente com um acervo contendo mais de 60 questões oficiais de múltiplos anos: ao abrir a aba Questões, apenas 25 itens são exibidos na página 1; ao avançar para a página 2 e página 3, os conjuntos seguintes de até 25 itens aparecem corretamente; ao aplicar um filtro (por exemplo, um ano específico), a listagem retorna à página 1 mostrando o novo total filtrado.

**Acceptance Scenarios**:

1. **Given** que existem mais de 25 questões oficiais cadastradas abrangendo múltiplos anos do ENEM, **When** o estudante acessa a aba Questões, **Then** o sistema exibe exatamente 25 questões na página 1, informa o total de questões encontradas e a paginação disponível (ex.: "Exibindo 1–25 de 2.600 questões" e "Página 1 de 104").
2. **Given** que o estudante está na página 1 do catálogo, **When** ele clica em "Próxima" ou seleciona um número de página específico (ex.: página 4), **Then** o sistema carrega exclusivamente as até 25 questões correspondentes àquela página, atualiza o indicador de página ativa e rola suavemente para o topo da lista.
3. **Given** que o estudante está na página 5 com todos os anos listados, **When** ele aplica um filtro (ano, área, habilidade, dificuldade ou status no histórico), **Then** a paginação reinicia para a página 1 e exibe até 25 questões compatíveis com os filtros escolhidos.
4. **Given** que o estudante abriu uma questão localizada na página 3 com filtro de área "Matemática", **When** ele retorna para a aba Questões, **Then** o catálogo restaura a página 3 e o filtro de área "Matemática" sem obrigá-lo a navegar novamente desde a página 1.
5. **Given** que uma consulta filtrada retorna 0 questões ou o acervo ainda não foi populado, **When** a aba Questões carrega, **Then** o sistema exibe um estado vazio claro com opção de limpar filtros (quando houver filtros ativos) ou orientação sobre a indisponibilidade temporária do acervo.

---

### User Story 2 - Importar e Manter o Acervo Oficial de Todos os Anos do ENEM (Priority: P1)

Como administrador/operador da plataforma, quero executar a importação completa das questões oficiais do ENEM abrangendo **todos os anos disponíveis** (de 2009 até a edição mais recente), de forma resiliente, idempotente e com espelhamento interno de imagens, para que os estudantes tenham acesso confiável a todo o histórico de provas sem depender de serviços externos em tempo real.

**Why this priority**: Sem o acervo de todos os anos persistido internamente, o catálogo não cumpre a promessa de cobertura completa do ENEM e violaria a diretriz de autonomia operacional da plataforma.

**Independent Test**: Pode ser testado de forma independente executando a importação para múltiplos anos (incluindo reexecução sobre anos já importados e simulação de falha em um ano intermediário) e verificando que: (a) todos os anos válidos são persistidos sem duplicidade, (b) questões anuladas são identificadas e excluídas do catálogo padrão, (c) imagens são armazenadas internamente e (d) falhas pontuais não corrompem nem perdem os anos já importados.

**Acceptance Scenarios**:

1. **Given** que a plataforma precisa popular o banco de questões oficiais, **When** o operador aciona a importação completa sem restringir a um único ano, **Then** o sistema descobre ou percorre todos os anos disponíveis do ENEM (2009 até o ano mais recente disponível) e importa todas as questões válidas com seus metadados (ano, número da questão, área, disciplina, idioma estrangeiro quando aplicável, habilidade oficial e parâmetros de dificuldade quando disponíveis).
2. **Given** que parte dos anos já foi importada anteriormente, **When** o operador reexecuta a importação (para atualizar ou retomar após uma interrupção), **Then** o sistema atualiza ou preserva as questões existentes de forma idempotente, sem criar duplicatas e sem perder o histórico de tentativas dos estudantes.
3. **Given** que um ano específico apresenta falha temporária de rede ou limitação de taxa na fonte de origem durante a importação, **When** o processo encontra o erro, **Then** o sistema aplica nova tentativa controlada ou registra o ano com falha no relatório final e continua importando os demais anos, preservando tudo o que já foi salvo.
4. **Given** que uma edição do ENEM possui questões oficialmente anuladas, **When** a importação processa essa edição, **Then** essas questões são marcadas como anuladas e omitidas da listagem padrão da aba Questões.

---

### User Story 3 - Exibir Imagens de Enunciados e Alternativas na Resolução e Revisão (Priority: P1)

Como estudante resolvendo uma questão oficial do ENEM que contém gráficos, tirinhas, mapas, tabelas em imagem, fórmulas ilustradas ou figuras nas alternativas, quero visualizar todas as imagens com nitidez, no local correto do enunciado ou da alternativa, e poder ampliá-las quando necessário, para conseguir interpretar e resolver a questão fielmente à prova original.

**Why this priority**: Grande parte das questões oficiais do ENEM (especialmente em Ciências da Natureza, Matemática, Geografia e Linguagens) depende essencialmente de elementos visuais. Uma questão sem sua imagem torna-se impossível de resolver corretamente.

**Independent Test**: Pode ser testado de forma independente abrindo uma questão que possua imagem no corpo do enunciado (tanto como anexo quanto referenciada no meio do texto) e outra questão que possua imagens dentro das alternativas A–E, confirmando que todas as imagens são carregadas a partir do acervo interno, renderizadas sem texto bruto de marcação, legíveis em telas móveis e desktop, e que imagens indisponíveis exibem aviso claro com opção de relato.

**Acceptance Scenarios**:

1. **Given** que uma questão oficial possui uma ou mais imagens associadas ao enunciado (seja em lista de anexos ou referenciadas dentro do texto do enunciado), **When** o estudante abre a questão para resolver ou revisar após responder, **Then** todas as imagens são exibidas em formato visual (nunca como código/link textual bruto), sem duplicação da mesma imagem, ajustadas à largura da tela sem cortes nem distorção.
2. **Given** que uma questão oficial possui imagens em uma ou mais alternativas (A, B, C, D ou E), **When** o estudante visualiza as alternativas para escolher sua resposta ou conferir o gabarito, **Then** cada alternativa exibe sua respectiva imagem junto ao texto (ou isoladamente, caso a alternativa seja puramente visual).
3. **Given** que uma imagem contém detalhes pequenos (como eixos de gráfico, legendas de mapa ou balões de tirinha), **When** o estudante clica/toca na imagem, **Then** ela pode ser visualizada em tamanho ampliado (sobreposição/lightbox) com fechamento simples por clique ou tecla `Esc`.
4. **Given** que uma imagem de uma questão está ausente ou falha ao carregar, **When** o estudante abre a questão, **Then** o sistema exibe um aviso visual discreto informando que a imagem não pôde ser carregada, sem quebrar o layout, e mantém acessível o botão "Relatar erro" para notificação editorial.
5. **Given** que o estudante está navegando na lista paginada de 25 itens na aba Questões, **When** uma questão da página contém imagem(ns), **Then** o item da lista exibe um indicador discreto (ex.: selo/ícone "Com imagem") sem baixar todas as imagens em alta resolução na listagem, preservando a leveza do catálogo.

---

### User Story 4 - Integrar Modos de Estudo da Aba Questões ao Acervo Oficial (Priority: P2)

Como estudante, quero continuar utilizando a interface limpa da aba Questões (busca/filtros, abertura de questão individual, indicação de questões inéditas/acertadas/erradas e início rápido de prática) conectada ao acervo oficial completo de todos os anos, para manter minha rotina de estudos consistente.

**Why this priority**: Garante que a atualização do acervo e da paginação se integre harmoniosamente à nova interface V0.2 da aba Questões sem quebrar o fluxo de resolução nem o registro de histórico do estudante.

**Independent Test**: Pode ser testado selecionando filtros na aba Questões, abrindo uma questão oficial da página atual, respondendo-a com nível de confiança opcional e verificando que o gabarito oficial e o status (acertou/errou) passam a refletir na listagem ao retornar ao catálogo.

**Acceptance Scenarios**:

1. **Given** que o estudante filtrou o catálogo (ex.: Ano 2022, Área Ciências da Natureza), **When** ele visualiza os 25 itens da página, **Then** cada item exibe claramente ano da prova, número da questão, área/disciplina, trecho legível do enunciado, indicador de imagem (se houver) e indicador visual de situação (inédita, acertada ou errada).
2. **Given** que o estudante abre uma questão oficial a partir do catálogo e envia sua resposta, **When** a correção é exibida, **Then** o gabarito oficial é mostrado, o enunciado e suas imagens permanecem visíveis para conferência, e o estudante pode avançar para a próxima questão ou voltar à página exata do catálogo onde estava.

---

### Edge Cases

- **Página fora do intervalo**: O que acontece se o estudante acessar diretamente uma URL com número de página inválido (ex.: `?page=0`, `?page=-2`, `?page=abc` ou `?page=999` quando existem apenas 10 páginas)? O sistema deve normalizar para a página válida mais próxima (página 1 para valores inválidos/menores que 1, ou última página disponível para valores acima do total) sem erro de tela.
- **Última página incompleta**: Quando o total de questões não é múltiplo de 25 (ex.: 53 questões), a página 3 deve exibir apenas as 3 questões restantes, desabilitar o botão "Próxima" e indicar corretamente "Exibindo 51–53 de 53 questões".
- **Imagens duplicadas entre texto e anexos**: Algumas fontes do ENEM trazem a mesma URL de imagem tanto embutida no texto do enunciado quanto na lista de arquivos anexos. O sistema deve evitar exibir a mesma imagem duas vezes na mesma questão.
- **Múltiplas imagens na mesma questão**: Questões com 2 ou mais figuras (ex.: tirinha dividida em quadros ou dois gráficos comparativos) devem exibir todas as imagens na ordem correta, sem sobreposição.
- **Idioma estrangeiro (Inglês vs. Espanhol)**: Questões 1 a 5 de Linguagens existem em duplicidade por idioma no mesmo ano. Cada variação de idioma deve ser importada como item distinto (sem sobrescrever uma à outra) e identificada claramente (ex.: "Inglês" / "Espanhol").
- **Questões puramente textuais vs. texto vazio com imagem**: Questões cujo enunciado é apenas uma imagem + comando das alternativas devem exibir um resumo amigável na lista do catálogo (usando o comando das alternativas ou um rótulo descritivo) em vez de uma linha em branco.
- **Importação parcial ou interrompida**: Se a importação de todos os anos for interrompida no meio (por exemplo, em 2016), reexecutá-la deve completar os anos faltantes sem duplicar os anos já salvos (2009–2015).
- **Filtro por ano com acervo parcial**: O seletor de anos na aba Questões deve listar apenas os anos efetivamente disponíveis no acervo (ordenados do mais recente para o mais antigo), evitando que o estudante escolha anos vazios.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (Cobertura de Todos os Anos)**: O processo de importação do acervo oficial do ENEM MUST suportar a obtenção e persistência de todas as edições disponíveis do ENEM (de 2009 até o ano mais recente disponível) por padrão quando nenhum intervalo restrito for informado, mantendo também a opção de filtrar anos específicos sob demanda.
- **FR-002 (Idempotência e Resiliência na Importação)**: A importação de todos os anos MUST ser idempotente (reexecuções não criam questões duplicadas nem apagam tentativas anteriores dos estudantes) e resiliente a falhas temporárias ou limites de taxa da fonte externa, aplicando pausas/retentativas controladas e reportando um resumo por ano (importadas, enriquecidas, anuladas, imagens espelhadas e eventuais falhas).
- **FR-003 (Exclusão de Questões Anuladas)**: Questões oficialmente anuladas MUST ser identificadas durante a importação e excluídas por padrão da listagem do catálogo de estudos.
- **FR-004 (Distinção de Idioma Estrangeiro)**: Questões de Língua Estrangeira (Inglês e Espanhol) do mesmo ano e posição MUST ser armazenadas e exibidas como questões distintas, com identificação explícita do idioma.
- **FR-005 (Limite Estrito de 25 Questões por Página)**: A aba Questões MUST limitar a exibição e o carregamento do catálogo a no máximo **25 questões por página**, nunca carregando o acervo completo de uma única vez na interface.
- **FR-006 (Navegação de Catálogo Paginado)**: A aba Questões MUST fornecer controles claros de navegação de catálogo contendo: botão "Anterior", botão "Próxima", seleção direta de páginas numeradas (com reticências quando houver muitas páginas), indicação da página atual e total de páginas, e contador do intervalo exibido em relação ao total filtrado (ex.: "Exibindo 26–50 de 1.840 questões").
- **FR-007 (Reset e Persistência de Estado na URL)**: A alteração de qualquer filtro MUST redefinir a paginação para a página 1; a página atual e os filtros ativos MUST ser sincronizados com a URL para preservar o contexto ao atualizar a página ou retornar da visualização de uma questão.
- **FR-008 (Filtros Dinâmicos do Catálogo)**: A aba Questões MUST permitir filtrar o acervo oficial por ano da prova (populado dinamicamente com os anos realmente presentes no acervo), área do conhecimento, disciplina/habilidade oficial, dificuldade e situação no histórico do estudante (inéditas, erradas, já resolvidas/frágeis), mantendo o limite de 25 itens por página em qualquer combinação de filtros.
- **FR-009 (Espelhamento Interno de Todas as Imagens)**: Durante a importação, TODAS as imagens referenciadas por uma questão — tanto nos arquivos anexos do enunciado, quanto em marcações de imagem embutidas no texto do enunciado, quanto nas alternativas A–E — MUST ser espelhadas e armazenadas internamente pela plataforma, reescrevendo referências internas para eliminar dependência de servidores externos durante o estudo.
- **FR-010 (Renderização Completa de Imagens na Questão)**: Ao exibir uma questão (na tela de resolução e na visualização pós-resposta/revisão), o sistema MUST renderizar todas as imagens do enunciado e das alternativas de forma visual, legível e responsiva, sem exibir código bruto de marcação de imagem e sem duplicar a mesma imagem quando ela aparecer tanto no texto quanto na lista de anexos.
- **FR-011 (Ampliação de Imagens)**: O estudante MUST poder ampliar qualquer imagem de uma questão (clique/toque) para inspeção detalhada de gráficos, mapas, tabelas e tirinhas, podendo fechar a visualização ampliada facilmente por clique ou teclado.
- **FR-012 (Tratamento de Falha de Imagem e Relato)**: Caso uma imagem falhe ao carregar na tela da questão, o sistema MUST exibir um aviso visual claro no lugar da figura sem comprometer o restante do enunciado ou alternativas, mantendo disponível a ação de relatar erro na questão.
- **FR-013 (Leveza na Listagem do Catálogo)**: Na lista paginada de 25 questões da aba Questões, o sistema MUST indicar de forma leve quando uma questão possui imagem(ns) (por exemplo, um indicador textual ou ícone discreto), evitando carregar todas as imagens completas na visão de catálogo.

### Key Entities *(include if feature involves data)*

- **Edição do ENEM (Ano)**: Representa um ano de aplicação oficial da prova (ex.: 2009 a 2024+), com contagem de questões válidas disponíveis e status de cobertura no acervo interno.
- **Questão Oficial do ENEM**: Item oficial identificado unicamente por ano, área, número da questão e idioma (quando aplicável), contendo texto de contexto, comando, lista de alternativas (A–E), gabarito oficial, habilidade oficial (H1–H30), parâmetros de dificuldade (quando disponíveis), status (ativa, anulada, em revisão) e referências às suas mídias.
- **Mídia de Questão (Imagem)**: Recurso visual espelhado internamente pela plataforma, vinculado ao enunciado (anexo ou embutido no texto) ou a uma alternativa específica, com identificação única e endereço interno estável.
- **Página do Catálogo**: Recorte determinístico de até 25 questões oficiais resultantes da combinação de filtros ativos, acompanhado do total de correspondências, número da página atual, tamanho da página (25) e total de páginas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001 (Cobertura Multi-Ano)**: 100% dos anos disponíveis na fonte oficial do ENEM (2009 até a edição mais recente disponível) podem ser importados em uma única execução contínua, sem duplicação de registros ao reexecutar o processo.
- **SC-002 (Controle de Carga por Página)**: 100% das navegações e consultas na aba Questões retornam e renderizam no máximo 25 questões por página, independentemente de o acervo conter 100 ou mais de 3.000 questões.
- **SC-003 (Fluidez de Navegação no Catálogo)**: A troca de página ou aplicação de filtro na aba Questões atualiza a listagem em menos de 1 segundo em condições normais de uso, sem travamento perceptível de rolagem ou interface.
- **SC-004 (Fidelidade Visual de Imagens)**: 100% das questões com imagem no enunciado ou nas alternativas exibem todas as suas figuras sem código bruto de marcação, sem duplicação visual e com opção funcional de ampliação.
- **SC-005 (Resiliência Visual)**: 100% das questões cuja imagem esteja indisponível exibem mensagem de fallback clara sem quebrar o layout da questão nem impedir o envio de relato de erro.
- **SC-006 (Continuidade de Navegação)**: Em 100% dos fluxos de "abrir questão na página N → voltar ao catálogo", o estudante retorna à mesma página N e com os mesmos filtros ativos.

## Assumptions

- **Acervo Oficial como Padrão do Catálogo**: Em conformidade com o Princípio I da Constituição do NEXO, a aba Questões apresenta o acervo oficial do ENEM persistido internamente pela plataforma. Quando o acervo local ainda não tiver sido populado em ambiente de desenvolvimento, a interface informa claramente o estado vazio.
- **Tamanho de Página Fixo em 25**: O limite padrão e máximo da página de catálogo é fixado em 25 questões por página conforme solicitado, priorizando previsibilidade e baixo consumo de memória/banda (sem seletor para carregar 100+ itens de uma vez).
- **Ordem Padrão do Catálogo**: Sem ordenação personalizada especificada, as questões são listadas do ano mais recente para o mais antigo e, dentro de cada ano, em ordem crescente pelo número da questão na prova.
- **Execução da Importação Fora do Fluxo do Estudante**: A coleta de todos os anos e o espelhamento de imagens ocorrem em rotina operacional/offline (nunca durante a navegação do estudante), garantindo velocidade e independência de serviços externos em produção.
- **Controle de Acesso Existente**: O acesso ao catálogo oficial respeita as regras de autenticação e assinatura vigentes da plataforma definidas na especificação anterior (`001-nexo-commercial-v1-enem`).
