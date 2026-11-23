// Todos os dados abaixo são FICTÍCIOS e servem apenas para demonstração.

export interface School { id: string; name: string; category: 'Instituto Federal' | 'Pública' | 'Particular'; city: string; activeStudents: number; accuracy: number; growth: number; participation: number; regularity: number }
export const SCHOOLS: School[] = [
  { id: 's1', name: 'Instituto Federal Litoral Norte', category: 'Instituto Federal', city: 'Cidade fictícia A', activeStudents: 184, accuracy: 0.71, growth: 0.09, participation: 0.62, regularity: 0.58 },
  { id: 's2', name: 'EEEFM Vale Verde', category: 'Pública', city: 'Cidade fictícia B', activeStudents: 61, accuracy: 0.63, growth: 0.17, participation: 0.74, regularity: 0.69 },
  { id: 's3', name: 'Colégio Horizonte', category: 'Particular', city: 'Cidade fictícia C', activeStudents: 297, accuracy: 0.74, growth: 0.05, participation: 0.41, regularity: 0.47 },
  { id: 's4', name: 'Escola Municipal Rio Claro', category: 'Pública', city: 'Cidade fictícia D', activeStudents: 23, accuracy: 0.58, growth: 0.21, participation: 0.81, regularity: 0.72 },
  { id: 's5', name: 'Instituto Federal Serra Azul', category: 'Instituto Federal', city: 'Cidade fictícia E', activeStudents: 9, accuracy: 0.8, growth: 0.12, participation: 0.9, regularity: 0.85 },
];
export const MIN_PARTICIPANTS = 15;

export interface Team { id: string; name: string; kind: 'Escola' | 'Turma' | 'Amigos' | 'Objetivo'; members: string[]; schoolId?: string }
export const TEAMS: Team[] = [
  { id: 'tm1', name: 'Circuito Fechado', kind: 'Objetivo', members: ['Rafa', 'Duda', 'Kenji'], schoolId: 's1' },
  { id: 'tm2', name: 'Turma 3ºB — Vale Verde', kind: 'Turma', members: ['Bia', 'Thiago', 'Luan', 'Mel'], schoolId: 's2' },
  { id: 'tm3', name: 'Rumo à Medicina', kind: 'Objetivo', members: ['Ana', 'Pedro'] },
];

export interface Challenge { id: string; title: string; description: string; kind: 'individual' | 'equipe' | 'torneio'; goal: number; unit: string; xp: number; skillArea?: string; questionIds: string[] }
export const CHALLENGES: Challenge[] = [
  { id: 'c1', title: 'Domínio em Natureza', description: 'Sua equipe precisa demonstrar domínio em 5 habilidades de Ciências da Natureza nesta semana.', kind: 'equipe', goal: 5, unit: 'habilidades', xp: 120, skillArea: 'Ciências da Natureza', questionIds: ['q05', 'q08', 'q14', 'q15', 'q12'] },
  { id: 'c2', title: 'Batalha de Matemática — rodada 1', description: 'Confronto demonstrativo: 3 questões inéditas para você. Pontua quem acerta com segurança, não quem chuta.', kind: 'torneio', goal: 3, unit: 'questões', xp: 80, questionIds: ['q19', 'q20', 'q22'] },
  { id: 'c3', title: 'Detetive de interpretação', description: 'Resolva 2 questões interpretativas justificando pelo método C-P-E.', kind: 'individual', goal: 2, unit: 'questões', xp: 60, questionIds: ['q24', 'q25'] },
  { id: 'c4', title: 'Revisão consistente', description: 'Revise 10 flashcards em pelo menos 2 dias diferentes da semana.', kind: 'individual', goal: 10, unit: 'cartões', xp: 50, questionIds: [] },
];

export const TOURNAMENTS = [
  { id: 'to1', name: 'Copa de Ciências da Natureza', status: 'Em andamento', ends: 'em 4 dias', participants: 312 },
  { id: 'to2', name: 'Batalha de Matemática', status: 'Em andamento', ends: 'em 2 dias', participants: 188 },
  { id: 'to3', name: 'Desafio da Redação', status: 'Inscrições abertas', ends: 'começa em 6 dias', participants: 94 },
  { id: 'to4', name: 'Copa ENEM ES', status: 'Em breve', ends: 'próximo mês', participants: 0 },
  { id: 'to5', name: 'Olimpíada NEXO', status: 'Em breve', ends: 'próximo bimestre', participants: 0 },
];

export const LEAGUES = [
  { name: 'Iniciante', min: 0, color: '#94a3b8' },
  { name: 'Bronze', min: 2, color: '#b45309' },
  { name: 'Prata', min: 4, color: '#64748b' },
  { name: 'Ouro', min: 7, color: '#ca8a04' },
  { name: 'Diamante', min: 11, color: '#0891b2' },
  { name: 'Mestre', min: 16, color: '#7c3aed' },
];

export const EXAM_DNA = [
  { exam: 'ENEM', format: '180 questões objetivas em 2 dias + redação dissertativo-argumentativa', scoring: 'Teoria de Resposta ao Item (TRI) nas objetivas; redação em 5 competências (0–1000)', reasoning: 'Interpretação de contextos, leitura de gráficos/tabelas, interdisciplinaridade', strengths: ['Leitura atenta de textos longos', 'Gestão de tempo', 'Coerência pedagógica (TRI)'], status: 'Informações gerais públicas' },
  { exam: 'Vestibulares tradicionais', format: 'Varia por instituição: objetivas e/ou discursivas, 1 ou 2 fases', scoring: 'Varia; muitas usam nota bruta e pesos por curso', reasoning: 'Conteúdo mais aprofundado, discursivas exigem desenvolvimento escrito', strengths: ['Precisão conceitual', 'Escrita de resoluções'], status: 'Demonstrativo — consulte o edital de cada instituição' },
  { exam: 'Olimpíadas científicas', format: 'Fases eliminatórias; problemas abertos e demonstrações', scoring: 'Correção de soluções completas, com pontuação parcial', reasoning: 'Criatividade, raciocínio matemático rigoroso, modelagem', strengths: ['Demonstração', 'Persistência em problemas longos'], status: 'Demonstrativo — consulte o regulamento oficial' },
];
export const DNA_RADAR = [
  { k: 'Interpretação', ENEM: 95, Vestibular: 70, Olimpíada: 60 },
  { k: 'Profundidade conceitual', ENEM: 60, Vestibular: 85, Olimpíada: 95 },
  { k: 'Cálculo', ENEM: 55, Vestibular: 75, Olimpíada: 90 },
  { k: 'Contextualização', ENEM: 95, Vestibular: 60, Olimpíada: 50 },
  { k: 'Escrita', ENEM: 80, Vestibular: 75, Olimpíada: 70 },
  { k: 'Gestão de tempo', ENEM: 90, Vestibular: 70, Olimpíada: 60 },
];

export const ADMIN_METRICS = {
  students: 12480, active7d: 4120, retentionWeekly: [100, 64, 52, 47, 44, 42, 41, 40],
  conversion: 0.054, essays: 2310, solved: 186400, mrr: 16740, plusUsers: 672,
  aiCostPerUser: { free: 0.38, plus: 3.9 },
  topContents: [{ name: 'Potência elétrica', v: 1820 }, { name: 'Interpretação C-P-E', v: 1640 }, { name: 'Porcentagem', v: 1410 }, { name: 'Equilíbrio químico', v: 1180 }, { name: 'Era Vargas', v: 760 }],
  reports: [{ q: 'q22', reason: 'Dúvida sobre alternativa C', status: 'Em análise' }, { q: 'Gerada IA #G-14', reason: 'Unidade inconsistente', status: 'Rejeitada' }, { q: 'l-solucoes', reason: 'Sugestão de exemplo', status: 'Resolvida' }],
  monthly: [{ m: 'Jun', mrr: 6200, cost: 2900 }, { m: 'Jul', mrr: 8100, cost: 3500 }, { m: 'Ago', mrr: 10400, cost: 4100 }, { m: 'Set', mrr: 12900, cost: 4700 }, { m: 'Out', mrr: 14800, cost: 5200 }, { m: 'Nov', mrr: 16740, cost: 5650 }],
};

export const CLASS_STUDENTS = ['Aluno 01', 'Aluno 02', 'Aluno 03', 'Aluno 04', 'Aluno 05', 'Aluno 06', 'Aluno 07', 'Aluno 08', 'Aluno 09', 'Aluno 10', 'Aluno 11', 'Aluno 12', 'Aluno 13', 'Aluno 14', 'Aluno 15', 'Aluno 16', 'Aluno 17', 'Aluno 18'];
