import { SKILLS, skillById } from './skills';

/**
 * CURRÍCULO: Área → Disciplina → Bloco → Conteúdo → Habilidade.
 * Estrutura PROVISÓRIA e extensível: conteúdos sem habilidades cadastradas aparecem como "em cadastramento" e não entram
 * nos indicadores. Para ampliar, acrescente habilidades em skills.ts e liste seus ids no conteúdo correspondente.
 */
export interface Content { id: string; name: string; skills: string[] }
export interface Block { id: string; name: string; contents: Content[] }
export interface Discipline { id: string; name: string; blocks: Block[] }
export interface CurrArea { id: 'CN' | 'MT' | 'LC' | 'CH'; name: string; disciplines: Discipline[] }

type C = [string, string[]?];
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const B = (disc: string, name: string, ...contents: C[]): Block => ({ id: `${disc}-${slug(name)}`, name, contents: contents.map(([n, skills]) => ({ id: `${disc}-${slug(n)}`, name: n, skills: skills ?? [] })) });
const D = (id: string, name: string, ...blocks: Block[]): Discipline => ({ id, name, blocks });

export const CURRICULUM: CurrArea[] = [
  { id: 'CN', name: 'Ciências da Natureza', disciplines: [
    D('fisica', 'Física',
      B('fisica', 'Mecânica', ['Cinemática', ['fis-cinematica']], ['Dinâmica', ['fis-dinamica', 'fis-centripeta']], ['Trabalho e energia', ['fis-energia']], ['Hidrostática'], ['Gravitação']),
      B('fisica', 'Óptica', ['Reflexão e espelhos'], ['Refração e lentes'], ['Óptica da visão']),
      B('fisica', 'Termologia', ['Calorimetria'], ['Transmissão de calor'], ['Termodinâmica']),
      B('fisica', 'Ondulatória', ['Ondas', ['fis-ondas']], ['Acústica'], ['Fenômenos ondulatórios']),
      B('fisica', 'Eletromagnetismo', ['Eletrostática'], ['Eletrodinâmica', ['fis-potencia', 'fis-energia-eletrica']], ['Magnetismo', ['fis-campo-magnetico', 'fis-forca-magnetica']], ['Indução', ['fis-inducao']])),
    D('quimica', 'Química',
      B('quimica', 'Química geral', ['Separação de misturas', ['qui-separacao']], ['Modelos atômicos'], ['Tabela periódica'], ['Ligações e interações'], ['Funções inorgânicas']),
      B('quimica', 'Físico-química', ['Estequiometria', ['qui-estequiometria']], ['Soluções', ['qui-concentracao']], ['Termoquímica'], ['Cinética'], ['Equilíbrio químico', ['qui-equilibrio', 'qui-ph']], ['Eletroquímica', ['qui-eletroquimica']]),
      B('quimica', 'Química orgânica', ['Hidrocarbonetos'], ['Funções orgânicas'], ['Reações orgânicas'], ['Polímeros'])),
    D('biologia', 'Biologia',
      B('biologia', 'Citologia e bioenergética', ['Membrana e transporte', ['bio-citologia']], ['Organelas'], ['Fotossíntese e respiração']),
      B('biologia', 'Fisiologia humana', ['Sistema endócrino', ['bio-hormonios']], ['Sistema excretor', ['bio-osmorregulacao']], ['Sistema imunológico'], ['Sistema digestório']),
      B('biologia', 'Ecologia', ['Cadeias e fluxos', ['bio-ecologia']], ['Ciclos biogeoquímicos'], ['Impactos ambientais']),
      B('biologia', 'Genética e evolução', ['Genética mendeliana', ['bio-genetica']], ['Biotecnologia'], ['Evolução']),
      B('biologia', 'Diversidade da vida', ['Botânica'], ['Zoologia'], ['Microbiologia'])),
  ] },
  { id: 'MT', name: 'Matemática', disciplines: [
    D('matematica', 'Matemática',
      B('matematica', 'Matemática básica', ['Razão e proporção', ['mat-proporcao']], ['Porcentagem', ['mat-porcentagem']], ['Escalas e unidades']),
      B('matematica', 'Estatística e probabilidade', ['Medidas de tendência central', ['mat-estatistica']], ['Probabilidade', ['mat-probabilidade']], ['Análise combinatória'], ['Gráficos e tabelas']),
      B('matematica', 'Funções', ['Função afim', ['mat-funcoes']], ['Função quadrática', ['mat-quadratica']], ['Exponencial e logaritmo']),
      B('matematica', 'Geometria', ['Geometria plana', ['mat-areas']], ['Geometria espacial', ['mat-geometria']], ['Trigonometria'], ['Geometria analítica'])),
  ] },
  { id: 'LC', name: 'Linguagens', disciplines: [
    D('portugues', 'Língua Portuguesa',
      B('portugues', 'Leitura e interpretação', ['Interpretação e argumentação', ['lin-interpretacao']], ['Gêneros textuais', ['lin-generos']], ['Progressão temática']),
      B('portugues', 'Língua e uso', ['Funções da linguagem', ['lin-funcoes']], ['Variação linguística', ['lin-variacao']], ['Norma culta em contexto'])),
    D('literatura', 'Literatura e Artes',
      B('literatura', 'Literatura', ['Leitura literária', ['lit-leitura']], ['Modernismo'], ['Realismo'], ['Literatura contemporânea']),
      B('literatura', 'Artes e corpo', ['Arte contemporânea'], ['Patrimônio artístico'], ['Práticas corporais'])),
    D('ingles', 'Língua estrangeira', B('ingles', 'Inglês', ['Leitura em inglês', ['lin-ingles']]), B('ingles', 'Espanhol', ['Leitura em espanhol'])),
  ] },
  { id: 'CH', name: 'Ciências Humanas', disciplines: [
    D('historia', 'História',
      B('historia', 'História do Brasil', ['Brasil Colônia', ['his-colonia']], ['Brasil Império'], ['Primeira República'], ['Era Vargas', ['hum-historia']], ['Ditadura e redemocratização']),
      B('historia', 'História geral', ['Antiguidade'], ['Idade Média'], ['Idade Moderna'], ['Século XX'])),
    D('geografia', 'Geografia',
      B('geografia', 'Geografia humana', ['Espaço urbano', ['hum-geografia']], ['Espaço agrário', ['geo-agrario']], ['População e migrações'], ['Geopolítica e globalização']),
      B('geografia', 'Geografia física', ['Geologia e relevo'], ['Clima e vegetação'], ['Questões ambientais'])),
    D('filosofia', 'Filosofia', B('filosofia', 'História da filosofia', ['Filosofia antiga', ['fil-antiga']], ['Filosofia moderna'], ['Filosofia contemporânea']), B('filosofia', 'Ética e política', ['Filosofia política', ['hum-filosofia']], ['Ética'])),
    D('sociologia', 'Sociologia', B('sociologia', 'Cultura e sociedade', ['Indústria cultural', ['soc-cultura']], ['Identidade e diversidade']), B('sociologia', 'Poder e cidadania', ['Movimentos sociais', ['soc-movimentos']], ['Estado e cidadania'], ['Trabalho'])),
  ] },
];

export const ALL_DISCIPLINES = CURRICULUM.flatMap((a) => a.disciplines.map((d) => ({ ...d, areaId: a.id, areaName: a.name })));
export const ALL_BLOCKS = ALL_DISCIPLINES.flatMap((d) => d.blocks.map((b) => ({ ...b, disciplineId: d.id, disciplineName: d.name, areaId: d.areaId, areaName: d.areaName })));
export type FullBlock = (typeof ALL_BLOCKS)[number];
export const blockById = (id: string) => ALL_BLOCKS.find((b) => b.id === id);
export const blockSkills = (b: Block) => b.contents.flatMap((c) => c.skills);
const PLACE = new Map(ALL_BLOCKS.flatMap((b) => b.contents.flatMap((c) => c.skills.map((s) => [s, { block: b, content: c }] as const))));
export const placeOf = (skillId: string) => PLACE.get(skillId);
export const blockOf = (skillId: string) => PLACE.get(skillId)?.block;
export const disciplineOf = (skillId: string) => PLACE.get(skillId)?.block.disciplineName ?? skillById(skillId)?.subject ?? '';

/** Habilidades registradas sem lugar no currículo (deve ser sempre vazio; verificado em teste). */
export const orphanSkills = () => SKILLS.filter((s) => !PLACE.has(s.id)).map((s) => s.id);
