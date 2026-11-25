export interface EssayTheme { id: string; title: string; keywords: string[]; /** Partes do recorte temático: todas precisam aparecer para não tangenciar. */ axes?: { label: string; terms: string[] }[]; texts: { title: string; body: string }[] }

// Temas e textos motivadores elaborados para esta demonstração (sem dados reais inventados).
export const ESSAY_THEMES: EssayTheme[] = [
  {
    id: 't1', title: 'Caminhos para combater a desinformação digital no Brasil',
    keywords: ['desinformação', 'fake news', 'notícias falsas', 'informação', 'digital', 'internet', 'redes sociais', 'checagem', 'educação midiática', 'plataformas'],
    axes: [{ label: 'caminhos/combate', terms: ['combat', 'enfrent', 'soluç', 'solucion', 'medida', 'caminho', 'revert', 'mitig'] }, { label: 'desinformação', terms: ['desinforma', 'fake news', 'notícias falsas', 'conteúdos falsos'] }, { label: 'meio digital', terms: ['digita', 'internet', 'redes sociais', 'plataforma', 'online'] }, { label: 'Brasil', terms: ['brasil', 'nacional', 'país'] }],
    texts: [
      { title: 'Texto I', body: 'Conteúdos falsos ou enganosos circulam com rapidez em aplicativos de mensagens e redes sociais, muitas vezes impulsionados por algoritmos que privilegiam o engajamento.' },
      { title: 'Texto II', body: 'Educação midiática é o conjunto de habilidades para acessar, analisar, avaliar e produzir informação de maneira crítica e responsável.' },
      { title: 'Texto III', body: 'Iniciativas de checagem de fatos, transparência das plataformas e formação de leitores críticos têm sido apontadas como estratégias complementares.' },
    ],
  },
  {
    id: 't2', title: 'Desafios para a permanência de jovens no ensino médio brasileiro',
    keywords: ['permanência', 'evasão', 'abandono', 'ensino médio', 'jovens', 'escola', 'educação', 'trabalho', 'renda', 'currículo'],
    axes: [{ label: 'desafios', terms: ['desafio', 'obstáculo', 'dificuldade', 'entrave', 'problema', 'impasse'] }, { label: 'permanência', terms: ['permanência', 'evasão', 'abandon', 'permanec'] }, { label: 'jovens', terms: ['jove', 'adolescen', 'juventude', 'estudante'] }, { label: 'ensino médio', terms: ['ensino médio', 'escola'] }, { label: 'Brasil', terms: ['brasil', 'nacional', 'país'] }],
    texts: [
      { title: 'Texto I', body: 'Entre os motivos frequentemente relatados para o abandono escolar estão a necessidade de trabalhar, a falta de interesse pelo currículo e dificuldades de deslocamento.' },
      { title: 'Texto II', body: 'A Constituição Federal de 1988 estabelece a educação como direito de todos e dever do Estado e da família.' },
    ],
  },
  {
    id: 't3', title: 'O acesso à saúde mental entre adolescentes brasileiros',
    keywords: ['saúde mental', 'adolescentes', 'ansiedade', 'depressão', 'psicológico', 'acolhimento', 'estigma', 'atendimento', 'escola', 'SUS'],
    axes: [{ label: 'acesso', terms: ['acess', 'atendimento', 'acolhimento'] }, { label: 'saúde mental', terms: ['saúde mental', 'psicológic', 'psíquic'] }, { label: 'adolescentes', terms: ['adolescen', 'jove'] }, { label: 'Brasil', terms: ['brasil', 'nacional', 'país'] }],
    texts: [
      { title: 'Texto I', body: 'O estigma associado ao sofrimento psíquico pode dificultar que adolescentes procurem ajuda.' },
      { title: 'Texto II', body: 'A Rede de Atenção Psicossocial (RAPS) integra o Sistema Único de Saúde e organiza serviços de cuidado em saúde mental.' },
    ],
  },
  {
    id: 't4', title: 'Impactos do desperdício de alimentos na sociedade brasileira',
    keywords: ['desperdício', 'alimentos', 'fome', 'insegurança alimentar', 'consumo', 'produção', 'doação', 'logística', 'meio ambiente'],
    axes: [{ label: 'impactos', terms: ['impact', 'consequência', 'efeito', 'provoca', 'gera'] }, { label: 'desperdício', terms: ['desperd', 'perda'] }, { label: 'alimentos', terms: ['aliment', 'comida'] }, { label: 'Brasil', terms: ['brasil', 'nacional', 'país'] }],
    texts: [
      { title: 'Texto I', body: 'Perdas ocorrem em várias etapas: colheita, transporte, armazenamento, comercialização e consumo doméstico.' },
      { title: 'Texto II', body: 'A coexistência de desperdício e insegurança alimentar revela problemas de distribuição, e não apenas de produção.' },
    ],
  },
  {
    id: 't5', title: 'A mobilidade urbana como direito nas cidades brasileiras',
    keywords: ['mobilidade', 'transporte', 'cidade', 'urbana', 'transporte público', 'acessibilidade', 'periferia', 'direito', 'trânsito'],
    axes: [{ label: 'mobilidade', terms: ['mobilidade', 'transporte', 'deslocamento'] }, { label: 'direito', terms: ['direito', 'constituição', 'garant'] }, { label: 'cidades', terms: ['cidade', 'urban'] }, { label: 'Brasil', terms: ['brasil', 'nacional', 'país'] }],
    texts: [
      { title: 'Texto I', body: 'O transporte foi incluído entre os direitos sociais no artigo 6º da Constituição Federal por meio da Emenda Constitucional nº 90, de 2015.' },
      { title: 'Texto II', body: 'Longos deslocamentos diários afetam sobretudo moradores de periferias, com impactos sobre estudo, trabalho e lazer.' },
    ],
  },
];

export const DEMO_ESSAYS: { id: string; themeId: string; label: string; text: string; comments: string[] }[] = [
  {
    id: 'd1', themeId: 't1', label: 'Redação demonstrativa A — desenvolvimento consistente',
    text: `No contexto contemporâneo, a internet ampliou o acesso à informação, mas também acelerou a circulação de conteúdos falsos. Nesse cenário, a desinformação digital no Brasil persiste, sobretudo, devido à lógica de engajamento das plataformas e à insuficiência da educação midiática nas escolas, o que exige uma resposta articulada.

Em primeiro lugar, cabe destacar que muitas plataformas organizam o que o usuário vê a partir do engajamento. Dessa forma, conteúdos sensacionalistas, que provocam indignação, tendem a alcançar mais pessoas do que informações verificadas. Como consequência, o debate público é empobrecido, já que boatos ganham aparência de verdade pela simples repetição.

Além disso, a escola ainda trata a leitura de notícias de modo pontual. O filósofo Zygmunt Bauman, ao descrever a "modernidade líquida", chama atenção para relações cada vez mais fluidas e instáveis — característica que também atinge a confiança nas fontes. Sem formação para checar autoria, data e evidências, o estudante torna-se vulnerável a manipulações, o que compromete o exercício consciente da cidadania.

Portanto, é necessário enfrentar o problema. O Ministério da Educação, em parceria com as secretarias estaduais, deve incluir a educação midiática como prática contínua no currículo, por meio de oficinas de checagem de fatos e análise de fontes, a fim de formar leitores críticos. Paralelamente, o Poder Legislativo deve exigir transparência das plataformas sobre seus critérios de recomendação, para que a sociedade compreenda como a informação circula.`,
    comments: [
      'Tese explícita no fim da introdução, com dois eixos (engajamento das plataformas e educação midiática) retomados nos desenvolvimentos.',
      'Repertório (Bauman) pertinente, mas a articulação com o argumento pode ser mais explícita: explicar por que a "fluidez" afeta a checagem de fontes.',
      'Proposta com agente, ação, meio e finalidade; o detalhamento poderia ser ampliado (ex.: como as oficinas seriam avaliadas).',
    ],
  },
  {
    id: 'd2', themeId: 't2', label: 'Redação demonstrativa B — argumentação parcial',
    text: `A evasão escolar no ensino médio é um problema muito grave no Brasil. Muitos jovens abandonam a escola e isso é ruim para o país.

Um dos motivos é que os jovens precisam trabalhar para ajudar a família. Eles não tem tempo para estudar e acabam desistindo. Isso acontece muito nas famílias pobres.

Outro motivo é que a escola não é interessante. Os alunos acham as aulas chatas e não veem sentido no que aprendem. Mas, a escola precisa mudar.

Portanto o governo deve fazer alguma coisa para resolver esse problema e os jovens devem continuar estudando.`,
    comments: [
      'Tema compreendido, mas sem repertório sociocultural e com tese genérica ("problema muito grave").',
      'Os argumentos são apresentados, mas pouco desenvolvidos: faltam relações de causa e consequência aprofundadas.',
      'Desvios: "Eles não tem" (concordância/acentuação: têm); vírgula indevida após "Mas"; falta vírgula após "Portanto".',
      'Proposta incompleta: agente genérico ("o governo"), ação vaga ("fazer alguma coisa"), sem meio, finalidade ou detalhamento.',
    ],
  },
  {
    id: 'd3', themeId: 't4', label: 'Redação demonstrativa C — repertório a verificar',
    text: `Segundo a Constituição de 1998, todos tem direito à alimentação. Porém, no Brasil, o desperdício de alimentos convive com a fome, o que mostra uma contradição.

O desperdício acontece desde a colheita até a casa das pessoas. Quando o transporte é precário, muitos alimentos estragam no caminho. Além disso, nos supermercados, produtos com aparência imperfeita são descartados, mesmo estando bons para consumo. Dessa maneira, a comida existe, mas não chega a quem precisa.

Como disse Einstein, "a fome é o maior problema da humanidade". Por isso, é preciso mudar a forma como lidamos com a comida em casa, planejando melhor as compras.

Logo, o Ministério do Desenvolvimento Social deve ampliar parcerias com bancos de alimentos, por meio de incentivos a supermercados que doem produtos próprios para consumo, a fim de reduzir a insegurança alimentar.`,
    comments: [
      'Repertório incorreto: a Constituição Federal é de 1988 (e o direito à alimentação foi incluído no art. 6º por emenda em 2010).',
      'Citação atribuída a Einstein não verificável — evite citações sem fonte segura; prefira repertórios que você domina.',
      'Bom desenvolvimento no 2º parágrafo (causa → consequência). O 3º parágrafo é curto e depende de citação duvidosa.',
      'Desvio: "todos tem" → "todos têm".',
    ],
  },
];
