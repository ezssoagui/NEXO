import type { Attempt, CardState, MasteryCycle, Profile, SkillReview } from '../types';
import { allMastery } from './mastery';
import { isDue } from './srs';
import { byDifficulty, exerciseLoad, nextUnseen, priorityWeight, studyPhase, type Phase } from './strategy';
import { LESSONS } from '../data/lessons';
import { QUESTIONS } from '../data/questions';
import { SKILLS, skillById } from '../data/skills';

export function weakSkills(attempts: Attempt[], profile?: Profile | null): string[] {
  const m = allMastery(attempts);
  const lastErr = (id: string) => Math.max(0, ...attempts.filter((a) => a.skillId === id && !a.correct).map((a) => a.ts));
  const w = (id: string) => priorityWeight(id, profile?.goal);
  const dev = m.filter((x) => x.state === 'desenvolvimento').sort((a, b) => w(b.skillId) - w(a.skillId) || lastErr(b.skillId) - lastErr(a.skillId)).map((x) => x.skillId);
  const prov = m.filter((x) => x.state === 'provisorio').map((x) => x.skillId);
  const diff = profile ? m.filter((x) => x.state === 'nao_estudado' && profile.difficulties.includes(x.skill.subject)).sort((a, b) => w(b.skillId) - w(a.skillId)).map((x) => x.skillId) : [];
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
    const q = nextUnseen(weak, attempts);
    if (q) return { title: skillById(weak)!.name, reason: 'Habilidade em desenvolvimento: uma questão nova ajuda a consolidar.', to: `/questoes/${q.id}`, cta: 'Resolver questão' };
    if (l) return { title: l.title, reason: 'Revisar a explicação antes de novas questões.', to: `/aulas/${l.id}`, cta: 'Abrir microaula' };
  }
  const fresh = QUESTIONS.find((x) => !attempts.some((a) => a.qid === x.id));
  return fresh ? { title: `Explorar: ${fresh.topic}`, reason: 'Conteúdo ainda não estudado.', to: `/questoes/${fresh.id}`, cta: 'Começar' } : { title: 'Simulado rápido', reason: 'Você já passou por todo o banco demonstrativo.', to: '/simulados', cta: 'Fazer simulado' };
}

export interface SessionStep { kind: 'recordacao' | 'explicacao' | 'questao' | 'flashcards' | 'gemea' | 'paragrafo'; title: string; ref?: string; count?: number; minutes: number }
/**
 * Sessão: recuperação ativa antes de reler (se o assunto já foi visto), questões da mais fácil para a mais difícil,
 * e questões feitas há menos de 7 dias guardadas para depois. Na reta final não há conteúdo novo; nos dias de prova, só revisão leve.
 */
export function buildSession(minutes: 5 | 10 | 20 | 40, attempts: Attempt[], profile: Profile | null, now = Date.now()): { focus: string; phase: Phase; steps: SessionStep[] } {
  const { phase } = studyPhase(profile, now);
  const all = weakSkills(attempts, profile);
  const studied = (id: string) => attempts.some((a) => a.skillId === id);
  const late = phase === 'reta_final' || phase === 'descanso';
  const weak = late && all.some(studied) ? all.filter(studied) : all;
  const focus = weak[0] ?? 'fis-potencia';
  if (phase === 'descanso') return { focus, phase, steps: [{ kind: 'flashcards', title: 'Revisão bem leve', count: 5, minutes: 5 }] };
  const l = LESSONS.find((x) => x.skillIds.includes(focus));
  const lastTs = (id: string) => Math.max(0, ...attempts.filter((a) => a.qid === id).map((a) => a.ts));
  const rank = (q: (typeof QUESTIONS)[number]) => { const t = lastTs(q.id); return !t ? 0 : now - t >= 7 * 86400000 ? 1 : 2; };
  const group = (id: string) => (id === focus ? 0 : 1);
  const pool = QUESTIONS.filter((q) => q.type === 'objetiva' && (q.skillId === focus || weak.includes(q.skillId)))
    .sort((a, b) => Number(rank(a) === 2) - Number(rank(b) === 2) || group(a.skillId) - group(b.skillId) || rank(a) - rank(b) || byDifficulty(a, b));
  const q = (i: number) => pool[i % Math.max(1, pool.length)]?.id ?? 'q01';
  const recall = studied(focus);
  const intro = (short: number, long: number): SessionStep[] => [
    ...(recall ? [{ kind: 'recordacao' as const, title: 'Recordar sem consultar', ref: l?.id, minutes: short }] : []),
    ...(l && !late && (!recall || minutes >= 20) ? [{ kind: 'explicacao' as const, title: minutes === 40 ? 'Aula completa' : minutes === 20 ? 'Microaula' : 'Explicação essencial', ref: l.id, minutes: recall ? long - short : long }] : []),
  ];
  const qs = (n: number, min: number): SessionStep[] => Array.from({ length: n }, (_, i) => ({ kind: 'questao' as const, title: `Questão ${i + 1}`, ref: q(i), minutes: min }));
  const twin: SessionStep = { kind: 'gemea', title: 'Questão gêmea (transferência)', ref: q(0), minutes: 4 };
  const cards = (count: number, min: number): SessionStep => ({ kind: 'flashcards', title: 'Revisão espaçada', count, minutes: min });
  const steps: SessionStep[] = minutes === 5 ? [...intro(1, 1), ...qs(1, 3), cards(1, 1)]
    : minutes === 10 ? [...intro(2, 2), ...qs(2, 3), cards(3, 2)]
    : minutes === 20 ? [...intro(2, 5), ...qs(late ? 3 : 2, 4), twin, cards(5, 3)]
    : [...intro(3, 10), ...qs(late ? 5 : 3, 4), twin, cards(10, 6), { kind: 'paragrafo', title: 'Laboratório C3: um parágrafo', minutes: 8 }];
  return { focus, phase, steps };
}

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
/** Semana em blocos: seg–qui com assuntos alternados, quarta com redação, sexta para pendências e revisão, sábado simulado, domingo livre. */
export function weekPlan(profile: Profile | null, attempts: Attempt[], now = Date.now()) {
  const { phase } = studyPhase(profile, now);
  const perDay = Math.max(15, Math.round(((profile?.weeklyHours ?? 6) * 60) / 6 / 5) * 5);
  const order = [...new Set([...weakSkills(attempts, profile), ...SKILLS.map((s) => s.id).sort((a, b) => priorityWeight(b, profile?.goal) - priorityWeight(a, profile?.goal))])];
  const open = order.filter((id) => !exerciseLoad(id, attempts).enough);
  const queue = open.length >= 2 ? open : order;
  const first = queue.filter((_, i) => i % 2 === 0), second = queue.filter((_, i) => i % 2 === 1);
  const name = (id: string) => skillById(id)!.name;
  const half = Math.max(5, Math.round(perDay / 2 / 5) * 5);
  const d = new Date(now);
  const sat = new Date(now); sat.setDate(d.getDate() + 5 - ((d.getDay() + 6) % 7));
  const lastSat = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() + 7).getMonth() !== sat.getMonth();
  return DAYS.map((day, i) => {
    if (i === 6) return { day, minutes: 0, tasks: ['Descanso (o descanso faz parte do aprendizado)'] };
    if (phase === 'descanso') return { day, minutes: 0, tasks: ['Descanse a mente; no máximo, alguns flashcards'] };
    if (i === 4) return { day, minutes: perDay, tasks: ['Pendências da semana', 'Revisão da semana: recordar sem consultar + questões', 'Flashcards pendentes'] };
    if (i === 5) return { day, minutes: perDay + 20, tasks: [phase === 'base' || phase === 'pos' ? 'Simulado rápido (10 questões)' : 'Simulado com tempo de prova, sem pausa', 'Corrigir logo em seguida, começando pelos erros fáceis', ...(lastSat ? ['Revisão geral do mês'] : [])] };
    const a = first[i % first.length], b = second[i % second.length];
    const rev = phase === 'reta_final';
    const tasks = [rev ? `Revisão ativa: ${name(a)} (${half} min)` : `Bloco 1: ${name(a)} — teoria + questões (${half} min)`];
    tasks.push(i === 2 ? `Bloco 2: redação — um texto ou parágrafo (${half} min)` : rev ? `Bateria de questões: ${name(b)} (${half} min)` : `Bloco 2: ${name(b)} — ${phase === 'consolidacao' ? 'questões e revisão' : 'teoria + questões'} (${half} min)`);
    tasks.push('Flashcards pendentes (5 min)');
    return { day, minutes: perDay, tasks };
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
