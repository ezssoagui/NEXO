import type { Question } from '../types';
import { conceptsFor, type ConceptMap } from './concepts';

/**
 * TUTOR SOCRÁTICO ADAPTATIVO
 * - uma pergunta por vez, escolhida entre as etapas ainda não demonstradas;
 * - reconhece quando o aluno já domina várias etapas numa só resposta (não repete perguntas);
 * - detecta contradições com respostas anteriores;
 * - rebaixa o nível (pergunta mais simples, exemplo) quando há dificuldade e explica curto após 2 tentativas;
 * - permite pedir a resposta direta a qualquer momento.
 */
export type Level = 'basico' | 'intermediario' | 'avancado';
export interface SocraticState { skillId: string; qid?: string; current?: string; resolved: string[]; explained: string[]; tries: Record<string, number>; said: Record<string, 'correct' | 'wrong'>; level: Level; done: boolean; turns: number }
export interface SocraticTurn { text: string; state: SocraticState; done: boolean; contradiction?: boolean; understoodAll?: boolean }

const DONT_KNOW = /^(n[aã]o sei|sei l[aá]|nenhuma ideia|n[aã]o fa[cç]o ideia|\?+|nada)\b/i;
const DIRECT = /(me (d[aá]|diga|mostra) a resposta|explica(r)? direto|explique direto|desisto|quero a resposta|resposta direta)/i;

export function startSocratic(skillId: string, q?: Question, knownIds: string[] = []): SocraticTurn {
  const map = conceptsFor(skillId, q);
  const st: SocraticState = { skillId, qid: q?.id, resolved: [...knownIds], explained: [], tries: {}, said: {}, level: 'intermediario', done: false, turns: 0 };
  return ask(map, st, knownIds.length ? 'Pela sua justificativa, parte do raciocínio já está certa. Vamos ao ponto que faltou. ' : 'Vamos por partes. ');
}

function nextCp(map: ConceptMap, st: SocraticState) { return map.checkpoints.find((c) => !st.resolved.includes(c.id)); }

function ask(map: ConceptMap, st: SocraticState, lead = ''): SocraticTurn {
  const cp = nextCp(map, st);
  if (!cp) return conclude(map, st, lead);
  st.current = cp.id;
  const simpler = (st.tries[cp.id] ?? 0) >= 1 && cp.simpler;
  return { text: lead + (simpler ? cp.simpler! : cp.question), state: st, done: false };
}

function conclude(map: ConceptMap, st: SocraticState, lead = ''): SocraticTurn {
  st.done = true; st.current = undefined;
  const allSelf = st.explained.length === 0;
  return { text: `${lead}${allSelf ? 'Você chegou ao raciocínio completo por conta própria.' : 'Agora o raciocínio está completo.'}\n\n**Resumo:** ${map.summary[st.level]}\n\nPara comprovar que aprendeu (e não apenas lembrou), resolva uma questão inédita do mesmo conceito.`, state: st, done: true, understoodAll: allSelf };
}

export function answerSocratic(prev: SocraticState, answer: string, q?: Question): SocraticTurn {
  const map = conceptsFor(prev.skillId, q);
  const st: SocraticState = { ...prev, resolved: [...prev.resolved], explained: [...prev.explained], tries: { ...prev.tries }, said: { ...prev.said }, turns: prev.turns + 1 };
  if (DIRECT.test(answer)) return revealSocratic(st, q);
  const cp = map.checkpoints.find((c) => c.id === st.current) ?? nextCp(map, st);
  if (!cp) return conclude(map, st);

  // Reconhecer etapas já demonstradas nesta resposta (inclusive futuras) — evita perguntas desnecessárias.
  const right = cp.correct.some((r) => r.test(answer));
  const hitsOther = right ? map.checkpoints.filter((c) => c.id !== cp.id && !st.resolved.includes(c.id) && c.correct.some((r) => r.test(answer))) : [];
  const mis = right ? undefined : cp.misconceptions.find((m) => m.re.test(answer));

  if (right) {
    st.resolved.push(cp.id); st.said[cp.id] = 'correct';
    if ((st.tries[cp.id] ?? 0) === 0 && st.turns <= 1 && answer.split(/\s+/).length >= 6) st.level = 'avancado';
    hitsOther.forEach((c) => { st.resolved.push(c.id); st.said[c.id] = 'correct'; });
    const skipped = hitsOther.length ? ' Você também já respondeu a etapa seguinte.' : '';
    return ask(map, st, `${cp.ack}${skipped} `);
  }
  // Contradição: aluno afirma algo incompatível com uma etapa que já havia acertado.
  const contra = mis ? undefined : [...map.checkpoints].reverse().find((c) => st.said[c.id] === 'correct' && c.id !== cp.id && !c.correct.some((r) => r.test(answer)) && c.misconceptions.some((m) => m.re.test(answer)));
  if (contra) {
    st.tries[cp.id] = (st.tries[cp.id] ?? 0) + 1;
    return { text: `Espere: há pouco você respondeu bem que ${contra.ack.replace(/^(Isso|Exato|Certo|Perfeito)[:,.]?\s*/i, '').toLowerCase()} Agora sua resposta parece dizer o contrário. Qual das duas ideias vale? Releia: ${cp.question}`, state: st, done: false, contradiction: true };
  }
  if (mis) { st.tries[cp.id] = (st.tries[cp.id] ?? 0) + 1; if (st.tries[cp.id] < 2) return { text: mis.reply, state: st, done: false }; }
  if (!mis) st.tries[cp.id] = (st.tries[cp.id] ?? 0) + 1;
  if (st.tries[cp.id] >= 2 || (DONT_KNOW.test(answer.trim()) && st.tries[cp.id] >= 1 && !cp.simpler)) {
    // Explicação curta e seguir em frente — sem prender o aluno.
    st.resolved.push(cp.id); st.explained.push(cp.id); st.level = 'basico';
    return ask(map, st, `Tudo bem, vou explicar este ponto: ${cp.explain}\n\n`);
  }
  if (DONT_KNOW.test(answer.trim())) { st.level = 'basico'; return { text: cp.simpler ?? `Uma pista: ${cp.explain.split('.')[0]}. ${cp.question}`, state: st, done: false }; }
  return { text: `Não tenho certeza de ter entendido sua resposta. ${cp.simpler ?? cp.question}`, state: st, done: false };
}

export function revealSocratic(st: SocraticState, q?: Question): SocraticTurn {
  const map = conceptsFor(st.skillId, q);
  const s = { ...st, done: true, explained: map.checkpoints.map((c) => c.id), resolved: map.checkpoints.map((c) => c.id) };
  return { text: `Claro, vamos direto.\n\n${map.checkpoints.map((c) => `• ${c.explain}`).join('\n')}${q ? `\n\n**Resolução:** ${q.explanation}\n\n**Método rápido:** ${q.fastMethod}` : ''}`, state: s, done: true };
}
