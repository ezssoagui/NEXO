import type { Question } from '../types';

/**
 * CPE — Comando, Prova e Eliminação. Exclusivo da correção de questões médias e difíceis de Linguagens e Ciências Humanas
 * respondidas incorretamente. Verificações por regras: leitura do comando (semelhança textual), prova (frase escolhida no
 * texto) e tipo de erro da alternativa.
 */
const STOP = new Set('para como pela pelo mais sobre entre quando onde qual quais esse essa isso texto questao alternativa pede comando segundo acordo'.split(' '));
const words = (s: string) => (s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{4,}/g) ?? []).filter((w) => !STOP.has(w)).map((w) => w.slice(0, 6));
/** Proporção das palavras de `b` presentes em `a` (radicais simples). */
export function overlap(a: string, b: string) { const A = new Set(words(a)); const B = words(b); return B.length ? B.filter((w) => A.has(w)).length / B.length : 0; }

export const ELIMINATION_TYPES = [
  { id: 'Extrapolação', hint: 'Afirma além do que o texto diz.' }, { id: 'Generalização', hint: 'Transforma um caso em regra.' },
  { id: 'Inversão', hint: 'Troca relações ou o sentido.' }, { id: 'Contradição', hint: 'O texto diz o contrário.' },
  { id: 'Fuga do comando', hint: 'Pode ser verdade, mas não responde.' },
];
export const readCommand = (q: Question, answer: string) => !!q.cpe && (overlap(answer, q.cpe.comando) >= 0.3 || overlap(answer, q.statement) >= 0.45);
export const splitSentences = (t: string) => t.replace(/\(Texto elaborado[^)]*\)|\(Text written[^)]*\)|\(Anúncio[^)]*\)/gi, '').replace(/^["“]|["”]\s*$/gm, '').split(/(?<=[.!?;:—])\s+/).map((s) => s.trim().replace(/["”]$/, '')).filter((s) => s.length > 8);
/** A frase escolhida é a prova se contém boa parte da evidência (ou está contida nela). */
export const checkProof = (q: Question, sentence: string) => !!q.cpe && (overlap(sentence, q.cpe.prova) >= 0.55 || overlap(q.cpe.prova, sentence) >= 0.75);
export function checkElimination(q: Question, letter: string, type: string) {
  const t = q.cpe?.excesso.find((e) => e.letter === letter)?.tipo.toLowerCase(); if (!t) return false;
  return t.includes(type.toLowerCase()) || type.toLowerCase().split(' ').some((w) => w.length > 4 && t.includes(w.slice(0, 7)));
}
export const revealCpe = (q: Question) => (q.cpe ? `**Comando:** ${q.cpe.comando}\n\n**Prova:** ${q.cpe.prova}\n\n**Eliminação:**\n${q.cpe.excesso.map((e) => `${e.letter} — ${e.tipo}: ${e.motivo}`).join('\n')}` : q.explanation);
