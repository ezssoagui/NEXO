import type { Attempt, CardState, MasteryCycle, Profile, SkillReview, Subject } from '../types';
import { allMastery } from './mastery';
import { isDue } from './srs';
import { LESSONS } from '../data/lessons';
import { QUESTIONS } from '../data/questions';
import { SKILLS, skillById } from '../data/skills';

export function weakSkills(attempts: Attempt[], profile?: Profile | null): string[] {
  const m = allMastery(attempts);
  const lastErr = (id: string) => Math.max(0, ...attempts.filter((a) => a.skillId === id && !a.correct).map((a) => a.ts));
  const dev = m.filter((x) => x.state === 'desenvolvimento').sort((a, b) => lastErr(b.skillId) - lastErr(a.skillId)).map((x) => x.skillId);
  const prov = m.filter((x) => x.state === 'provisorio').map((x) => x.skillId);
  const diff = profile ? m.filter((x) => x.state === 'nao_estudado' && profile.difficulties.includes(x.skill.subject)).map((x) => x.skillId) : [];
  return [...new Set([...dev, ...diff, ...prov])];
}

export interface Rec { title: string; reason: string; to: string; cta: string }
export function nextRecommendation(attempts: Attempt[], cards: Record<string, CardState>, profile: Profile | null, diagnosticDone: boolean, extra: { cycles?: MasteryCycle[]; skillReviews?: Record<string, SkillReview> } = {}): Rec {
  if (!diagnosticDone) return { title: 'Diagnóstico inicial', reason: 'Seis questões rápidas para personalizar sua trilha.', to: '/diagnostico', cta: 'Fazer diagnóstico' };
  const open = (extra.cycles ?? []).filter((c) => (c.status === 'ativo' || c.status === 'adiado') && (c.stage === 'comprovacao' || c.stage === 'ensino')).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (open) return { title: `Comprovar: ${skillById(open.skillId)?.name}`, reason: open.status === 'adiado' ? 'Você adiou esta comprovação. Uma questão inédita do mesmo conceito fecha o ciclo.' : 'Falta comprovar o aprendizado com uma questão inédita do mesmo conceito.', to: `/questoes/${open.originQid}?gemea=1`, cta: 'Fazer comprovação' };
  const dueSkills = Object.values(extra.skillReviews ?? {}).filter((r) => r.due <= Date.now()).length;
  if (dueSkills >= 2) return { title: 'Revisão intercalada', reason: `${dueSkills} habilidade(s) com revisão vencida: uma sessão curta mistura questões e flashcards.`, to: '/flashcards', cta: 'Revisar agora' };
  const sorted = [...attempts].sort((a, b) => b.ts - a.ts);
  const lastWrong = sorted.find((a) => !a.correct || a.confidence === 'chute');
  if (lastWrong && !sorted.some((a) => a.ts > lastWrong.ts && a.skillId === lastWrong.skillId && a.correct)) {
    const sk = skillById(lastWrong.skillId);
    return { title: `Questão gêmea: ${sk?.name}`, reason: `Seu último ${lastWrong.correct ? 'acerto foi por chute' : 'erro'} em ${sk?.name} ainda não foi confirmado com uma questão nova.`, to: `/questoes/${lastWrong.qid}?gemea=1`, cta: 'Resolver questão gêmea' };
  }
  const due = Object.entries(cards).filter(([, s]) => isDue(s)).length;
  if (due >= 6) return { title: `${due} flashcards pendentes`, reason: 'Revisar agora evita que esses conteúdos entrem na zona de esquecimento.', to: '/flashcards', cta: 'Revisar agora' };
  const weak = weakSkills(attempts, profile)[0];
  if (weak) {
    const l = LESSONS.find((x) => x.skillIds.includes(weak));
    const q = QUESTIONS.find((x) => x.skillId === weak && !attempts.some((a) => a.qid === x.id));
    if (q) return { title: skillById(weak)!.name, reason: 'Habilidade em desenvolvimento: uma questão nova ajuda a consolidar.', to: `/questoes/${q.id}`, cta: 'Resolver questão' };
    if (l) return { title: l.title, reason: 'Revisar a explicação antes de novas questões.', to: `/aulas/${l.id}`, cta: 'Abrir microaula' };
  }
  const fresh = QUESTIONS.find((x) => !attempts.some((a) => a.qid === x.id));
  return fresh ? { title: `Explorar: ${fresh.topic}`, reason: 'Conteúdo ainda não estudado.', to: `/questoes/${fresh.id}`, cta: 'Começar' } : { title: 'Simulado rápido', reason: 'Você já passou por todo o banco demonstrativo.', to: '/simulados', cta: 'Fazer simulado' };
}

export interface SessionStep { kind: 'explicacao' | 'questao' | 'flashcards' | 'gemea' | 'paragrafo'; title: string; ref?: string; count?: number; minutes: number }
export function buildSession(minutes: 5 | 10 | 20 | 40, attempts: Attempt[], profile: Profile | null): { focus: string; steps: SessionStep[] } {
  const weak = weakSkills(attempts, profile);
  const focus = weak[0] ?? 'fis-potencia';
  const l = LESSONS.find((x) => x.skillIds.includes(focus)) ?? LESSONS[0];
  const qs = QUESTIONS.filter((q) => q.skillId === focus || (weak.includes(q.skillId))).filter((q) => q.type === 'objetiva');
  const unseen = [...qs.filter((q) => !attempts.some((a) => a.qid === q.id)), ...qs];
  const q = (i: number) => unseen[i % Math.max(1, unseen.length)]?.id ?? 'q01';
  const steps: SessionStep[] = [];
  if (minutes === 5) {
    steps.push({ kind: 'explicacao', title: 'Explicação essencial', ref: l.id, minutes: 1 }, { kind: 'questao', title: 'Uma questão', ref: q(0), minutes: 3 }, { kind: 'flashcards', title: 'Um flashcard', count: 1, minutes: 1 });
  } else if (minutes === 10) {
    steps.push({ kind: 'explicacao', title: 'Explicação essencial', ref: l.id, minutes: 2 }, { kind: 'questao', title: 'Questão 1', ref: q(0), minutes: 3 }, { kind: 'questao', title: 'Questão 2', ref: q(1), minutes: 3 }, { kind: 'flashcards', title: 'Revisão rápida', count: 3, minutes: 2 });
  } else if (minutes === 20) {
    steps.push({ kind: 'explicacao', title: 'Microaula', ref: l.id, minutes: 5 }, { kind: 'questao', title: 'Questão 1', ref: q(0), minutes: 4 }, { kind: 'questao', title: 'Questão 2', ref: q(1), minutes: 4 }, { kind: 'gemea', title: 'Questão gêmea (transferência)', ref: q(0), minutes: 4 }, { kind: 'flashcards', title: 'Revisão espaçada', count: 5, minutes: 3 });
  } else {
    steps.push({ kind: 'explicacao', title: 'Aula completa', ref: l.id, minutes: 10 }, ...[0, 1, 2].map((i) => ({ kind: 'questao' as const, title: `Questão ${i + 1}`, ref: q(i), minutes: 4 })), { kind: 'gemea', title: 'Questão gêmea', ref: q(0), minutes: 4 }, { kind: 'flashcards', title: 'Revisão espaçada', count: 10, minutes: 6 }, { kind: 'paragrafo', title: 'Laboratório C3: um parágrafo', minutes: 8 });
  }
  return { focus, steps };
}

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export function weekPlan(profile: Profile | null, attempts: Attempt[]) {
  const weak = weakSkills(attempts, profile);
  const hours = profile?.weeklyHours ?? 6;
  const perDay = Math.max(15, Math.round((hours * 60) / 6 / 5) * 5);
  const subjects: Subject[] = profile?.difficulties.length ? profile.difficulties : ['Matemática', 'Linguagens'];
  return DAYS.map((d, i) => {
    if (i === 6) return { day: d, minutes: 0, tasks: ['Descanso (o descanso faz parte do aprendizado)'] };
    const sk = weak[i % Math.max(1, weak.length)] ?? SKILLS[i].id;
    const tasks = [`${skillById(sk)?.name ?? 'Revisão'}: microaula + 2 questões`, 'Flashcards pendentes (5 min)'];
    if (i === 2) tasks.push('Redação: um parágrafo no laboratório C3');
    if (i === 5) tasks.push('Simulado rápido (10 questões)');
    if (i % 2 === 1) tasks.push(`Reforço em ${subjects[i % subjects.length]}`);
    return { day: d, minutes: i === 5 ? perDay + 20 : perDay, tasks };
  });
}

export function recoveryPlan(daysOff: number, minutesPerDay: number, attempts: Attempt[], cards: Record<string, CardState>, profile: Profile | null) {
  const due = Object.values(cards).filter((s) => isDue(s)).length;
  const weak = weakSkills(attempts, profile).slice(0, 3);
  const ramp = daysOff > 14 ? [0.5, 0.7, 0.85, 1, 1, 1, 1] : daysOff > 5 ? [0.7, 0.85, 1, 1, 1, 1, 1] : [1, 1, 1, 1, 1, 1, 1];
  const msg = daysOff === 0 ? 'Ótimo, vamos manter o ritmo.' : `Pausas acontecem. Reorganizamos seu plano para recomeçar de forma leve: os primeiros dias têm carga menor e priorizam revisão do que já foi estudado.`;
  const plan = ramp.map((f, i) => {
    const min = Math.max(5, Math.round((minutesPerDay * f) / 5) * 5);
    const tasks: string[] = [];
    if (i === 0) tasks.push(`Revisão de ${Math.min(due, 10) || 5} flashcards prioritários`);
    if (weak[i % Math.max(1, weak.length)]) tasks.push(`${skillById(weak[i % weak.length])!.name}: ${min >= 20 ? 'microaula + questões' : 'professor de 5 minutos'}`);
    if (i === 3) tasks.push('Questões gêmeas dos erros anteriores à pausa');
    if (i === 6) tasks.push('Simulado rápido para recalibrar o diagnóstico');
    if (!tasks.length) tasks.push('Sessão recomendada pela NEXO');
    return { day: i + 1, minutes: min, tasks };
  });
  return { msg, plan, due };
}
