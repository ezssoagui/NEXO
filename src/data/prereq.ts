import type { Question } from '../types';

// Questões ORIGINAIS de pré-requisito: razão, proporção e regra de três.
export const PREREQ_QUESTIONS: Question[] = [
  {
    id: 'q37', exam: 'ENEM', style: 'Estilo ENEM', subject: 'Matemática', area: 'Matemática', topic: 'Proporção direta', skillId: 'mat-proporcao',
    year: 2026, difficulty: 'Fácil', type: 'objetiva', source: 'original_nexo', lessonId: 'l-proporcao', twinId: 'q38',
    context: 'Uma receita de pão usa 3 xícaras de farinha para render 12 pães. Uma padaria comunitária quer produzir 40 pães com a mesma receita.',
    statement: 'A quantidade de farinha necessária é de',
    alternatives: [
      { letter: 'A', text: '10 xícaras.', correct: true, analysis: 'Correta. Proporção direta: 3/12 = x/40 → x = 10.' },
      { letter: 'B', text: '31 xícaras.', errorType: 'formula_incorreta', analysis: 'Somou a diferença (40 − 12 = 28) às 3 xícaras: proporção tratada como soma.', tutorPrompt: 'Se a quantidade de pães é multiplicada, a farinha deve ser somada ou multiplicada pelo mesmo fator?' },
      { letter: 'C', text: '0,9 xícara.', errorType: 'formula_incorreta', analysis: 'Montou a proporção invertida (como se fosse inversamente proporcional).', tutorPrompt: 'Mais pães exigem mais ou menos farinha? Isso é proporção direta ou inversa?' },
      { letter: 'D', text: '160 xícaras.', errorType: 'calculo', analysis: 'Multiplicou 40 por 4 em vez de dividir 40 por 4.', tutorPrompt: '3 xícaras rendem 12 pães. Quantos pães cada xícara rende?' },
      { letter: 'E', text: '13 xícaras.', errorType: 'calculo', analysis: 'Erro na divisão final.', tutorPrompt: 'Confira: 3 × 40 ÷ 12 = ?' },
    ],
    hints: ['Mais pães → mais farinha, na mesma razão.', 'Cada xícara rende 12 ÷ 3 = 4 pães.', '40 ÷ 4 = 10 xícaras.'],
    explanation: 'Farinha e número de pães são diretamente proporcionais: 3/12 = x/40. Multiplicando cruzado: 12x = 120 → x = 10 xícaras.',
    fastMethod: 'Encontre a taxa unitária (4 pães por xícara) e divida.',
    flashcard: { front: 'Grandezas diretamente proporcionais: o que acontece com a razão entre elas?', back: 'Permanece constante (a/b = c/d).' },
  },
  {
    id: 'q38', exam: 'ENEM', style: 'Estilo ENEM', subject: 'Matemática', area: 'Matemática', topic: 'Proporção inversa', skillId: 'mat-proporcao',
    year: 2026, difficulty: 'Média', type: 'objetiva', source: 'original_nexo', lessonId: 'l-proporcao', twinId: 'q37',
    context: 'Um mutirão de 6 voluntários limpa uma praça em 8 horas, todos trabalhando no mesmo ritmo.',
    statement: 'Se fossem 12 voluntários, no mesmo ritmo, o tempo necessário seria de',
    alternatives: [
      { letter: 'A', text: '16 horas.', errorType: 'formula_incorreta', analysis: 'Tratou como proporção direta: mais pessoas não aumentam o tempo.', tutorPrompt: 'Com o dobro de voluntários, a praça fica limpa mais rápido ou mais devagar?' },
      { letter: 'B', text: '4 horas.', correct: true, analysis: 'Correta. Proporção inversa: 6 × 8 = 12 × t → t = 4 h.' },
      { letter: 'C', text: '2 horas.', errorType: 'calculo', analysis: 'Dividiu o tempo por 4 em vez de 2.', tutorPrompt: 'O número de voluntários foi multiplicado por quanto?' },
      { letter: 'D', text: '14 horas.', errorType: 'formula_incorreta', analysis: 'Somou 6 às 8 horas.', tutorPrompt: 'A relação entre pessoas e tempo é de soma ou de produto constante?' },
      { letter: 'E', text: '8 horas.', errorType: 'lacuna_conceitual', analysis: 'Supôs que o tempo não depende do número de pessoas.', tutorPrompt: 'Mais pessoas trabalhando no mesmo ritmo alteram o tempo total?' },
    ],
    hints: ['Mais pessoas → menos tempo.', 'Na proporção inversa, o PRODUTO é constante.', '6 × 8 = 48 → 48 ÷ 12 = 4 h.'],
    explanation: 'Número de voluntários e tempo são inversamente proporcionais: o produto é constante. 6 × 8 = 48 = 12 × t → t = 4 h.',
    fastMethod: 'Dobrou um, o outro cai pela metade.',
    flashcard: { front: 'Grandezas inversamente proporcionais: o que é constante?', back: 'O produto entre elas (a·b = c·d).' },
  },
];
