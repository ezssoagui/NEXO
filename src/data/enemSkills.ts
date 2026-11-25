/**
 * Matriz Oficial de Referência do ENEM (INEP) — 4 áreas × 30 habilidades = 120 habilidades oficiais (H01–H30).
 */
export type EnemAreaCode = 'LC' | 'CH' | 'CN' | 'MT';

export interface OfficialEnemSkill {
  id: string;            // ex: 'MT-H19'
  area: EnemAreaCode;
  areaLabel: string;
  competencyNum: number; // 1..9
  skillNum: number;      // 1..30
  description: string;
}

const AREA_LABELS: Record<EnemAreaCode, string> = {
  LC: 'Linguagens, Códigos e suas Tecnologias',
  CH: 'Ciências Humanas e suas Tecnologias',
  CN: 'Ciências da Natureza e suas Tecnologias',
  MT: 'Matemática e suas Tecnologias',
};

const COMPETENCY_MAP: Record<EnemAreaCode, number[]> = {
  // Mapeamento oficial INEP de habilidade (1..30) -> competência da área
  LC: [1,1,1,1, 2,2,2,2, 3,3,3, 4,4,4, 5,5,5, 6,6,6, 7,7,7,7, 8,8,8, 9,9,9],
  CH: [1,1,1,1,1, 2,2,2,2,2, 3,3,3,3,3, 4,4,4,4,4, 5,5,5,5,5, 6,6,6,6,6],
  CN: [1,1,1,1, 2,2,2, 3,3,3,3, 4,4,4,4, 5,5,5, 6,6,6,6,6, 7,7,7, 8,8,8,8],
  MT: [1,1,1,1,1, 2,2,2,2, 3,3,3,3,3, 4,4,4,4, 5,5,5,5,5, 6,6,6, 7,7,7,7],
};

const DESCRIPTIONS: Record<EnemAreaCode, string[]> = {
  LC: [
    'Identificar as diferentes linguagens e seus recursos expressivos como elementos de caracterização dos sistemas de comunicação.',
    'Recorrer aos conhecimentos sobre as linguagens dos sistemas de comunicação e informação para resolver problemas sociais.',
    'Relacionar informações geradas nos sistemas de comunicação e informação, considerando a função social desses sistemas.',
    'Reconhecer posições críticas aos usos sociais que são feitos das linguagens e dos sistemas de comunicação e informação.',
    'Associar vocábulos e expressões de um texto em LEM ao seu tema.',
    'Utilizar os conhecimentos da LEM e de seus mecanismos como meio de ampliar as possibilidades de acesso a informações, tecnologias e culturas.',
    'Relacionar um texto em LEM, as estruturas linguísticas, sua função e seu uso social.',
    'Reconhecer a importância da produção cultural em LEM como representação da diversidade cultural e linguística.',
    'Reconhecer as manifestações corporais de movimento como originárias de necessidades cotidianas de um grupo social.',
    'Reconhecer a necessidade de transformação de hábitos corporais em função das necessidades cinestésicas.',
    'Reconhecer a linguagem corporal como meio de interação social, considerando os limites de desempenho e as alternativas de adaptação.',
    'Reconhecer diferentes funções da arte e do trabalho da produção dos artistas em seus meios culturais.',
    'Analisar as diversas produções artísticas como meio de explicar diferentes culturas, padrões de beleza e preconceitos.',
    'Reconhecer o valor da diversidade artística e das inter-relações de elementos que se apresentam nas manifestações de vários grupos sociais.',
    'Estabelecer relações entre o texto literário e o momento de sua produção, situando aspectos do contexto histórico, social e político.',
    'Relacionar informações sobre concepções artísticas e procedimentos de construção do texto literário.',
    'Reconhecer a presença de valores sociais e humanos atualizáveis e permanentes no patrimônio literário nacional.',
    'Identificar os elementos que concorrem para a progressão temática e para a organização e estruturação de textos de diferentes gêneros e tipos.',
    'Analisar a função da linguagem predominante nos textos em situações específicas de interlocução.',
    'Reconhecer a importância do patrimônio linguístico para a preservação da memória e da identidade nacional.',
    'Reconhecer em textos de diferentes gêneros recursos verbais e não verbais utilizados com a finalidade de criar e mudar comportamentos e hábitos.',
    'Relacionar, em diferentes textos, opiniões, temas, assuntos e recursos linguísticos.',
    'Inferir em um texto quais são os objetivos de seu produtor e quem é seu público-alvo, pela análise dos procedimentos argumentativos.',
    'Reconhecer no texto estratégias argumentativas empregadas para o convencimento do público.',
    'Identificar, em textos de diferentes gêneros, as marcas linguísticas que singularizam as variedades linguísticas sociais, regionais e de registro.',
    'Relacionar as variedades linguísticas a situações específicas de uso social.',
    'Reconhecer os usos da norma padrão da língua portuguesa nas diferentes situações de comunicação.',
    'Reconhecer a função e o impacto social das diferentes tecnologias da comunicação e informação.',
    'Identificar pela análise de suas linguagens as tecnologias da comunicação e informação.',
    'Relacionar as tecnologias de comunicação e informação ao desenvolvimento das sociedades e ao conhecimento que elas produzem.',
  ],
  CH: [
    'Interpretar historicamente e/ou geograficamente fontes documentais acerca de aspectos da cultura.',
    'Analisar a produção da memória pelas sociedades humanas.',
    'Associar as manifestações culturais do presente aos seus processos históricos.',
    'Comparar pontos de vista expressos em diferentes fontes sobre determinado aspecto da cultura.',
    'Identificar as manifestações ou representações da diversidade do patrimônio cultural e artístico em diferentes sociedades.',
    'Interpretar diferentes representações gráficas e cartográficas dos espaços geográficos.',
    'Identificar os significados histórico-geográficos das relações de poder entre as nações.',
    'Analisar a ação dos estados nacionais no que se refere à dinâmica dos fluxos populacionais e no enfrentamento de problemas econômico-sociais.',
    'Comparar o significado histórico-geográfico das organizações políticas e socioeconômicas em escala local, regional ou mundial.',
    'Reconhecer a dinâmica da organização dos movimentos sociais e a importância da participação da coletividade na transformação da realidade.',
    'Identificar registros de práticas de grupos sociais no tempo e no espaço.',
    'Analisar o papel da justiça como instituição na organização das sociedades.',
    'Analisar a atuação dos movimentos sociais que contribuíram para mudanças ou rupturas em processos de disputa pelo poder.',
    'Comparar diferentes pontos de vista sobre situações de natureza histórico-geográfica, identificando os pressupostos conceituais.',
    'Avaliar criticamente conflitos culturais, sociais, políticos, econômicos ou ambientais ao longo da história.',
    'Identificar registros sobre o papel das técnicas e tecnologias na organização do trabalho e/ou da vida social.',
    'Analisar fatores que explicam o impacto das novas tecnologias no processo de territorialização da produção.',
    'Analisar diferentes processos de produção ou circulação de riquezas e suas implicações socioespaciais.',
    'Reconhecer as transformações técnicas e tecnológicas que determinam as várias formas de uso e apropriação dos espaços rural e urbano.',
    'Selecionar argumentos favoráveis ou contrários às modificações impostas pelas novas tecnologias à vida social e ao mundo do trabalho.',
    'Identificar o papel dos meios de comunicação na construção da vida social.',
    'Analisar as lutas sociais e conquistas obtidas no que se refere às mudanças nas legislações ou nas políticas públicas.',
    'Analisar a importância dos valores éticos na estruturação política das sociedades.',
    'Relacionar cidadania e democracia na organização das sociedades.',
    'Identificar estratégias que promovam formas de inclusão social.',
    'Identificar em fontes diversas o processo de ocupação dos meios físicos e as relações da vida humana com a paisagem.',
    'Analisar de maneira crítica as interações da sociedade com o meio físico, levando em consideração aspectos históricos e/ou geográficos.',
    'Relacionar o uso das tecnologias com os impactos socioambientais em diferentes contextos histórico-geográficos.',
    'Reconhecer a função dos recursos naturais na produção do espaço geográfico, relacionando-os com as mudanças provocadas pelas ações humanas.',
    'Avaliar as relações entre preservação e degradação da vida no planeta nas diferentes escalas.',
  ],
  CN: [
    'Reconhecer características ou propriedades de fenômenos ondulatórios ou oscilatórios, relacionando-os a seus usos em diferentes contextos.',
    'Associar a solução de problemas de comunicação, transporte, saúde ou outro com o correspondente desenvolvimento científico e tecnológico.',
    'Enfrentar situações-problema envolvendo fenômenos físicos, químicos ou biológicos em contextos cotidianos e tecnológicos.',
    'Avaliar propostas de intervenção no ambiente, considerando a qualidade da vida humana ou medidas de conservação e recuperação.',
    'Dimensionar circuitos ou dispositivos elétricos de uso cotidiano.',
    'Relacionar informações para compreender manuais de instalação ou utilização de aparelhos ou sistemas tecnológicos de uso comum.',
    'Selecionar testes de controle, parâmetros ou critérios para a comparação de materiais e produtos com vistas à defesa do consumidor e saúde.',
    'Identificar etapas em processos de obtenção, transformação, utilização ou reciclagem de recursos naturais, energéticos ou matérias-primas.',
    'Compreender a importância dos ciclos biogeoquímicos ou do fluxo de energia para a vida, ou da ação de agentes e fenômenos ambientais.',
    'Analisar perturbações ambientais, identificando fontes, transporte e/ou destino dos poluentes ou prevendo efeitos em sistemas naturais e produtivos.',
    'Reconhecer benefícios, limitações e aspectos éticos da biotecnologia, considerando estruturas e processos biológicos envolvidos.',
    'Avaliar impactos em ambientes naturais decorrentes de atividades sociais ou econômicas, considerando interesses contraditórios.',
    'Reconhecer mecanismos de transmissão da vida, prevendo ou explicando a manifestação de características dos seres vivos.',
    'Identificar padrões em fenômenos e processos vitais dos organismos, como manutenção do equilíbrio interno, defesa e relações com o ambiente.',
    'Interpretar modelos e experimentos para explicar fenômenos ou processos biológicos em qualquer nível de organização dos sistemas biológicos.',
    'Compreender o papel da evolução na produção de padrões, processos biológicos ou na organização taxonômica dos seres vivos.',
    'Relacionar informações apresentadas em diferentes formas de linguagem e representação usadas nas ciências físicas, químicas ou biológicas.',
    'Relacionar propriedades físicas, químicas ou biológicas de produtos, sistemas ou procedimentos tecnológicos às finalidades a que se destinam.',
    'Avaliar métodos, processos ou procedimentos das ciências naturais que contribuam para diagnosticar ou solucionar problemas sociais ou ambientais.',
    'Caracterizar causas ou efeitos dos movimentos de partículas, substâncias, objetos ou corpos celestes.',
    'Utilizar leis físicas e/ou químicas para interpretar processos naturais ou tecnológicos inseridos no contexto da termodinâmica e/ou eletromagnetismo.',
    'Compreender fenômenos decorrentes da interação entre a radiação e a matéria em suas manifestações em processos naturais ou tecnológicos.',
    'Avaliar possibilidades de geração, uso ou transformação de energia em ambientes específicos, considerando implicações éticas, ambientais e sociais.',
    'Utilizar códigos e nomenclatura da química para caracterizar materiais, substâncias ou transformações químicas.',
    'Caracterizar materiais ou substâncias, identificando etapas, rendimentos ou implicações biológicas, sociais, econômicas ou ambientais.',
    'Avaliar implicações sociais, ambientais e/ou econômicas na produção ou no consumo de recursos energéticos ou minerais.',
    'Avaliar propostas de intervenção no meio ambiente aplicando conhecimentos químicos, observando riscos ou benefícios.',
    'Associar características adaptativas dos organismos com seu modo de vida ou com seus limites de distribuição em diferentes ambientes.',
    'Interpretar experimentos ou técnicas que utilizam seres vivos, analisando implicações para o ambiente, a saúde e a produção de alimentos.',
    'Avaliar propostas de alcance individual ou coletivo, identificando aquelas que visam à preservação e à implementação da saúde.',
  ],
  MT: [
    'Reconhecer, no contexto social, diferentes significados e representações dos números e operações.',
    'Identificar padrões numéricos ou princípios de contagem.',
    'Resolver situação-problema envolvendo conhecimentos numéricos.',
    'Avaliar a razoabilidade de um resultado numérico na construção de argumentos sobre afirmações quantitativas.',
    'Avaliar propostas de intervenção na realidade utilizando conhecimentos numéricos.',
    'Interpretar a localização e a movimentação de pessoas/objetos no espaço tridimensional e sua representação no espaço bidimensional.',
    'Identificar características de figuras planas ou espaciais.',
    'Resolver situação-problema que envolva conhecimentos geométricos de espaço e forma.',
    'Utilizar conhecimentos geométricos de espaço e forma na seleção de argumentos propostos como solução de problemas do cotidiano.',
    'Identificar relações entre grandezas e unidades de medida.',
    'Utilizar a noção de escalas na leitura de representação de situação do cotidiano.',
    'Resolver situação-problema que envolva medidas de grandezas.',
    'Avaliar o resultado de uma medição na construção de um argumento consistente.',
    'Avaliar proposta de intervenção na realidade utilizando conhecimentos geométricos relacionados a grandezas e medidas.',
    'Identificar a relação de dependência entre grandezas.',
    'Resolver situação-problema envolvendo a variação de grandezas, direta ou inversamente proporcionais.',
    'Analisar informações envolvendo a variação de grandezas como recurso para a construção de argumentação.',
    'Avaliar propostas de intervenção na realidade envolvendo variação de grandezas.',
    'Identificar representações algébricas que expressem a relação entre grandezas.',
    'Interpretar gráfico cartesiano que represente relações entre grandezas.',
    'Resolver situação-problema cuja modelagem envolva conhecimentos algébricos.',
    'Utilizar conhecimentos algébricos/geométricos como recurso para a construção de argumentação.',
    'Avaliar propostas de intervenção na realidade utilizando conhecimentos algébricos.',
    'Utilizar informações expressas em gráficos ou tabelas para fazer inferências.',
    'Resolver problema com dados apresentados em tabelas ou gráficos.',
    'Analisar informações expressas em gráficos ou tabelas como recurso para a construção de argumentos.',
    'Calcular medidas de tendência central ou de dispersão de um conjunto de dados expressos em uma tabela ou gráfico.',
    'Resolver situação-problema que envolva conhecimentos de estatística e probabilidade.',
    'Utilizar conhecimentos de estatística e probabilidade como recurso para a construção de argumentação.',
    'Avaliar propostas de intervenção na realidade utilizando conhecimentos de estatística e probabilidade.',
  ],
};

export const OFFICIAL_ENEM_SKILLS: OfficialEnemSkill[] = (['LC', 'CH', 'CN', 'MT'] as EnemAreaCode[]).flatMap((area) =>
  DESCRIPTIONS[area].map((description, idx) => {
    const skillNum = idx + 1;
    return {
      id: `${area}-H${String(skillNum).padStart(2, '0')}`,
      area,
      areaLabel: AREA_LABELS[area],
      competencyNum: COMPETENCY_MAP[area][idx],
      skillNum,
      description,
    };
  }),
);

export const OFFICIAL_ENEM_SKILL_BY_ID = new Map(OFFICIAL_ENEM_SKILLS.map((s) => [s.id, s]));

export function formatEnemSkillId(area: EnemAreaCode, skillNum: number): string {
  return `${area}-H${String(skillNum).padStart(2, '0')}`;
}
