import type { Attempt, Confidence, ErrorCause, ErrorType, Question } from '../types';
import { readJustification } from './concepts';
import { prerequisitesOf, skillById, CAUSE_LABELS } from '../data/skills';
import { skillMastery, solid } from './mastery';

/**
 * SERVIÇO DE DIAGNÓSTICO (Princípios 2 e 3)
 * Soma evidências de várias fontes e devolve a causa mais provável do erro, com grau de confiança.
 * Regra central: a alternativa escolhida é evidência FRACA — sozinha nunca define a causa.
 * Sem evidência suficiente, a causa fica "indeterminada" e o sistema pede uma justificativa curta (ou admite a incerteza).
 */
export type EvidenceSource = 'resposta' | 'alternativa' | 'justificativa' | 'confianca' | 'historico' | 'tempo' | 'pre_requisito' | 'revisao' | 'aluno' | 'ia';
export interface EvidenceItem { source: EvidenceSource; cause?: ErrorCause; weight: number; text: string }
export interface DiagnosisInput { correct: boolean; confidence: Confidence; hintsUsed: number; justification?: string; chosen: string; timeSec?: number; studentReport?: ErrorCause; aiSuggestion?: { cause: ErrorCause; confidence: number; quote?: string } }
export interface Diagnosis {
  outcome: 'acerto_seguro' | 'acerto_duvida' | 'acerto_tentativa' | 'acerto_sem_confianca' | 'acerto_raciocinio_incorreto' | 'acerto_com_dicas' | 'erro' | 'nao_resolveu';
  cause?: ErrorCause; provisional?: ErrorCause; confidence: number; evidence: EvidenceItem[]; alternatives: ErrorCause[];
  needsJustification: boolean; prerequisite?: string; errorType?: ErrorType;
}

const EXPECTED_SEC = { 'Fácil': 60, 'Média': 90, 'Difícil': 150 } as const;
const DAY = 86400000;
export const ALTERNATIVE_WEIGHT = 0.35;   // peso máximo da alternativa escolhida (evidência fraca)
export const DECISION_THRESHOLD = 0.5;    // abaixo disso: causa indeterminada

export function causeFromErrorType(e?: ErrorType): ErrorCause {
  switch (e) {
    case 'interpretacao': return 'interpretacao';
    case 'alternativas_plausiveis': return 'confusao_alternativas';
    case 'calculo': return 'calculo';
    case 'formula_incorreta': return 'formula';
    case 'unidades': return 'unidade';
    case 'desatencao': return 'atencao';
    default: return 'conceitual';
  }
}

/** Sinais em justificativas livres (padrões conservadores). */
const J_SIGNALS: [RegExp, ErrorCause, string][] = [
  [/fiquei (em d[uú]vida|entre)|entre a [a-e] e a [a-e]|duas (alternativas|op[cç][oõ]es)|quase marquei/i, 'confusao_alternativas', 'Relata dúvida entre alternativas.'],
  [/achei que (pedia|perguntava|era para)|entendi que (pedia|era)|pensei que a pergunta/i, 'interpretacao', 'Relata ter entendido o comando de outra forma.'],
  [/esqueci|n[aã]o lembrei|n[aã]o (me )?recordei|j[aá] (soube|sabia)/i, 'esquecimento', 'Relata ter esquecido algo que já sabia.'],
  [/li r[aá]pido|n[aã]o vi|n[aã]o li|pulei|me distra[ií]|marquei (a )?errad/i, 'atencao', 'Relata leitura rápida ou distração.'],
  [/errei (a |na )?conta|errei o c[aá]lculo|multipliquei errado|dividi errado|somei errado/i, 'calculo', 'Relata erro de conta.'],
  [/unidade|converti|convers[aã]o|km\/h|m\/s|minutos? em horas/i, 'unidade', 'Menciona unidades ou conversão.'],
  [/f[oó]rmula|usei p ?=|usei a equa[cç][aã]o/i, 'formula', 'Menciona a fórmula escolhida.'],
  [/propor[cç][aã]o|regra de tr[eê]s/i, 'lacuna_prerequisito', 'Menciona proporção / regra de três.'],
  [/n[aã]o sei|n[aã]o entendi|n[aã]o conhe[cç]o|nunca vi/i, 'conceitual', 'Relata desconhecer o conteúdo.'],
];

export function diagnose(q: Question, r: DiagnosisInput, history: Attempt[] = [], now = Date.now()): Diagnosis {
  const ev: EvidenceItem[] = [];
  const skillHist = history.filter((a) => a.skillId === q.skillId && !a.free);
  const j = readJustification(q.skillId, r.justification ?? '');

  // ---------- Acertos ----------
  if (r.correct) {
    const outcome: Diagnosis['outcome'] = r.confidence === 'chute' ? 'acerto_tentativa' : j.wrong ? 'acerto_raciocinio_incorreto' : r.hintsUsed >= 2 ? 'acerto_com_dicas' : r.confidence === 'duvida' ? 'acerto_duvida' : r.confidence === 'nao_informada' ? 'acerto_sem_confianca' : 'acerto_seguro';
    ev.push({ source: 'resposta', weight: 1, text: 'Resposta correta.' });
    if (r.confidence !== 'nao_informada') ev.push({ source: 'confianca', weight: 0.5, text: `Confiança declarada: ${({ certeza: 'tenho certeza', duvida: 'com dúvida', chute: 'chutei', nao_consegui: 'não consegui' } as Record<string, string>)[r.confidence]}.` });
    if (j.shown.length) ev.push({ source: 'justificativa', weight: 0.6, text: 'A justificativa contém etapas corretas do raciocínio.' });
    if (j.wrong) ev.push({ source: 'justificativa', weight: 0.6, text: 'A justificativa contém um raciocínio incorreto, apesar do acerto.' });
    if (r.hintsUsed) ev.push({ source: 'resposta', weight: 0.3, text: `${r.hintsUsed} dica(s) usada(s).` });
    return { outcome, confidence: outcome === 'acerto_seguro' ? 0.8 : 0.65, evidence: ev, alternatives: [], needsJustification: false };
  }

  // ---------- Erros: pontuar causas candidatas ----------
  const score = new Map<ErrorCause, number>();
  const add = (cause: ErrorCause, w: number, source: EvidenceSource, text: string) => { score.set(cause, (score.get(cause) ?? 0) + w); ev.push({ source, cause, weight: w, text }); };
  const alt = q.alternatives?.find((a) => a.letter === r.chosen);
  const errorType: ErrorType | undefined = q.type === 'aberta' ? q.openAnswer?.wrongMap?.find((w) => Math.abs(w.value - +r.chosen.replace(',', '.')) < 1e-6)?.errorType : alt?.errorType;
  ev.push({ source: 'resposta', weight: 1, text: 'Resposta incorreta.' });

  if (r.confidence === 'nao_consegui' || r.chosen === '—') {
    add('conceitual', 0.6, 'aluno', 'O aluno indicou que não conseguiu resolver.');
  } else if (errorType) {
    add(causeFromErrorType(errorType), ALTERNATIVE_WEIGHT, 'alternativa', `A alternativa ${r.chosen} costuma resultar de: ${CAUSE_LABELS[causeFromErrorType(errorType)].label.toLowerCase()} (evidência fraca por si só).`);
  }
  // Justificativa
  if (r.justification && r.justification.trim().length >= 6) {
    if (j.wrong) add('conceitual', 0.7, 'justificativa', 'A justificativa revela uma concepção equivocada explícita.');
    if (j.shown.length && errorType && ['calculo', 'unidades', 'formula_incorreta'].includes(errorType)) add(causeFromErrorType(errorType), 0.35, 'justificativa', 'A justificativa mostra o procedimento correto; o erro está numa etapa.');
    J_SIGNALS.forEach(([re, cause, text]) => { if (re.test(r.justification!)) add(cause, 0.4, 'justificativa', text); });
  }
  // Confiança × alternativas plausíveis
  if (r.confidence === 'duvida' && errorType === 'alternativas_plausiveis') add('confusao_alternativas', 0.2, 'confianca', 'Marcou dúvida e escolheu uma alternativa plausível.');
  // Histórico: esquecimento (já havia demonstrado domínio)
  const priorSolid = skillHist.filter((a) => solid(a) && now - a.ts >= DAY);
  const priorState = skillMastery(skillHist, q.skillId).state;
  if (priorSolid.length && (priorState === 'provisorio' || priorState === 'consistente')) add('esquecimento', 0.5, 'revisao', `Habilidade já demonstrada antes (${priorSolid.length} acerto(s) sólido(s) há ${Math.round((now - priorSolid[priorSolid.length - 1].ts) / DAY)} dia(s)).`);
  else if (priorSolid.length) add('esquecimento', 0.15, 'historico', 'Houve acerto sólido anterior nesta habilidade.');
  // Histórico: erro recorrente
  const recurring = new Map<ErrorCause, number>();
  skillHist.filter((a) => !a.correct && a.cause && a.cause !== 'indeterminada').forEach((a) => recurring.set(a.cause!, (recurring.get(a.cause!) ?? 0) + 1));
  recurring.forEach((n, c) => { if (n >= 2) add(c, 0.2, 'historico', `${CAUSE_LABELS[c].label} já ocorreu ${n} vezes nesta habilidade.`); });
  // Pré-requisitos
  let prerequisite: string | undefined;
  for (const pre of prerequisitesOf(q.skillId)) {
    const preHist = history.filter((a) => a.skillId === pre && !a.free);
    const pm = skillMastery(preHist, pre);
    const preErrors = preHist.filter((a) => !a.correct).length;
    const tagged = alt?.prerequisite === pre;
    if (tagged) { add('lacuna_prerequisito', 0.3, 'alternativa', `A alternativa ${r.chosen} é típica de dificuldade em ${skillById(pre)?.name}.`); prerequisite = pre; }
    if (preErrors && pm.state === 'desenvolvimento') { add('lacuna_prerequisito', 0.35, 'pre_requisito', `Pré-requisito ${skillById(pre)?.name} ainda em desenvolvimento (${preErrors} erro(s)).`); prerequisite = pre; }
    if (pm.state === 'consistente' && tagged) add('lacuna_prerequisito', -0.4, 'pre_requisito', `Pré-requisito ${skillById(pre)?.name} já dominado: dependência pouco provável.`);
  }
  // Tempo (com cautela: só reforça, nunca decide sozinho)
  const exp = EXPECTED_SEC[q.difficulty];
  const attentionBeyondAlt = ev.some((e) => e.cause === 'atencao' && e.source !== 'alternativa');
  if (r.timeSec !== undefined && r.timeSec < exp * 0.2 && attentionBeyondAlt) add('atencao', 0.2, 'tempo', `Resposta muito rápida (${r.timeSec}s).`);
  // Relato do aluno e sugestão de IA (evidências, não decisões finais)
  if (r.studentReport) add(r.studentReport, 1, 'aluno', `O aluno relatou: ${CAUSE_LABELS[r.studentReport].label.toLowerCase()}.`);
  if (r.aiSuggestion) add(r.aiSuggestion.cause, 0.3 * r.aiSuggestion.confidence, 'ia', `Interpretação da justificativa por IA${r.aiSuggestion.quote ? `: “${r.aiSuggestion.quote}”` : ''}.`);

  const ranked = [...score.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  const tie = top && second && top[1] - second[1] < 0.099;
  const decided = !!top && top[1] >= DECISION_THRESHOLD && !tie;
  const confidence = top ? Math.min(0.95, top[1]) : 0.2;
  return {
    outcome: r.confidence === 'nao_consegui' ? 'nao_resolveu' : 'erro', errorType,
    cause: decided ? top[0] : 'indeterminada', provisional: top?.[0], confidence: decided ? confidence : Math.min(confidence, 0.45),
    evidence: ev, alternatives: ranked.slice(decided ? 1 : 0, 4).map(([c]) => c), needsJustification: !decided,
    prerequisite: (decided ? top[0] : top?.[0]) === 'lacuna_prerequisito' ? prerequisite : undefined,
  };
}
