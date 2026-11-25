import type { CompId, EssayEval } from '../types';

/**
 * REDAÇÃO COMO DISCIPLINA: cada competência é subdividida em habilidades com aula curta, parágrafo para análise,
 * explicação ativa e exercício. `signal` lê a avaliação formativa do texto (evidência, não nota oficial).
 */
export interface EssaySkill {
  id: string; comp: CompId; name: string; lesson: string[];
  analysis?: { text: string; question: string; options: string[]; answer: number; feedback: string };
  explain: { prompt: string; need: RegExp[]; reference: string };
  practice: string;
  signal: (e: EssayEval) => 'ok' | 'parcial' | 'ausente' | null;
}
const asp = (label: string) => (e: EssayEval) => e.aspects.find((a) => a.label === label)?.status ?? null;
const hl = (re: RegExp) => (e: EssayEval) => { const n = e.highlights.filter((h) => h.comp === 'C1' && re.test(h.message)).length; return n === 0 ? 'ok' as const : n <= 1 ? 'parcial' as const : 'ausente' as const; };

export const COMP_INFO: Record<CompId, { name: string; desc: string }> = {
  C1: { name: 'Domínio da norma-padrão', desc: 'Demonstrar domínio da modalidade escrita formal.' },
  C2: { name: 'Compreensão do tema e estrutura', desc: 'Compreender a proposta e desenvolver o tema em texto dissertativo-argumentativo.' },
  C3: { name: 'Seleção e organização de argumentos', desc: 'Selecionar, relacionar e interpretar informações em defesa de um ponto de vista.' },
  C4: { name: 'Mecanismos linguísticos da argumentação', desc: 'Usar recursos coesivos que articulam o texto.' },
  C5: { name: 'Proposta de intervenção', desc: 'Elaborar proposta detalhada, respeitando os direitos humanos.' },
};

export const ESSAY_SKILLS: EssaySkill[] = [
  { id: 'c1-concordancia', comp: 'C1', name: 'Concordância e regência', lesson: ['O verbo concorda com o núcleo do sujeito, mesmo distante: "A falta de políticas públicas **compromete**…".', '"Haver" (existir) e "fazer" (tempo) são impessoais: "houve problemas", "faz dez anos".', 'Crase: só há "à" antes de palavra feminina que aceite artigo.'],
    analysis: { text: 'A ausência de campanhas educativas nas cidades brasileiras fazem com que houveram mais acidentes.', question: 'Qual versão corrige todos os desvios?', options: ['A ausência de campanhas educativas fazem com que houve mais acidentes.', 'A ausência de campanhas educativas faz com que haja mais acidentes.', 'As ausências de campanha faz com que hajam mais acidentes.'], answer: 1, feedback: 'O sujeito é "a ausência" (faz), e "haver" no sentido de existir fica no singular (haja).' },
    explain: { prompt: 'Explique por que se escreve "a maioria dos jovens tem" e "houve mudanças".', need: [/(n[uú]cleo|sujeito|concord|maioria|singular)/i, /(impessoal|existir|n[aã]o (tem|flex)|singular)/i], reference: 'O verbo concorda com o núcleo do sujeito (a maioria, singular); "haver" no sentido de existir é impessoal e fica no singular.' },
    practice: 'Reescreva um parágrafo seu conferindo, em cada frase, qual é o núcleo do sujeito.', signal: hl(/concord|impessoal|crase/i) },
  { id: 'c1-registro', comp: 'C1', name: 'Registro formal e vocabulário', lesson: ['Evite interlocução ("você", "a gente") e marcas de oralidade.', 'Troque termos vagos ("coisa", "algo") por substantivos precisos.', 'Períodos longos demais favorecem desvios: divida-os.'],
    analysis: { text: 'Hoje em dia a gente vê muita coisa errada na internet, né?', question: 'O que mais compromete o registro?', options: ['A falta de repertório', 'Marcas de oralidade e vocabulário vago', 'A ausência de conectivos'], answer: 1, feedback: '"A gente", "coisa" e "né" são marcas informais e imprecisas.' },
    explain: { prompt: 'Explique por que o registro formal é exigido na dissertação do ENEM.', need: [/(formal|norma|padr[aã]o|situa|g[eê]nero|comunica)/i], reference: 'O gênero e a situação de comunicação pedem impessoalidade e norma-padrão, avaliadas na Competência 1.' },
    practice: 'Reescreva três frases suas eliminando oralidade e termos vagos.', signal: hl(/informal|oralidade|vago|longo/i) },
  { id: 'c2-recorte', comp: 'C2', name: 'Abordagem completa do tema', lesson: ['Separe o tema em partes: problema + grupo + lugar + o que se pede (desafios, caminhos, impactos).', 'Todas as partes precisam aparecer; o ideal é retomá-las já na tese.', 'Esquecer uma parte é tangenciar o tema.'],
    analysis: { text: 'Tema: "Desafios para a permanência de jovens no ensino médio brasileiro". Tese: "A educação é importante para o país".', question: 'O que falta na tese?', options: ['Repertório', 'As partes do recorte: desafios, permanência, jovens, ensino médio', 'Proposta de intervenção'], answer: 1, feedback: 'A tese fala de educação em geral: tangencia o tema.' },
    explain: { prompt: 'Explique o que é tangenciar o tema e como evitar.', need: [/(tema|recorte|parte|palavra)/i, /(n[aã]o|parcial|fug|margem|deix|todas)/i], reference: 'Tangenciar é abordar o assunto sem tratar do recorte completo. Evita-se separando as partes do tema e retomando-as na tese e nos argumentos.' },
    practice: 'Escreva uma tese que contenha todas as partes do tema escolhido.', signal: asp('Adequação ao tema') },
  { id: 'c2-repertorio', comp: 'C2', name: 'Repertório sociocultural produtivo', lesson: ['Repertório legitimado: lei, dado com fonte, obra, conceito, fato histórico.', 'Pertinente ao tema e **produtivo**: explicado e ligado ao argumento.', 'Citar sem explicar não é uso produtivo.'],
    analysis: { text: 'Segundo Bauman, vivemos na modernidade líquida. Além disso, as notícias falsas crescem no Brasil.', question: 'O repertório é produtivo?', options: ['Sim, pois cita um sociólogo', 'Não, pois não é ligado ao argumento', 'Sim, pois há conectivo'], answer: 1, feedback: 'Falta explicar como a fluidez das relações favorece a desinformação.' },
    explain: { prompt: 'Explique a diferença entre citar um repertório e usá-lo de forma produtiva.', need: [/(explic|relacion|lig|articul|conect)/i, /(argument|tese|ideia|tema)/i], reference: 'Citar é só mencionar. O uso produtivo explica o repertório e o relaciona ao argumento, mostrando como ele sustenta a tese.' },
    practice: 'Escolha um repertório que você domina e escreva a frase que o liga ao seu argumento.', signal: asp('Relação repertório–argumento') },
  { id: 'c3-tese', comp: 'C3', name: 'Tese e projeto de texto', lesson: ['A tese responde ao tema e anuncia os eixos que serão desenvolvidos.', 'Cada eixo vira um parágrafo de desenvolvimento.', 'A conclusão retoma os mesmos eixos.'],
    analysis: { text: 'Nota-se, portanto, que a desinformação persiste no Brasil devido à lógica das plataformas e à falta de educação midiática.', question: 'Quantos eixos a tese anuncia?', options: ['Um', 'Dois', 'Nenhum'], answer: 1, feedback: 'Lógica das plataformas e falta de educação midiática.' },
    explain: { prompt: 'Explique a função da tese no projeto de texto.', need: [/(eixo|argument|desenvolv|par[aá]grafo)/i, /(anunci|apresent|antecip|organiz|orient|guia|ponto de vista)/i], reference: 'A tese apresenta o ponto de vista e antecipa os eixos argumentativos, que organizam os parágrafos de desenvolvimento e a conclusão.' },
    practice: 'Escreva uma introdução com contexto e tese de dois eixos.', signal: asp('Tese') },
  { id: 'c3-desenvolvimento', comp: 'C3', name: 'Desenvolvimento argumentativo', lesson: ['Estrutura útil: tópico frasal → repertório → articulação → consequência.', 'Depois de cada afirmação, pergunte "por quê?" e "o que isso provoca?".', 'Afirmação sem explicação é argumento incompleto.'],
    analysis: { text: 'Em primeiro lugar, o Estado é omisso. Isso é muito grave e precisa mudar urgentemente.', question: 'Qual é o principal problema?', options: ['Falta conectivo', 'Falta explicar causa e consequência', 'Falta proposta'], answer: 1, feedback: 'O parágrafo afirma e julga, mas não explica como a omissão gera o problema.' },
    explain: { prompt: 'Explique o que torna um argumento desenvolvido, e não apenas afirmado.', need: [/(causa|por qu[eê]|explic|motiv)/i, /(consequ|efeito|resultado|provoca|impact)/i], reference: 'Um argumento desenvolvido explica a causa, apresenta fundamentação e mostra a consequência, ligando tudo à tese.' },
    practice: 'Escreva um parágrafo com tópico frasal, repertório, articulação e consequência.', signal: asp('Causas e consequências') },
  { id: 'c4-conectivos', comp: 'C4', name: 'Encadeamento com conectivos', lesson: ['Entre parágrafos: "Em primeiro lugar", "Além disso", "Portanto".', 'Dentro deles: causa ("visto que"), consequência ("dessa forma"), oposição ("contudo").', 'Varie e use o conectivo que expressa a relação correta.'],
    analysis: { text: 'O governo investe pouco em prevenção. Contudo, os casos aumentam.', question: 'O conectivo expressa a relação correta?', options: ['Sim, é oposição', 'Não, a relação é de consequência', 'Não, a relação é de adição'], answer: 1, feedback: 'O aumento decorre do baixo investimento: "por isso", "consequentemente".' },
    explain: { prompt: 'Explique por que usar muitos conectivos não garante boa coesão.', need: [/(rela[cç][aã]o|sentido|adequad|correto)/i, /(repet|vari|excess|n[aã]o)/i], reference: 'O conectivo precisa expressar a relação lógica correta. Excesso, repetição ou uso inadequado prejudicam o encadeamento.' },
    practice: 'Reescreva um parágrafo trocando conectivos repetidos por outros de mesmo valor.', signal: asp('Coesão') },
  { id: 'c4-progressao', comp: 'C4', name: 'Progressão e retomada', lesson: ['Retome o referente com pronomes e sinônimos ("esse cenário", "tal prática").', 'Cada parágrafo deve acrescentar informação e se ligar ao anterior.'],
    analysis: { text: 'A desinformação cresce. A desinformação prejudica. A desinformação precisa acabar.', question: 'O que falta?', options: ['Retomada por pronomes ou sinônimos', 'Mais repertório', 'Crase'], answer: 0, feedback: 'A repetição do termo indica pouca referenciação.' },
    explain: { prompt: 'Explique como a referenciação ajuda a progressão do texto.', need: [/(pronome|sin[oô]nim|retom|refer)/i, /(repet|avan|lig|continu|progre)/i], reference: 'Pronomes e sinônimos retomam o que foi dito sem repetição e permitem acrescentar informação nova.' },
    practice: 'Reescreva um trecho substituindo repetições por retomadas.', signal: asp('Progressão argumentativa') },
  { id: 'c5-elementos', comp: 'C5', name: 'Elementos da proposta', lesson: ['Agente, ação, meio, finalidade e detalhamento.', 'Agente específico ("Ministério da Educação"), ação concreta, meio com "por meio de", finalidade com "a fim de".', 'O detalhamento pode explicar o agente (aposto), o meio ou a finalidade.'],
    analysis: { text: 'O governo deve fazer campanhas para melhorar a situação.', question: 'O que falta à proposta?', options: ['Ação', 'Agente', 'Meio e detalhamento'], answer: 2, feedback: 'Há agente genérico, ação e finalidade vaga; faltam meio e detalhamento.' },
    explain: { prompt: 'Explique a função de cada elemento da proposta de intervenção.', need: [/agente|quem/i, /(a[cç][aã]o|o que)/i, /(meio|como)/i, /(finalidade|para qu[eê]|objetivo)/i], reference: 'Agente (quem), ação (o que), meio (como), finalidade (para quê) e detalhamento (especificação de um deles).' },
    practice: 'Escreva uma conclusão com os cinco elementos.', signal: (e) => { const n = Object.values(e.intervention).filter(Boolean).length; return n >= 5 ? 'ok' : n >= 3 ? 'parcial' : 'ausente'; } },
  { id: 'c5-pertinencia', comp: 'C5', name: 'Pertinência e articulação', lesson: ['A proposta deve enfrentar as causas discutidas no texto.', 'Ela respeita os direitos humanos e retoma o tema.'],
    analysis: { text: 'Argumento: falta educação midiática. Proposta: aumentar as penas para quem compartilha boatos.', question: 'A proposta é articulada ao argumento?', options: ['Sim', 'Não, pois não enfrenta a causa discutida'], answer: 1, feedback: 'Se a causa é a falta de educação midiática, a proposta deveria tratar dela.' },
    explain: { prompt: 'Explique por que a proposta precisa retomar os argumentos.', need: [/(causa|argument|problema)/i, /(resolv|enfrent|articul|coer|retom|relacion)/i], reference: 'Porque deve enfrentar as causas discutidas, dando coerência ao projeto de texto.' },
    practice: 'Para cada causa do seu texto, escreva uma ação que a enfrente.', signal: asp('Proposta de intervenção') },
];
export const essaySkillById = (id: string) => ESSAY_SKILLS.find((s) => s.id === id);
export const essaySkillsOf = (c: CompId) => ESSAY_SKILLS.filter((s) => s.comp === c);
