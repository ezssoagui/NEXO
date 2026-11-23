import type { Question } from '../types';

/**
 * C–P–E ADAPTATIVO (Comando → Prova → Eliminação).
 * Ativado principalmente após erros interpretativos. Seleciona apenas as etapas necessárias
 * e encerra assim que o aluno demonstra compreensão; aprofunda progressivamente se a dificuldade continua.
 */
export type CpeStep = 'comando' | 'prova' | 'comparar' | 'verificar' | 'fim';
export interface CpeState { qid: string; chosen: string; step: CpeStep; turns: number; misses: number; understood: boolean; done: string[] }
export interface CpeTurn { text: string; state: CpeState; expectsAnswer: boolean; tag?: 'C' | 'P' | 'E' }

const STOP = new Set('a o e de da do das dos que em um uma para por com no na os as se ao à é não mais como ou sua seu texto questão alternativa pede comando'.split(' '));
const words = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{4,}/g)?.filter((w) => !STOP.has(w)) ?? [];
export function overlap(a: string, b: string) { const A = new Set(words(a)); const B = words(b); if (!B.length) return 0; return B.filter((w) => A.has(w)).length / B.length; }
const NAMES_ERROR = /extrapol|generaliz|invert|contradi|exager|vai al[eé]m|n[aã]o (diz|fala|menciona|afirma)|todos|sempre|nunca|superior|qualquer|absolut|imprecis/i;
const UNDERSTOOD = /^(entendi|ok|certo|faz sentido|agora sim|compreendi|saquei|beleza)\b/i;

const correctOf = (q: Question) => q.alternatives!.find((a) => a.correct)!;
const excessOf = (q: Question, letter: string) => q.cpe?.excesso.find((e) => e.letter === letter);

export function startCpe(q: Question, chosen: string, justification = ''): CpeTurn {
  const st: CpeState = { qid: q.id, chosen, step: 'comando', turns: 0, misses: 0, understood: false, done: [] };
  // Se a justificativa já mostra leitura correta do comando, pular direto para a prova.
  if (q.cpe && justification && overlap(justification, q.cpe.comando) >= 0.25) {
    st.step = 'prova'; st.done.push('comando');
    return { text: `Pela sua justificativa, você entendeu o que o comando pede. Vamos à evidência: que trecho do texto apoia a alternativa ${chosen}?`, state: st, expectsAnswer: true, tag: 'P' };
  }
  return { text: `Antes de ver a resposta, vamos olhar para o comando. Em suas palavras: o que exatamente a questão pede?\n\n“${q.statement}”`, state: st, expectsAnswer: true, tag: 'C' };
}

export function answerCpe(q: Question, prev: CpeState, answer: string): CpeTurn {
  const st: CpeState = { ...prev, turns: prev.turns + 1, done: [...prev.done] };
  const cpe = q.cpe; const correct = correctOf(q); const chosenAlt = q.alternatives!.find((a) => a.letter === st.chosen);
  const ex = excessOf(q, st.chosen);
  if (UNDERSTOOD.test(answer.trim())) return finish(q, st, 'Ótimo.');
  if (NAMES_ERROR.test(answer) && st.step !== 'comando') {
    // O aluno já nomeou o erro da própria alternativa: encerrar cedo.
    return finish(q, st, `Isso mesmo${ex ? ` — sua alternativa (${st.chosen}) falha por ${ex.tipo.toLowerCase()}: ${ex.motivo}` : ''}.`);
  }
  switch (st.step) {
    case 'comando': {
      st.done.push('comando');
      const ok = cpe ? overlap(answer, cpe.comando) >= 0.25 || overlap(answer, q.statement) >= 0.4 : answer.split(/\s+/).length >= 4;
      st.step = 'prova';
      if (ok) return { text: `Boa leitura do comando. Agora a evidência: que trecho ${q.context ? 'do texto ' : ''}fez você escolher a alternativa ${st.chosen}?`, state: st, expectsAnswer: true, tag: 'P' };
      st.misses++;
      return { text: `Repare na diferença: o comando pede ${cpe ? `**${cpe.comando.charAt(0).toLowerCase() + cpe.comando.slice(1)}**` : 'exatamente o que está no enunciado'}. Com isso em mente, que trecho apoiaria a alternativa ${st.chosen}?`, state: st, expectsAnswer: true, tag: 'P' };
    }
    case 'prova': {
      st.done.push('prova');
      const supportsCorrect = cpe ? overlap(answer, cpe.prova) >= 0.3 : false;
      const supportsChosen = chosenAlt ? overlap(answer, chosenAlt.text) >= 0.3 : false;
      st.step = 'comparar';
      if (supportsCorrect) return { text: `Você encontrou o trecho decisivo. Agora compare: esse trecho sustenta mesmo a alternativa ${st.chosen}, ou outra?`, state: st, expectsAnswer: true, tag: 'P' };
      st.misses++;
      const lead = supportsChosen ? `Esse trecho parece apoiar a ${st.chosen}, mas veja se ele diz exatamente isso.` : 'Esse trecho não sustenta a escolha diretamente.';
      return { text: `${lead} A evidência decisiva é:\n\n${cpe?.prova ?? q.hints[1]}\n\nComparando com a sua alternativa (${st.chosen}: “${chosenAlt?.text}”), o que ela afirma que o trecho **não** afirma?`, state: st, expectsAnswer: true, tag: 'E' };
    }
    case 'comparar': {
      st.done.push('comparar'); st.step = 'verificar';
      const plaus = q.alternatives!.filter((a) => !a.correct && a.letter !== st.chosen && a.errorType === 'alternativas_plausiveis').slice(0, 1);
      return { text: `A diferença decisiva: ${ex ? `a ${st.chosen} contém ${ex.tipo.toLowerCase()} (${ex.motivo})` : chosenAlt?.analysis}. A correta é a **${correct.letter}**: ${correct.text}${plaus.length ? `\n\nOutra armadilha parecida é a ${plaus[0].letter} (${excessOf(q, plaus[0].letter)?.tipo.toLowerCase() ?? 'plausível'}).` : ''}\n\nPara fechar: em uma frase, por que a ${st.chosen} não atende ao comando?`, state: st, expectsAnswer: true, tag: 'E' };
    }
    case 'verificar': {
      const ok = NAMES_ERROR.test(answer) || overlap(answer, (ex?.motivo ?? '') + ' ' + (chosenAlt?.analysis ?? '')) >= 0.25;
      if (ok) return finish(q, st, 'Exatamente.');
      st.misses++;
      return finish(q, st, `Quase. O ponto central é: ${ex?.motivo ?? chosenAlt?.analysis}`, true);
    }
    default: return finish(q, st, '');
  }
}

function finish(q: Question, st: CpeState, lead: string, deepened = false): CpeTurn {
  const s = { ...st, step: 'fim' as CpeStep, understood: !deepened };
  const strategy = 'Estratégia para a próxima: (C) sublinhe o que o comando pede; (P) encontre a frase que prova; (E) procure, nas alternativas próximas, palavras que exageram, generalizam ou invertem o texto.';
  return { text: `${lead}\n\n${strategy}\n\nPara comprovar, o ideal é uma questão diferente — não esta de novo.`, state: s, expectsAnswer: false };
}

/** Revela a explicação completa (o aluno pode pedir a qualquer momento). */
export function revealCpe(q: Question) {
  const c = q.cpe;
  return c ? `**C — Comando:** ${c.comando}\n\n**P — Prova:** ${c.prova}\n\n**E — Eliminação:**\n${c.excesso.map((e) => `• ${e.letter} — ${e.tipo}: ${e.motivo}`).join('\n')}` : q.explanation;
}
