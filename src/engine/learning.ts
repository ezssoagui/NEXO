import type { Attempt, ErrorCause, InterventionCode, MasteryState, Question, SkillReview, Situation } from '../types';
import { diagnose, type Diagnosis, type DiagnosisInput } from './diagnosis';
import { readJustification } from './concepts';
import { skillMastery, masteryIndicators, MASTERY_LABEL, type SkillMastery } from './mastery';
import { prerequisitesOf, skillById, SKILLS, INTERVENTION_LABELS, CAUSE_LABELS } from '../data/skills';
import { LESSONS } from '../data/lessons';
import { QUESTIONS } from '../data/questions';
import { hasGenerator } from './generator';
import { exerciseLoad, nextUnseen, priorityWeight, type Goal } from './strategy';

/**
 * NEXO LEARNING ENGINE
 * Coordena a experiência pedagógica. Recebe estudante (histórico, revisões, preferências), atividade, resposta e confiança
 * e devolve uma DECISÃO PEDAGÓGICA estruturada e auditável. Regras determinísticas e testáveis;
 * a IA (quando disponível) só fornece evidências (ex.: interpretação de justificativa) e linguagem — nunca controla o progresso sozinha.
 */
export type Autonomy = 'mais_autonomia' | 'equilibrado' | 'mais_apoio';
export const HINT_LIMIT: Record<Autonomy, number> = { mais_autonomia: 1, equilibrado: 3, mais_apoio: 3 };

export type NextKind = 'avancar' | 'praticar' | 'explicar' | 'prerequisitos' | 'revisao' | 'desafio';
export const NEXT_LABEL: Record<NextKind, string> = { avancar: 'Avançar', praticar: 'Praticar novamente', explicar: 'Receber uma explicação', prerequisitos: 'Revisar pré-requisitos', revisao: 'Revisão espaçada', desafio: 'Desafio mais difícil' };
export interface NextActivity { kind: NextKind; label: string; reason: string; to?: string; qid?: string; skillId?: string }

export interface PedagogicalDecision {
  qid: string; skillId: string;
  diagnosis: Diagnosis;
  difficulty: string;                 // dificuldade identificada (texto)
  intervention: InterventionCode; cpe: boolean;
  interventionReason: string;
  options: InterventionCode[];        // outras abordagens que o aluno pode pedir
  next: NextActivity;
  review: { needed: boolean; inDays?: number; reason: string };
  mastery: { before: MasteryState; after: MasteryState; indicatorsAfter: ReturnType<typeof masteryIndicators> };
  situation: Situation;               // compatibilidade com o ciclo de domínio / painéis
}

const lessonFor = (skillId: string) => LESSONS.find((l) => l.skillIds.includes(skillId));

/** Escolhe a intervenção A–G a partir da causa e do contexto (não há fluxo fixo). */
export function selectIntervention(q: Question, d: Diagnosis, history: Attempt[], response?: DiagnosisInput): { code: InterventionCode; cpe: boolean; reason: string; options: InterventionCode[] } {
  const skillHist = history.filter((a) => a.skillId === q.skillId && !a.free);
  const conceptualErrors = skillHist.filter((a) => !a.correct && a.cause === 'conceitual').length;
  const partial = readJustification(q.skillId, response?.justification ?? '').shown.length > 0 || response?.confidence === 'duvida' || (response?.hintsUsed ?? 0) >= 1;
  const hasLesson = !!lessonFor(q.skillId);
  const opts = (xs: InterventionCode[]) => xs.filter((c) => (c !== 'D' || hasLesson) && (c !== 'G' || prerequisitesOf(q.skillId).length > 0));
  if (d.outcome !== 'erro' && d.outcome !== 'nao_resolveu') {
    if (d.outcome === 'acerto_raciocinio_incorreto') return { code: 'B', cpe: false, reason: 'A resposta está certa, mas a justificativa mostra um raciocínio incorreto: perguntas orientadoras ajudam a corrigi-lo.', options: opts(['C', 'E']) };
    if (d.outcome === 'acerto_seguro' || d.outcome === 'acerto_sem_confianca') return { code: 'nenhuma', cpe: false, reason: 'Acerto sem sinais de dificuldade: nenhuma intervenção é necessária.', options: [] };
    return { code: 'E', cpe: false, reason: 'Acerto frágil: uma explicação breve e opcional basta; a verificação fica para depois.', options: opts(['C', 'B']) };
  }
  const cause = d.cause ?? 'indeterminada';
  const j = d.evidence.some((e) => e.source === 'justificativa' && /etapas corretas|procedimento correto/.test(e.text));
  switch (cause) {
    case 'interpretacao': case 'confusao_alternativas':
      return { code: 'B', cpe: true, reason: `${CAUSE_LABELS[cause].label}: o método C–P–E (comando, prova, eliminação) investiga como a questão foi lida.`, options: opts(['A', 'E', 'C']) };
    case 'conceitual':
      if (conceptualErrors >= 2 && hasLesson) return { code: 'D', cpe: false, reason: 'Erro conceitual recorrente nesta habilidade: uma aula estruturada (fundamentos, exemplos, exercícios) é mais eficaz que novas perguntas.', options: opts(['C', 'B']) };
      if (d.outcome === 'nao_resolveu' || !(j || partial)) return { code: 'C', cpe: false, reason: 'Falta um conceito específico: uma microaula curta e contextualizada, seguida de verificação.', options: opts(['B', 'D', 'A']) };
      return { code: 'B', cpe: false, reason: 'Há conhecimento parcial: perguntas orientadoras ajudam a reconstruir o raciocínio.', options: opts(['C', 'A', 'D']) };
    case 'calculo': case 'atencao':
      return { code: 'E', cpe: false, reason: cause === 'calculo' ? 'O procedimento está correto; o erro está numa operação. Correção direta da etapa, sem repetir a teoria.' : 'Provável desatenção: correção breve, sem aula.', options: opts(['F', 'A']) };
    case 'formula': case 'unidade':
      return { code: 'F', cpe: false, reason: `${CAUSE_LABELS[cause].label}: reconstruir a resolução etapa por etapa mostra onde o procedimento desviou.`, options: opts(['E', 'B', 'C']) };
    case 'esquecimento':
      return { code: 'A', cpe: false, reason: 'Você já demonstrou esta habilidade antes: pistas graduais ajudam a recuperar o conhecimento, sem reensinar tudo.', options: opts(['C', 'B']) };
    case 'lacuna_prerequisito':
      return { code: 'G', cpe: false, reason: `A dificuldade parece depender de ${skillById(d.prerequisite ?? prerequisitesOf(q.skillId)[0])?.name}: verificar e reforçar esse pré-requisito primeiro.`, options: opts(['B', 'C', 'A']) };
    default:
      return { code: 'A', cpe: false, reason: 'Causa ainda indeterminada: começamos pela intervenção menos presuntiva (dicas graduais) e pedimos uma justificativa curta.', options: opts(['B', 'C', 'E', 'F']) };
  }
}

export function situationOf(d: Diagnosis): Situation {
  if (d.outcome === 'acerto_seguro' || d.outcome === 'acerto_sem_confianca') return 'A';
  if (d.outcome !== 'erro' && d.outcome !== 'nao_resolveu') return 'B';
  switch (d.cause) {
    case 'interpretacao': case 'confusao_alternativas': return 'C';
    case 'calculo': case 'formula': case 'unidade': return 'E';
    case 'atencao': return 'F';
    case 'indeterminada': case undefined: return 'AMB';
    default: return 'D';
  }
}

/** Próxima atividade sugerida para a habilidade, após esta resposta. */
export function nextAfter(q: Question, d: Diagnosis, mAfter: SkillMastery, history: Attempt[]): NextActivity {
  const seen = new Set(history.map((a) => a.qid)); seen.add(q.id);
  const sk = q.skillId; const name = skillById(sk)?.name;
  if (d.outcome === 'erro' || d.outcome === 'nao_resolveu') {
    if (d.cause === 'lacuna_prerequisito') { const pre = d.prerequisite ?? prerequisitesOf(sk)[0]; const pq = QUESTIONS.find((x) => x.skillId === pre && !seen.has(x.id)); return { kind: 'prerequisitos', label: NEXT_LABEL.prerequisitos, reason: `Verificar ${skillById(pre)?.name} antes de voltar a ${name}.`, to: pq ? `/questoes/${pq.id}` : lessonFor(pre) ? `/aulas/${lessonFor(pre)!.id}` : undefined, qid: pq?.id, skillId: pre }; }
    if (d.cause === 'esquecimento') return { kind: 'revisao', label: NEXT_LABEL.revisao, reason: 'Habilidade já dominada antes: a revisão foi antecipada e uma questão inédita confirma a recuperação.', to: `/questoes/${q.id}?gemea=1`, skillId: sk };
    return { kind: 'praticar', label: NEXT_LABEL.praticar, reason: 'Depois da intervenção, uma questão inédita do mesmo conceito verifica a compreensão (repetir a mesma questão não conta).', to: `/questoes/${q.id}?gemea=1`, skillId: sk };
  }
  if (d.outcome !== 'acerto_seguro' && d.outcome !== 'acerto_sem_confianca') return { kind: 'praticar', label: NEXT_LABEL.praticar, reason: 'Acerto frágil: uma verificação com questão inédita foi priorizada para a revisão.', skillId: sk };
  if (mAfter.state === 'consistente') {
    const hard = QUESTIONS.find((x) => !seen.has(x.id) && ((x.integrates?.includes(sk) || (x.skillId === sk && x.integrates)) || (x.skillId === sk && x.difficulty === 'Difícil')));
    if (hard) return { kind: 'desafio', label: NEXT_LABEL.desafio, reason: 'Domínio consistente: em vez de repetir explicações, um desafio mais difícil (integração ou nível difícil).', to: `/questoes/${hard.id}`, qid: hard.id, skillId: sk };
  }
  return { kind: 'avancar', label: NEXT_LABEL.avancar, reason: 'Resposta segura. Siga para a próxima atividade.', skillId: sk };
}

export interface DecideInput { q: Question; response: DiagnosisInput; history: Attempt[]; reviews?: Record<string, SkillReview>; now?: number }
/** Decisão pedagógica completa para uma resposta (antes de registrá-la). */
export function decide({ q, response, history, now = Date.now() }: DecideInput): PedagogicalDecision {
  const d = diagnose(q, response, history, now);
  const sel = selectIntervention(q, d, history, response);
  const before = skillMastery(history, q.skillId).state;
  const sim: Attempt = { id: 'sim', qid: q.id, skillId: q.skillId, subject: q.subject, chosen: response.chosen, correct: response.correct, confidence: response.confidence, hintsUsed: response.hintsUsed, ts: now, mode: 'tutoria', cause: d.cause, evidence: undefined };
  const after = skillMastery([...history, sim], q.skillId);
  const fragile = d.outcome !== 'acerto_seguro' && d.outcome !== 'acerto_sem_confianca';
  const review = !response.correct ? { needed: true, inDays: d.cause === 'calculo' || d.cause === 'atencao' ? 2 : 1, reason: d.cause === 'esquecimento' ? 'Esquecimento: revisões mais próximas por um tempo.' : 'Erro registrado: a habilidade volta à revisão em breve.' }
    : fragile ? { needed: true, inDays: 1, reason: 'Acerto com baixa confiança: verificação no dia seguinte.' }
    : { needed: false, reason: 'Acerto seguro: a revisão segue o intervalo adaptativo.' };
  const difficulty = response.correct ? (fragile ? 'Acerto frágil' : 'Nenhuma dificuldade identificada') : d.cause === 'indeterminada' ? `Causa ainda indeterminada${d.provisional ? ` (hipótese provisória: ${CAUSE_LABELS[d.provisional].label.toLowerCase()})` : ''}` : CAUSE_LABELS[d.cause!].label;
  return { qid: q.id, skillId: q.skillId, diagnosis: d, difficulty, intervention: sel.code, cpe: sel.cpe, interventionReason: sel.reason, options: sel.options, next: nextAfter(q, d, after, history), review, mastery: { before, after: after.state, indicatorsAfter: masteryIndicators([...history, sim], q.skillId, now) }, situation: situationOf(d) };
}

/** Reavalia com novas evidências (justificativa curta, relato do aluno, sugestão de IA). */
export function redecide(input: DecideInput, extra: Partial<DiagnosisInput>): PedagogicalDecision { return decide({ ...input, response: { ...input.response, ...extra } }); }

// ---------------- Recomendações por habilidade (Princípio 7) ----------------
export interface SkillRec { skillId: string; action: NextKind; reason: string; priority: number; state: MasteryState; to?: string }
export function recommendForSkill(skillId: string, attempts: Attempt[], reviews: Record<string, SkillReview> = {}, now = Date.now(), goal: Goal = 'ENEM'): SkillRec {
  const m = skillMastery(attempts, skillId); const ind = masteryIndicators(attempts, skillId, now);
  const weight = priorityWeight(skillId, goal); const load = exerciseLoad(skillId, attempts);
  const due = reviews[skillId] && reviews[skillId].due <= now;
  const weakPre = prerequisitesOf(skillId).find((p) => { const pm = skillMastery(attempts, p); return pm.state === 'desenvolvimento' && attempts.some((a) => a.skillId === p && !a.correct); });
  const lesson = lessonFor(skillId); const seen = new Set(attempts.map((a) => a.qid));
  const unseen = nextUnseen(skillId, attempts);
  const conc = attempts.filter((a) => a.skillId === skillId && !a.correct && a.cause === 'conceitual').length;
  const r = (action: NextKind, reason: string, priority: number, to?: string): SkillRec => ({ skillId, action, reason, priority: +(priority * weight).toFixed(2), state: m.state, to });
  if (m.regressed) return r('revisao', 'Já esteve em domínio, mas falhou numa avaliação posterior (possível esquecimento).', 9, `/questoes/${(unseen ?? QUESTIONS.find((q) => q.skillId === skillId))!.id}`);
  if (weakPre) return r('prerequisitos', `Depende de ${skillById(weakPre)?.name}, que ainda está em desenvolvimento.`, 8, lessonFor(weakPre) ? `/aulas/${lessonFor(weakPre)!.id}` : undefined);
  if (m.state === 'desenvolvimento' && conc >= 2) return r('explicar', `${conc} erros conceituais nesta habilidade: vale uma explicação antes de mais questões.`, 7.5, lesson ? `/aulas/${lesson.id}` : undefined);
  if (m.state === 'desenvolvimento') return r('praticar', `Em desenvolvimento: ${ind.wrong} erro(s) e ${ind.secure} acerto(s) seguro(s) até agora.${load.enough ? ` ${load.note}` : ''}`, load.enough ? 5 : 7, unseen ? `/questoes/${unseen.id}` : `/questoes/${QUESTIONS.find((q) => q.skillId === skillId)!.id}?gemea=1`);
  if (due) return r('revisao', `Revisão vencida (último contato há ${ind.daysSinceLast} dia(s)).`, 6, '/flashcards');
  if (m.fragile) return r('praticar', 'O último acerto foi frágil (dúvida, dicas ou tentativa): falta uma verificação.', 5.5, unseen ? `/questoes/${unseen.id}` : undefined);
  if (m.state === 'provisorio') return r('praticar', ind.novelCorrect ? 'Domínio provisório: falta confirmar em outro dia.' : 'Domínio provisório: falta comprovar em questão inédita.', 4, unseen ? `/questoes/${unseen.id}` : undefined);
  if (m.state === 'consistente') { const hard = QUESTIONS.find((q) => !seen.has(q.id) && (q.integrates?.includes(skillId) || (q.skillId === skillId && (q.integrates || q.difficulty === 'Difícil')))); return hard ? r('desafio', 'Domínio consistente: hora de um desafio mais difícil.', 2, `/questoes/${hard.id}`) : r('avancar', 'Domínio consistente: siga para outros conteúdos.', 1); }
  return r('explicar', 'Ainda não estudada.', 3.5, lesson ? `/aulas/${lesson.id}` : unseen ? `/questoes/${unseen.id}` : undefined);
}
export function recommendations(attempts: Attempt[], reviews: Record<string, SkillReview> = {}, now = Date.now(), limit = 3, goal: Goal = 'ENEM') {
  return SKILLS.map((s) => recommendForSkill(s.id, attempts, reviews, now, goal)).sort((a, b) => b.priority - a.priority).slice(0, limit);
}
export { INTERVENTION_LABELS, MASTERY_LABEL, hasGenerator };
