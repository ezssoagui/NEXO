import type { Profile } from '../types';

/**
 * Perfis de exemplo: preenchem o cadastro. O histórico fictício que os acompanha
 * é gerado em demoStudent.ts.
 */
export const PERSONAS: Record<'iniciante' | 'avancado' | 'olimpico', { label: string; desc: string; profile: Profile }> = {
  iniciante: {
    label: 'Lia — iniciante, escola pública', desc: '2º ano, escola estadual, foco em ENEM (Enfermagem). Dificuldades em Matemática e Física.',
    profile: { nickname: 'Lia', grade: '2º ano do ensino médio', schoolType: 'publica', schoolId: 's2', institution: 'EEEFM Vale Verde (fictícia)', goal: 'ENEM', course: 'Enfermagem', difficulties: ['Matemática', 'Física'], weeklyHours: 5, examYear: 2028, personalGoal: 'Chegar a 700 pontos em Ciências da Natureza', persona: 'iniciante' },
  },
  avancado: {
    label: 'Caio — avançado, instituto federal', desc: '3º ano, Instituto Federal, ENEM + vestibular (Engenharia Elétrica).',
    profile: { nickname: 'Caio', grade: '3º ano do ensino médio', schoolType: 'federal', schoolId: 's1', institution: 'Instituto Federal Litoral Norte (fictício)', goal: 'Combinada', course: 'Engenharia Elétrica', difficulties: ['Linguagens', 'Humanas'], weeklyHours: 14, examYear: 2026, personalGoal: 'Média 780 no ENEM', persona: 'avancado' },
  },
  olimpico: {
    label: 'Iara — foco em olimpíadas', desc: '1º ano, escola particular, olimpíadas de Matemática e Física.',
    profile: { nickname: 'Iara', grade: '1º ano do ensino médio', schoolType: 'particular', schoolId: 's3', institution: 'Colégio Horizonte (fictício)', goal: 'Olimpíadas', course: 'Física', difficulties: ['Linguagens', 'Biologia'], weeklyHours: 10, examYear: 2027, personalGoal: 'Medalha em olimpíada de Física', persona: 'olimpico' },
  },
};
