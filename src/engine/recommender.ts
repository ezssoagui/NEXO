import type { Attempt, CardState, Essay, EssayPractice, Explanation, Flashcard, Pending, SessionPlan, SessionStep, SessionType, SkillReview } from '../types';
import { SKILLS, prerequisitesOf, skillById } from '../data/skills';
import { lessonById } from '../data/lessons';
import { comparisonsForSkill } from '../data/comparisons';
import { tasksForSkill } from '../data/explainTasks';
import { blockOf } from '../data/curriculum';
import { hasGenerator } from './generator';
import { allDomains, isSolid, levelFor, skillName, type DomainMap, type SkillDomain } from './domain';
import { detectDifficulties, difficultySkills, difficultyText } from './difficulties';
import { dueSkillReviews } from './skillReview';
import { DEFAULT_PARAMS, type Params } from './params';
import { incidenceNote, priorityWeight, studyPhase, unseenFor } from './strategy';
import { pickTask } from './explain';
import { isDue } from './fsrs';
import { essayFocus } from './essayProfile';
import type { EssaySkill } from '../data/essaySkills';

/**
 * SESSÕES PERSONALIZADAS — motor de regras auditável (nenhuma IA decide aqui).
 * A composição não é rígida: cada atividade só entra se houver necessidade e material para ela.
 */
export interface RecInput {
  attempts: Attempt[]; explanations: Explanation[]; skillReviews: Record<string, SkillReview>; cards: Flashcard[]; cardStates: Record<string, CardState>;
  essays: Essay[]; essayPractice: EssayPractice[]; pendings: Pending[]; examYear?: number; params?: Params; now?: number; domains?: DomainMap;
}
export const TYPE_LABEL: Record<SessionType, string> = { recuperacao: 'Recuperação de dificuldade', aprendizagem: 'Novo conteúdo', aprofundamento: 'Aprofundamento', comprovacao: 'Comprovação de domínio', revisao: 'Revisão', redacao: 'Redação' };
const st = (kind: SessionStep['kind'], title: string, minutes: number, skillId?: string, ref?: string, count?: number): SessionStep => ({ kind, title, minutes, skillId, ref, count });
const total = (steps: SessionStep[]) => steps.reduce((s, x) => s + x.minutes, 0);

// ---------- Blocos de composição ----------
const lessonIdOf = (id: string) => { const l = skillById(id)?.lessonId; return l && lessonById(l) ? l : undefined; };
const conceptErrors = (id: string, attempts: Attempt[]) => attempts.filter((a) => a.skillId === id && !a.correct && (a.selfCategory === 'lacuna' || a.selfCategory === 'conceitual' || (!a.selfCategory && (a.errorType === 'lacuna_conceitual' || a.errorType === 'memorizacao')))).length;
const procErrors = (id: string, attempts: Attempt[]) => attempts.filter((a) => a.skillId === id && !a.correct && (a.selfCategory === 'procedimental' || a.selfCategory === 'aplicacao' || (!a.selfCategory && ['calculo', 'unidades', 'formula_incorreta', 'grandeza_constante'].includes(a.errorType ?? '')))).length;
function teach(id: string, d: SkillDomain, attempts: Attempt[]): SessionStep[] {
  const lid = lessonIdOf(id); const conc = conceptErrors(id, attempts); const proc = procErrors(id, attempts);
  if (!lid) return [st('conceito', `Explicação: ${skillName(id)}`, 3, id)];
  // Erros de aplicação sem lacuna conceitual pedem exemplo resolvido, não aula.
  if (proc > conc && d.dims.compreensao.status !== 'negativa') return [st('exemplo', 'Exemplo resolvido', 4, id, lid)];
  return conc >= 2 ? [st('aula', 'Aula direcionada', 10, id, lid)] : [st('microaula', 'Microaula direcionada', 4, id, lid)];
}
const recall = (id: string): SessionStep => st('recordacao', 'Recordar sem consultar', 3, id);
const compare = (id: string): SessionStep[] => { const c = comparisonsForSkill(id)[0]; return c ? [st('comparacao', `Comparar: ${c.a} × ${c.b}`, 4, id, c.id)] : []; };
const explain = (id: string, d: SkillDomain, done: Explanation[], now: number): SessionStep[] => { const t = pickTask(id, levelFor(d), done, now); return t ? [st('explicacao', 'Explicação ativa', 5, id, t.id)] : []; };
const twin = (id: string, attempts: Attempt[], n = 1): SessionStep[] => (unseenFor(id, attempts).length || hasGenerator(id) ? [st('gemea', n > 1 ? 'Questões gêmeas' : 'Questão gêmea', 4 * n, id, undefined, n)] : []);
const novel = (id: string, attempts: Attempt[], n = 1): SessionStep[] => { const k = Math.min(n, unseenFor(id, attempts).length); return k ? [st('inedita', k > 1 ? 'Questões inéditas' : 'Questão inédita', 4 * k, id, undefined, k)] : []; };
const done = (id: string): SessionStep => st('consolidacao', 'Consolidação e próxima revisão', 1, id);

/** Monta a sessão conforme o tipo e a necessidade demonstrada. */
export function compose(type: SessionType, ids: string[], domains: DomainMap, x: Pick<RecInput, 'attempts' | 'explanations'>, now = Date.now()): SessionStep[] {
  const [a, b] = ids; const d = domains.get(a)!;
  switch (type) {
    case 'recuperacao': return [...(d.dims.resolucao.status !== 'sem_evidencia' && d.evidence.some((e) => e.value === 'positiva') ? [recall(a)] : []), ...teach(a, d, x.attempts), ...(b ? compare(a).length ? compare(a) : compare(b) : compare(a)), ...explain(a, d, x.explanations, now), ...twin(a, x.attempts, b ? 1 : 2), ...(b ? twin(b, x.attempts) : []), done(a)];
    // Conteúdo não avaliado pode já ser conhecido: começa verificando, e só então ensina.
    case 'aprendizagem': return [...(unseenFor(a, x.attempts).length ? [st('verificacao', 'Verificação rápida do que você já sabe', 3, a)] : []), ...(lessonIdOf(a) ? [st('aula', 'Aula', 10, a, lessonIdOf(a)), st('exemplo', 'Exemplo resolvido', 4, a, lessonIdOf(a))] : [st('conceito', `Explicação: ${skillName(a)}`, 4, a)]), ...compare(a), ...explain(a, d, x.explanations, now), ...novel(a, x.attempts), done(a)];
    case 'aprofundamento': return [recall(a), ...explain(a, d, x.explanations, now), ...compare(a), ...(unseenFor(a, x.attempts, { integrates: true }).length ? [st('inedita', 'Questão de integração', 6, a, 'integra', 1)] : novel(a, x.attempts)), done(a)];
    case 'comprovacao': return [...(d.dims.resolucao.status !== 'demonstrada' ? novel(a, x.attempts) : []), ...(d.dims.compreensao.status !== 'demonstrada' ? explain(a, d, x.explanations, now) : []), ...(d.dims.transferencia.status !== 'demonstrada' ? twin(a, x.attempts) : []), done(a)];
    case 'revisao': return [recall(a), ...ids.slice(0, 3).flatMap((id, i) => (i % 2 === 0 && tasksForSkill(id).length ? explain(id, domains.get(id)!, x.explanations, now) : twin(id, x.attempts))), st('flashcards', 'Flashcards pendentes', 4, a, undefined, 6), done(a)];
    case 'redacao': return [];
  }
}

// ---------- Recomendações ----------
export function recommend(x: RecInput, limit = 6): SessionPlan[] {
  const now = x.now ?? Date.now(); const params = x.params ?? DEFAULT_PARAMS;
  const domains = x.domains ?? allDomains(x, params);
  const { phase } = studyPhase(x.examYear ? { examYear: x.examYear } : null, now);
  const late = phase === 'reta_final' || phase === 'descanso';
  const out: SessionPlan[] = [];
  const push = (type: SessionType, skillIds: string[], title: string, question: string, reason: string, audit: string[], priority: number, steps = compose(type, skillIds, domains, x, now)) => {
    if (steps.filter((s) => s.kind !== 'consolidacao').length) out.push({ key: `${type}:${skillIds.join('+')}`, type, title, question, reason, audit, skillIds, steps, minutes: total(steps), priority: +priority.toFixed(3) });
  };

  // 1) Dificuldades acumuladas por bloco
  const inDifficulty = new Set<string>();
  for (const df of detectDifficulties(x.attempts, params)) {
    const ids = df.skills.slice(0, 2).map((s) => s.id); ids.forEach((i) => inDifficulty.add(i));
    const weakPre = prerequisitesOf(ids[0]).find((p) => { const d = domains.get(p); return d?.evaluated && d.dims.resolucao.status === 'negativa'; });
    const target = weakPre && !ids.includes(weakPre) ? [weakPre, ids[0]] : ids;
    push('recuperacao', target, df.block.name, `Vamos melhorar seu desempenho em ${df.block.name}?`, `${difficultyText(df)} Dificuldades: ${difficultySkills(df)}.`, [
      `Regra: ≥ ${params.dificuldadeMinErros} erros e ≥ ${Math.round(params.dificuldadeTaxa * 100)}% de erro nas últimas ${params.janelaDificuldade} questões do bloco.`,
      `Observado: ${df.errors}/${df.total}.`, ...(weakPre ? [`Pré-requisito com erros: ${skillName(weakPre)}.`] : []), ...df.skills.map((s) => `${skillName(s.id)}: ${s.errors} erro(s) em ${s.total}.`)],
    8 * Math.max(...ids.map(priorityWeight)) * (0.7 + df.rate));
  }
  // 2) Perda de domínio (regressão)
  for (const d of domains.values()) if (d.regressed && !inDifficulty.has(d.skillId)) push('recuperacao', [d.skillId], skillName(d.skillId), `Vamos retomar ${skillName(d.skillId)}?`, 'Você já havia demonstrado domínio, mas as evidências recentes mudaram.', ['Regra: estado atual abaixo do melhor estado já alcançado.', ...Object.values(d.dims).map((v) => v.note)], 7.5 * priorityWeight(d.skillId));
  // 3) Revisões vencidas
  const due = dueSkillReviews(x.skillReviews, domains, x.attempts, now).filter((r) => !inDifficulty.has(r.skillId));
  const dueCards = x.cards.filter((c) => isDue(x.cardStates[c.id], now)).length;
  if (due.length || dueCards >= 8) {
    const ids = due.slice(0, 3).map((r) => r.skillId);
    if (ids.length) push('revisao', ids, 'Revisão ativa', 'Vamos verificar o que você ainda lembra?', `${due.length} habilidade(s) com revisão programada${dueCards ? ` e ${dueCards} flashcard(s) pendente(s)` : ''}.`, ['Regra: revisão vencida, ordenada por incidência, atraso e erros.', ...due.slice(0, 3).map((r) => `${skillName(r.skillId)}: ${r.reason}`)], (late ? 9 : 4.5) * Math.max(...ids.map(priorityWeight)) * (1 + Math.min(0.25, due.length / 40)));
  }
  // 4) Comprovação: resolve bem, mas faltam dimensões
  for (const d of domains.values()) {
    if (inDifficulty.has(d.skillId) || d.regressed || d.state !== 'em_aprendizagem' || d.dims.resolucao.status !== 'demonstrada') continue;
    const miss = [d.dims.compreensao.status !== 'demonstrada' && 'explicar o conceito', d.dims.transferencia.status !== 'demonstrada' && 'resolver em contexto novo'].filter(Boolean) as string[];
    push('comprovacao', [d.skillId], skillName(d.skillId), `Comprove seu domínio em ${skillName(d.skillId)}`, `Você resolve bem. Falta ${miss.join(' e ')}.`, ['Regra: resolução demonstrada com outra dimensão pendente.', ...Object.values(d.dims).map((v) => v.note)], (late ? 5 : 4.5) * priorityWeight(d.skillId));
  }
  // 5) Aprofundamento conceitual (inclusive para quem já domina)
  for (const d of domains.values()) if (d.state === 'provisorio' || d.state === 'consolidado') {
    const adv = pickTask(d.skillId, 'avancado', x.explanations, now); const doneAdv = adv && x.explanations.some((e) => e.taskId === adv.id && e.result === 'demonstrada');
    const integ = unseenFor(d.skillId, x.attempts, { integrates: true }).length;
    if ((adv && !doneAdv) || integ) push('aprofundamento', [d.skillId], skillName(d.skillId), `Aprofunde ${skillName(d.skillId)}`, 'Domínio demonstrado: hora de explorar condições, exceções e integração.', ['Regra: domínio provisório ou consolidado com atividade avançada disponível.'], 3 * priorityWeight(d.skillId) * (late ? 0.5 : 1));
  }
  // 6) Conteúdos ainda não avaliados (≠ desconhecidos), com pré-requisitos atendidos
  if (!late) for (const s of SKILLS) {
    const d = domains.get(s.id)!; if (d.evaluated) continue;
    const blocked = s.prerequisites.find((p) => { const pd = domains.get(p); return pd?.evaluated && pd.dims.resolucao.status === 'negativa'; });
    if (blocked) continue;
    const notEval = s.prerequisites.filter((p) => !domains.get(p)?.evaluated).length;
    const started = domainsTouchBlock(s.id, domains);
    push('aprendizagem', [s.id], s.name, `Conhecer ${s.name}`, `Ainda não avaliado: o NEXO não sabe se você domina este conteúdo.${incidenceNote(s.id) ? ` ${incidenceNote(s.id)}.` : ''}`, ['Regra: sem evidências e sem pré-requisito com erros.', 'A sessão começa verificando o que você já sabe.'], 3.2 * priorityWeight(s.id) * (notEval ? 0.75 : 1) * (started ? 1.1 : 1));
  }
  // 7) Redação
  const red = essayRecommendation(x); if (red) out.push({ ...red, priority: 4.2 });

  const hidden = new Set(x.pendings.filter((p) => p.until > now).map((p) => p.key));
  return out.filter((p) => !hidden.has(p.key)).sort((a, b) => b.priority - a.priority).slice(0, limit);
}
const domainsTouchBlock = (id: string, domains: DomainMap) => { const b = blockOf(id); return !!b && b.contents.some((c) => c.skills.some((s) => s !== id && domains.get(s)?.evaluated)); };

/** Substituição: outra recomendação de tipo ou bloco diferente. */
export const alternativeTo = (key: string, all: SessionPlan[]) => { const cur = all.find((p) => p.key === key); return all.find((p) => p.key !== key && p.type !== 'redacao' && (p.type !== cur?.type || blockOf(p.skillIds[0])?.id !== blockOf(cur.skillIds[0])?.id)); };

const essaySteps = (sk: EssaySkill): SessionStep[] => [st('red_aula', `Aula: ${sk.name}`, 4, undefined, sk.id), ...(sk.analysis ? [st('red_analise', 'Análise de um parágrafo', 4, undefined, sk.id)] : []), st('red_explicacao', 'Explicação ativa', 4, undefined, sk.id), st('red_paragrafo', 'Produção de um novo parágrafo', 10, undefined, sk.id), st('red_verificacao', 'Verificação em outro tema', 8, undefined, sk.id)];
/** Sessão de redação escolhida pelo próprio estudante. */
export const essaySession = (sk: EssaySkill): SessionPlan => { const steps = essaySteps(sk); return { key: `redacao:${sk.id}`, type: 'redacao', title: `${sk.comp} · ${sk.name}`, question: sk.name, reason: 'Sessão iniciada por você.', audit: ['Iniciada pelo estudante.'], skillIds: [], steps, minutes: total(steps), priority: 0 }; };

export function essayRecommendation(x: Pick<RecInput, 'essays' | 'essayPractice'>): Omit<SessionPlan, 'priority'> | null {
  const f = essayFocus(x.essays, x.essayPractice); if (!f) return null;
  const sk = (f.difficulties[0] ?? f.skills.find((s) => s.state !== 'comprovada') ?? f.skills[0]).skill;
  const steps = essaySteps(sk);
  return { key: `redacao:${sk.id}`, type: 'redacao', title: `${f.id} · ${sk.name}`, question: f.difficulties.length ? `Você apresenta dificuldades recorrentes na Competência ${f.id[1]}.` : `Vamos fortalecer a Competência ${f.id[1]}?`, reason: f.difficulties[0]?.note ?? `Média recente estimada: ${f.avg} de 200.`, audit: ['Regra: sinal de dificuldade em ≥ 2 textos, ou média ≤ 120 em ≥ 2 textos.', 'Notas são estimativas formativas.'], skillIds: [], steps, minutes: total(steps) };
}

/** Plano do dia: curto e proporcional ao tempo semanal. */
export interface DayItem { label: string; minutes: number; to?: string; key?: string }
export function dayPlan(x: RecInput & { weeklyHours: number }): DayItem[] {
  const now = x.now ?? Date.now(); const budget = Math.max(20, Math.round((x.weeklyHours * 60) / 6)); const dow = new Date(now).getDay();
  if (dow === 0) return [{ label: 'Dia livre. Se quiser, apenas flashcards.', minutes: 0, to: '/revisoes' }];
  const recs = recommend(x, 4); const items: DayItem[] = []; let left = budget;
  const add = (i: DayItem) => { items.push(i); left -= i.minutes; };
  const dueC = x.cards.filter((c) => isDue(x.cardStates[c.id], now)).length;
  if (dueC) add({ label: `Flashcards pendentes (${Math.min(dueC, 15)})`, minutes: 6, to: '/revisoes' });
  if (dow === 5) add({ label: 'Pendências e revisão da semana', minutes: 20, to: '/revisoes?aba=estrategica' });
  if (dow === 6) add({ label: 'Simulado curto e correção', minutes: 40, to: '/simulados' });
  if (dow === 3) add({ label: 'Redação: um texto ou parágrafo', minutes: 25, to: '/redacao' });
  for (const r of recs.filter((p) => p.type !== 'redacao')) if (left >= 10 && items.length < 4) add({ label: `${TYPE_LABEL[r.type]}: ${r.title}`, minutes: r.minutes, key: r.key });
  return items;
}
export const recentAccuracy = (attempts: Attempt[], n = 20) => { const xs = attempts.filter((a) => !a.assisted).slice(-n); return xs.length ? xs.filter(isSolid).length / xs.length : null; };
