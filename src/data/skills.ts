import type { Area, ErrorCategory, ErrorType, Skill, Subject } from '../types';

/**
 * REGISTRO DE HABILIDADES avaliáveis no protótipo (as que possuem atividades cadastradas).
 * A posição de cada uma na hierarquia curricular está em curriculum.ts; `matrix` aponta para a matriz oficial (matrix.ts).
 * Para cadastrar uma nova habilidade: inclua-a aqui e no conteúdo correspondente do currículo.
 */
const CN: Area = 'Ciências da Natureza', CH: Area = 'Ciências Humanas', LC: Area = 'Linguagens', MT: Area = 'Matemática';
const S = (id: string, name: string, subject: Subject, area: Area, matrix: string[], prerequisites: string[] = [], lessonId?: string): Skill => ({ id, name, subject, area, matrix, prerequisites, lessonId });

export const SKILLS: Skill[] = [
  // Física
  S('fis-cinematica', 'Velocidade média e conversão de unidades', 'Física', CN, ['CN-H20'], ['mat-proporcao'], 'l-cinematica'),
  S('fis-dinamica', 'Força resultante e leis de Newton', 'Física', CN, ['CN-H20'], ['fis-cinematica'], 'l-dinamica'),
  S('fis-centripeta', 'Força centrípeta', 'Física', CN, ['CN-H20'], ['fis-dinamica'], 'l-dinamica'),
  S('fis-energia', 'Conservação da energia mecânica', 'Física', CN, ['CN-H20', 'CN-H23'], ['fis-cinematica'], 'l-energia'),
  S('fis-ondas', 'Velocidade, frequência e comprimento de onda', 'Física', CN, ['CN-H1'], ['mat-proporcao']),
  S('fis-potencia', 'Potência elétrica e grandezas constantes', 'Física', CN, ['CN-H5', 'CN-H21'], ['mat-proporcao'], 'l-potencia'),
  S('fis-energia-eletrica', 'Consumo de energia elétrica', 'Física', CN, ['CN-H5', 'CN-H6'], ['fis-potencia'], 'l-potencia'),
  S('fis-campo-magnetico', 'Campo magnético', 'Física', CN, ['CN-H21'], ['fis-potencia'], 'l-magnetismo'),
  S('fis-forca-magnetica', 'Força magnética', 'Física', CN, ['CN-H21'], ['fis-campo-magnetico', 'fis-dinamica'], 'l-magnetismo'),
  S('fis-inducao', 'Indução eletromagnética', 'Física', CN, ['CN-H21', 'CN-H23'], ['fis-campo-magnetico'], 'l-magnetismo'),
  // Química
  S('qui-separacao', 'Separação de misturas', 'Química', CN, ['CN-H8', 'CN-H18']),
  S('qui-estequiometria', 'Estequiometria e proporção em mols', 'Química', CN, ['CN-H25'], ['mat-proporcao'], 'l-esteq'),
  S('qui-concentracao', 'Concentração de soluções', 'Química', CN, ['CN-H24', 'CN-H25'], ['mat-proporcao'], 'l-solucoes'),
  S('qui-ph', 'pH e caráter ácido-básico', 'Química', CN, ['CN-H24', 'CN-H27'], ['qui-concentracao'], 'l-solucoes'),
  S('qui-equilibrio', 'Deslocamento de equilíbrio (Le Chatelier)', 'Química', CN, ['CN-H24', 'CN-H21'], [], 'l-equilibrio'),
  S('qui-eletroquimica', 'Pilhas e oxirredução', 'Química', CN, ['CN-H21', 'CN-H26']),
  // Biologia
  S('bio-citologia', 'Transporte através da membrana', 'Biologia', CN, ['CN-H14', 'CN-H15']),
  S('bio-hormonios', 'Hormônios e controle da glicemia', 'Biologia', CN, ['CN-H14'], [], 'l-hormonios'),
  S('bio-osmorregulacao', 'Osmorregulação: ADH e aldosterona', 'Biologia', CN, ['CN-H14'], [], 'l-osmorregulacao'),
  S('bio-ecologia', 'Cadeias alimentares e bioacumulação', 'Biologia', CN, ['CN-H9', 'CN-H10']),
  S('bio-genetica', 'Genética mendeliana', 'Biologia', CN, ['CN-H13'], ['mat-probabilidade'], 'l-genetica'),
  // Matemática
  S('mat-proporcao', 'Razão, proporção e regra de três', 'Matemática', MT, ['MT-H16'], [], 'l-proporcao'),
  S('mat-porcentagem', 'Porcentagem e variações sucessivas', 'Matemática', MT, ['MT-H3'], ['mat-proporcao'], 'l-porcentagem'),
  S('mat-estatistica', 'Média, mediana e moda', 'Matemática', MT, ['MT-H27']),
  S('mat-probabilidade', 'Probabilidade', 'Matemática', MT, ['MT-H28'], ['mat-proporcao'], 'l-probabilidade'),
  S('mat-funcoes', 'Função afim em contexto', 'Matemática', MT, ['MT-H20', 'MT-H21'], ['mat-proporcao']),
  S('mat-quadratica', 'Função quadrática em contexto', 'Matemática', MT, ['MT-H21'], ['mat-funcoes']),
  S('mat-areas', 'Áreas de figuras planas', 'Matemática', MT, ['MT-H8'], ['mat-proporcao']),
  S('mat-geometria', 'Volume e capacidade', 'Matemática', MT, ['MT-H8', 'MT-H12'], ['mat-areas']),
  // Linguagens
  S('lin-interpretacao', 'Interpretação e estratégia argumentativa', 'Linguagens', LC, ['LC-H23', 'LC-H24'], [], 'l-cpe'),
  S('lin-generos', 'Gêneros textuais e sua função social', 'Linguagens', LC, ['LC-H18', 'LC-H21']),
  S('lin-funcoes', 'Funções da linguagem', 'Linguagens', LC, ['LC-H19']),
  S('lin-variacao', 'Variação linguística', 'Linguagens', LC, ['LC-H25', 'LC-H26']),
  S('lit-leitura', 'Leitura do texto literário', 'Linguagens', LC, ['LC-H16', 'LC-H17'], ['lin-interpretacao']),
  S('lin-ingles', 'Leitura em língua inglesa', 'Linguagens', LC, ['LC-H5', 'LC-H7']),
  // Ciências Humanas
  S('his-colonia', 'Escravidão e resistência no Brasil', 'Humanas', CH, ['CH-H3', 'CH-H15']),
  S('hum-historia', 'Era Vargas e trabalho', 'Humanas', CH, ['CH-H22'], [], 'l-vargas'),
  S('hum-geografia', 'Urbanização brasileira', 'Humanas', CH, ['CH-H18', 'CH-H19']),
  S('geo-agrario', 'Espaço agrário brasileiro', 'Humanas', CH, ['CH-H18', 'CH-H19']),
  S('hum-filosofia', 'Contratualismo', 'Humanas', CH, ['CH-H23', 'CH-H24']),
  S('fil-antiga', 'Sócrates e os sofistas', 'Humanas', CH, ['CH-H14', 'CH-H23']),
  S('soc-cultura', 'Indústria cultural', 'Humanas', CH, ['CH-H21', 'CH-H4']),
  S('soc-movimentos', 'Movimentos sociais e cidadania', 'Humanas', CH, ['CH-H13', 'CH-H22']),
];

export const skillById = (id: string) => SKILLS.find((s) => s.id === id);
export const prerequisitesOf = (id: string) => skillById(id)?.prerequisites ?? [];
/** Áreas corrigidas com o método CPE (as demais usam o formulário de classificação de erros). */
export const isVerbalArea = (area: Area) => area === 'Linguagens' || area === 'Ciências Humanas';

/** Erro típico associado a uma alternativa (evidência fraca: nunca define sozinha a causa). */
export const ERROR_LABELS: Record<ErrorType, { label: string; tip: string }> = {
  lacuna_conceitual: { label: 'Lacuna conceitual', tip: 'Volte à explicação do conceito antes de novas questões.' },
  interpretacao: { label: 'Interpretação inadequada', tip: 'Releia o comando e sublinhe o que é pedido.' },
  formula_incorreta: { label: 'Relação ou procedimento inadequado', tip: 'Liste as relações possíveis e escolha pela informação disponível.' },
  grandeza_constante: { label: 'Grandeza constante não reconhecida', tip: 'Antes de calcular, pergunte: o que NÃO muda nesta situação?' },
  calculo: { label: 'Erro de cálculo', tip: 'Refaça a conta estimando a ordem de grandeza.' },
  unidades: { label: 'Conversão de unidades', tip: 'Escreva as unidades em cada passo e converta antes de substituir.' },
  desatencao: { label: 'Leitura incompleta', tip: 'Confira se a resposta atende exatamente ao que foi pedido.' },
  alternativas_plausiveis: { label: 'Confusão entre alternativas próximas', tip: 'Procure excesso, generalização ou inversão.' },
  memorizacao: { label: 'Falha de recuperação', tip: 'Transforme em flashcard e revise em intervalos crescentes.' },
};

/** Formulário opcional de Matemática e Ciências da Natureza (autoclassificação = evidência, não verdade absoluta). */
export const ERROR_CATEGORIES: { id: ErrorCategory; label: string; hint: string }[] = [
  { id: 'lacuna', label: 'Lacuna de conhecimento', hint: 'Não conhecia o conteúdo.' },
  { id: 'conceitual', label: 'Conceitual', hint: 'Compreendia incorretamente o conceito.' },
  { id: 'interpretativa', label: 'Interpretativa', hint: 'Não interpretei corretamente o enunciado.' },
  { id: 'aplicacao', label: 'Aplicação', hint: 'Conhecia a teoria, mas não sabia utilizá-la.' },
  { id: 'procedimental', label: 'Procedimental', hint: 'Errei o cálculo ou alguma etapa.' },
  { id: 'atencao', label: 'Atenção', hint: 'Sabia resolver, mas cometi um descuido.' },
  { id: 'nao_sei', label: 'Não sei identificar', hint: '' },
];
export const errorCategoryLabel = (id: ErrorCategory) => ERROR_CATEGORIES.find((c) => c.id === id)!.label;
