import type { Attempt, ErrorType } from '../types';
import { ERROR_LABELS, skillById } from '../data/skills';
import { QUESTIONS } from '../data/questions';

export interface Insight { title: string; detail: string; errorType: ErrorType; skillId?: string; count: number; sequence: string[] }

/** Detetive de Erros: identifica padrões recorrentes por tipo de erro e habilidade. */
export function detectPatterns(attempts: Attempt[]): Insight[] {
  const wrong = attempts.filter((a) => a.errorType);
  const byKey = new Map<string, Attempt[]>();
  wrong.forEach((a) => { const k = `${a.errorType}|${a.skillId}`; byKey.set(k, [...(byKey.get(k) ?? []), a]); });
  const byType = new Map<ErrorType, Attempt[]>();
  wrong.forEach((a) => byType.set(a.errorType!, [...(byType.get(a.errorType!) ?? []), a]));
  const out: Insight[] = [];

  // Padrão específico: acerta questões diretas de eletrodinâmica, mas erra quando precisa reconhecer a grandeza constante.
  const gc = wrong.filter((a) => a.errorType === 'grandeza_constante');
  if (gc.length) {
    const directOk = attempts.some((a) => a.subject === 'Física' && a.correct);
    out.push({
      title: 'Reconhecimento da grandeza constante',
      detail: `${directOk ? 'Você acerta questões diretas de Física, mas ' : ''}errou ${gc.length}x ao precisar identificar o que permanece constante (ex.: resistência ao trocar a tensão).`,
      errorType: 'grandeza_constante', skillId: 'fis-potencia', count: gc.length,
      sequence: ['Microaula: "Potência elétrica: qual fórmula usar?" (12 min)', 'Questão guiada q02 (lâmpada em 240 V)', 'Questão gêmea gerada com novos dados', 'Flashcard: "R constante → P ∝ U²"'],
    });
  }
  [...byKey.entries()].filter(([k, v]) => v.length >= 2 && !k.startsWith('grandeza_constante')).forEach(([k, v]) => {
    const [et, sk] = k.split('|') as [ErrorType, string];
    const skill = skillById(sk);
    const qs = QUESTIONS.filter((q) => q.skillId === sk).map((q) => q.id);
    out.push({ title: `${ERROR_LABELS[et].label} em ${skill?.name ?? sk}`, detail: `${v.length} ocorrências recentes. ${ERROR_LABELS[et].tip}`, errorType: et, skillId: sk, count: v.length, sequence: [skill?.lessonId ? 'Revisar a microaula do conteúdo' : 'Revisar a explicação do conteúdo', ...qs.slice(0, 2).map((q) => `Questão ${q}`), 'Questão gêmea']});
  });
  [...byType.entries()].filter(([t, v]) => v.length >= 3 && !out.some((o) => o.errorType === t)).forEach(([t, v]) => {
    const subjects = [...new Set(v.map((a) => a.subject))];
    out.push({ title: `${ERROR_LABELS[t].label} recorrente`, detail: `${v.length} vezes, em ${subjects.join(', ')}. ${ERROR_LABELS[t].tip}`, errorType: t, count: v.length, sequence: ['Sessão curta focada neste tipo de erro', 'Checklist antes de marcar a resposta'] });
  });
  const lucky = attempts.filter((a) => a.correct && a.confidence === 'chute');
  if (lucky.length >= 2) out.push({ title: 'Acertos por chute', detail: `${lucky.length} acertos marcados como chute não contam como domínio. Vale refazer com questões gêmeas.`, errorType: 'chute', count: lucky.length, sequence: lucky.slice(0, 3).map((a) => `Questão gêmea de ${a.qid}`) });
  return out.sort((a, b) => b.count - a.count);
}

export function errorDistribution(attempts: Attempt[]) {
  const m = new Map<ErrorType, number>();
  attempts.forEach((a) => { if (a.errorType) m.set(a.errorType, (m.get(a.errorType) ?? 0) + 1); if (a.correct && a.confidence === 'chute') m.set('chute', (m.get('chute') ?? 0) + 1); });
  return [...m.entries()].map(([k, v]) => ({ type: k, label: ERROR_LABELS[k].label, value: v })).sort((a, b) => b.value - a.value);
}
