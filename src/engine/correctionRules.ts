import type { Question } from '../types';
import { isVerbalArea } from '../data/skills';

/** CPE: só em erros de questões médias e difíceis de Linguagens e Ciências Humanas, quando há material para isso. */
export const usesCpe = (q: Question, correct: boolean) => !correct && isVerbalArea(q.area) && q.difficulty !== 'Fácil' && !!q.cpe;
/** Formulário opcional de causa: só em erros de Matemática e Ciências da Natureza. */
export const usesErrorForm = (q: Question, correct: boolean) => !correct && !isVerbalArea(q.area);
