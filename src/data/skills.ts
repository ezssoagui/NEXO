import type { Skill, Subject, Area, ErrorType, ErrorCause, InterventionCode } from '../types';

// subtopic, competency (descrição autoral, não código oficial da matriz), prerequisites e examWeight alimentam o Motor de Domínio.
const S = (id: string, name: string, subject: Subject, area: Area, subtopic: string, competency: string, prerequisites: string[], examWeight: 'alta' | 'media' | 'baixa', lessonId?: string): Skill => ({ id, name, subject, area, subtopic, competency, prerequisites, examWeight, lessonId });
export const SKILLS: Skill[] = [
  S('mat-proporcao', 'Razão, proporção e regra de três', 'Matemática', 'Matemática', 'Grandezas diretamente e inversamente proporcionais', 'Resolver situações-problema com proporcionalidade', [], 'alta', 'l-proporcao'),
  S('fis-potencia', 'Potência elétrica e grandezas constantes', 'Física', 'Ciências da Natureza', 'Potência, tensão, corrente e resistência', 'Relacionar grandezas físicas em circuitos do cotidiano', ['mat-proporcao'], 'alta', 'l-potencia'),
  S('fis-cinematica', 'Velocidade média e conversão de unidades', 'Física', 'Ciências da Natureza', 'Movimento uniforme e unidades', 'Interpretar movimentos e converter unidades', ['mat-proporcao'], 'media', 'l-cinematica'),
  S('fis-energia', 'Conservação da energia mecânica', 'Física', 'Ciências da Natureza', 'Energia potencial e cinética', 'Aplicar princípios de conservação', ['fis-cinematica'], 'media', 'l-energia'),
  S('fis-ondas', 'Ondas: velocidade, frequência e comprimento', 'Física', 'Ciências da Natureza', 'Equação fundamental da ondulatória', 'Relacionar grandezas ondulatórias', ['mat-proporcao'], 'media'),
  S('qui-equilibrio', 'Deslocamento de equilíbrio (Le Chatelier)', 'Química', 'Ciências da Natureza', 'Fatores que deslocam o equilíbrio', 'Prever o comportamento de sistemas químicos', [], 'media', 'l-equilibrio'),
  S('qui-estequiometria', 'Estequiometria e proporção em mols', 'Química', 'Ciências da Natureza', 'Relações massa–mol–coeficientes', 'Quantificar transformações químicas', ['mat-proporcao'], 'alta', 'l-esteq'),
  S('qui-concentracao', 'Concentração de soluções', 'Química', 'Ciências da Natureza', 'Porcentagem m/V e concentração comum', 'Quantificar soluções do cotidiano', ['mat-proporcao'], 'media', 'l-solucoes'),
  S('qui-ph', 'pH e caráter ácido-básico', 'Química', 'Ciências da Natureza', 'Escala de pH', 'Interpretar acidez em contextos ambientais', ['qui-concentracao'], 'media', 'l-solucoes'),
  S('bio-hormonios', 'Hormônios e efeitos fisiológicos', 'Biologia', 'Ciências da Natureza', 'Controle da glicemia', 'Relacionar hormônios a efeitos fisiológicos', [], 'media', 'l-hormonios'),
  S('bio-ecologia', 'Cadeias alimentares e bioacumulação', 'Biologia', 'Ciências da Natureza', 'Magnificação trófica', 'Analisar impactos ambientais em ecossistemas', [], 'alta'),
  S('bio-genetica', 'Genética mendeliana e probabilidade', 'Biologia', 'Ciências da Natureza', 'Primeira Lei de Mendel', 'Calcular probabilidades em heranças', ['mat-probabilidade'], 'media', 'l-genetica'),
  S('mat-porcentagem', 'Porcentagem e variações sucessivas', 'Matemática', 'Matemática', 'Fatores de aumento e desconto', 'Resolver problemas com porcentagem', ['mat-proporcao'], 'alta', 'l-porcentagem'),
  S('mat-probabilidade', 'Probabilidade', 'Matemática', 'Matemática', 'Espaço amostral e eventos', 'Quantificar incertezas', ['mat-proporcao'], 'media', 'l-probabilidade'),
  S('mat-funcoes', 'Função afim em contexto', 'Matemática', 'Matemática', 'Parte fixa e taxa de variação', 'Modelar situações com funções', ['mat-proporcao'], 'media'),
  S('mat-geometria', 'Volume e capacidade', 'Matemática', 'Matemática', 'Volume de sólidos e conversão m³/L', 'Calcular medidas em situações reais', ['mat-proporcao'], 'media'),
  S('mat-estatistica', 'Média, mediana e moda', 'Matemática', 'Matemática', 'Medidas de tendência central', 'Interpretar dados estatísticos', [], 'alta'),
  S('mat-teoria-numeros', 'Aritmética modular (olimpíada)', 'Matemática', 'Matemática', 'Restos e periodicidade', 'Demonstrar propriedades numéricas', [], 'baixa'),
  S('lin-interpretacao', 'Interpretação e estratégia argumentativa', 'Linguagens', 'Linguagens', 'Tese, prova textual e eliminação', 'Compreender e analisar textos argumentativos', [], 'alta', 'l-cpe'),
  S('lin-funcoes', 'Funções da linguagem', 'Linguagens', 'Linguagens', 'Emissor, receptor e mensagem', 'Reconhecer intenções comunicativas', [], 'media'),
  S('hum-historia', 'Era Vargas e trabalho', 'Humanas', 'Ciências Humanas', 'Trabalhismo e Estado Novo', 'Relacionar processos históricos e cidadania', [], 'media', 'l-vargas'),
  S('hum-geografia', 'Urbanização brasileira', 'Humanas', 'Ciências Humanas', 'Periferização e segregação', 'Analisar a produção do espaço urbano', [], 'alta'),
  S('hum-filosofia', 'Contratualismo', 'Humanas', 'Ciências Humanas', 'Hobbes, Locke e Rousseau', 'Comparar concepções de Estado', [], 'media'),
];

export const skillById = (id: string) => SKILLS.find((s) => s.id === id);
export const SUBJECTS: Subject[] = ['Matemática', 'Física', 'Química', 'Biologia', 'Linguagens', 'Humanas'];
export const AREAS: Area[] = ['Linguagens', 'Matemática', 'Ciências da Natureza', 'Ciências Humanas'];

export const ERROR_LABELS: Record<ErrorType, { label: string; tip: string }> = {
  lacuna_conceitual: { label: 'Lacuna conceitual', tip: 'Volte à explicação do conceito antes de novas questões.' },
  interpretacao: { label: 'Interpretação inadequada', tip: 'Releia o comando e sublinhe o que é pedido (C do C-P-E).' },
  formula_incorreta: { label: 'Fórmula ou procedimento incorreto', tip: 'Liste as fórmulas possíveis e escolha pela informação disponível.' },
  grandeza_constante: { label: 'Não reconheceu a grandeza constante', tip: 'Antes de calcular, pergunte: o que NÃO muda nesta situação?' },
  calculo: { label: 'Erro de cálculo', tip: 'Refaça a conta com estimativa de ordem de grandeza.' },
  unidades: { label: 'Conversão de unidades', tip: 'Escreva as unidades em cada passo e converta antes de substituir.' },
  desatencao: { label: 'Desatenção', tip: 'Confira o enunciado ao final: a resposta responde exatamente ao que foi pedido?' },
  alternativas_plausiveis: { label: 'Confusão entre alternativas plausíveis', tip: 'Use o E do C-P-E: procure excesso, generalização ou inversão.' },
  chute: { label: 'Acerto por chute', tip: 'O acerto não conta como domínio. Faça uma questão semelhante.' },
  memorizacao: { label: 'Falha de memorização/recuperação', tip: 'Transforme em flashcard e revise em intervalos crescentes.' },
};

export const SUBJECT_COLORS: Record<Subject, string> = {
  'Matemática': '#2f5494', 'Física': '#0a9573', 'Química': '#7c3aed', 'Biologia': '#16a34a', 'Linguagens': '#d97706', 'Humanas': '#db2777',
};

export const prerequisitesOf = (id: string) => skillById(id)?.prerequisites ?? [];

export const CAUSE_LABELS: Record<ErrorCause, { label: string; tip: string }> = {
  conceitual: { label: 'Erro conceitual', tip: 'Falta ou confusão de um conceito.' },
  interpretacao: { label: 'Erro de interpretação', tip: 'O comando ou o texto foi lido de outra forma.' },
  calculo: { label: 'Erro de cálculo', tip: 'Procedimento certo, operação errada.' },
  formula: { label: 'Erro de aplicação de fórmula', tip: 'Relação escolhida ou aplicada de forma inadequada.' },
  unidade: { label: 'Erro de unidade ou conversão', tip: 'Unidades não convertidas ou convertidas errado.' },
  atencao: { label: 'Erro de atenção', tip: 'Leitura incompleta ou distração.' },
  esquecimento: { label: 'Esquecimento', tip: 'Já demonstrado antes, mas não recuperado agora.' },
  confusao_alternativas: { label: 'Confusão entre alternativas', tip: 'Dúvida entre opções plausíveis.' },
  lacuna_prerequisito: { label: 'Lacuna de pré-requisito', tip: 'Depende de um conhecimento anterior ainda não dominado.' },
  indeterminada: { label: 'Causa ainda indeterminada', tip: 'Ainda não há evidência suficiente.' },
};

export const INTERVENTION_LABELS: Record<InterventionCode, { label: string; desc: string }> = {
  nenhuma: { label: 'Sem intervenção', desc: 'Seguir em frente.' },
  A: { label: 'A — Dica progressiva', desc: 'Pistas graduais, sem entregar a resposta.' },
  B: { label: 'B — Tutoria socrática', desc: 'Uma pergunta por vez para reconstruir o raciocínio.' },
  C: { label: 'C — Microaula', desc: 'Explicação curta e contextualizada do conceito que falta.' },
  D: { label: 'D — Aula estruturada', desc: 'Fundamentos, exemplos, aplicações e exercícios.' },
  E: { label: 'E — Correção direta', desc: 'Aponta o erro de forma breve.' },
  F: { label: 'F — Reconstrução do procedimento', desc: 'Refaz a resolução etapa por etapa.' },
  G: { label: 'G — Revisão de pré-requisitos', desc: 'Verifica e reforça o conhecimento anterior necessário.' },
};
