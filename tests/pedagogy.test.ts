import { beforeAll, describe, expect, it } from 'vitest';
import { cpeMastered, detectDifficulties, difficultySkills, errorPatterns } from '../src/engine/difficulties';
import { recommend, alternativeTo, essayRecommendation, dayPlan } from '../src/engine/recommender';
import { evaluateExplanation, pickTask } from '../src/engine/explain';
import { verdictFrom } from '../src/services/ai';
import { explainTaskById, EXPLAIN_TASKS } from '../src/data/explainTasks';
import { chooseLevel, isNone, selectTwin } from '../src/engine/twins';
import { generate, GENERATOR_SKILLS } from '../src/engine/generator';
import { intervalFor, review, retrievability } from '../src/engine/fsrs';
import { dueSkillReviews, outcomeOfAttempt, scheduleSkill, strategicPlans } from '../src/engine/skillReview';
import { allDomains } from '../src/engine/domain';
import { FLASHCARDS } from '../src/data/flashcards';
import { orphanSkills, ALL_BLOCKS, CURRICULUM } from '../src/data/curriculum';
import { MATRIX_SKILLS, MATRIX_COMPETENCIES } from '../src/data/matrix';
import { SKILLS } from '../src/data/skills';
import { QUESTIONS } from '../src/data/questions';
import { LESSONS } from '../src/data/lessons';
import { examDate, exerciseLoad, nextUnseen, priorityWeight, studyPhase } from '../src/engine/strategy';
import { DEFAULT_PARAMS } from '../src/engine/params';
import { at, DAY, ex, Q, T0 } from './helpers';

const mem = new Map<string, string>();
beforeAll(() => { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) } }); });
const base = { explanations: [], skillReviews: {}, cards: FLASHCARDS, cardStates: {}, essays: [], essayPractice: [], pendings: [] };
const em = [at('q01', true, 0), at('v01', true, 1), at('v13', true, 1), at('v14', true, 2), at('v07', true, 2), at('v02', false, 3), at('v03', false, 3), at('v05', false, 4), at('v06', false, 4), at('v09', false, 5)];

describe('integridade dos dados', () => {
  it('toda habilidade está no currículo e aponta para a matriz oficial', () => {
    expect(orphanSkills()).toEqual([]); expect(CURRICULUM).toHaveLength(4);
    expect(Object.keys(MATRIX_SKILLS)).toHaveLength(120); expect(Object.keys(MATRIX_COMPETENCIES)).toHaveLength(30);
    SKILLS.forEach((s) => { expect(s.matrix.length).toBeGreaterThan(0); s.matrix.forEach((m) => expect(MATRIX_SKILLS[m], `${s.id} ${m}`).toBeDefined()); s.prerequisites.forEach((p) => expect(SKILLS.some((x) => x.id === p)).toBe(true)); });
  });
  it('questões: ids únicos, cinco alternativas, um gabarito, habilidade existente', () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    QUESTIONS.forEach((q) => { expect(SKILLS.some((s) => s.id === q.skillId), q.id).toBe(true); expect(q.alternatives, q.id).toHaveLength(5); expect(q.alternatives!.filter((a) => a.correct), q.id).toHaveLength(1); expect(new Set(q.alternatives!.map((a) => a.text)).size, q.id).toBe(5); });
  });
  it('CPE só existe em Linguagens e Humanas, e a prova está no texto', () => {
    QUESTIONS.filter((q) => q.cpe).forEach((q) => { expect(['Linguagens', 'Ciências Humanas'], q.id).toContain(q.area); expect(q.cpe!.excesso.map((e) => e.letter).sort()).toEqual(q.alternatives!.filter((a) => !a.correct).map((a) => a.letter).sort()); });
  });
  it('aulas apontam para questões existentes', () => { LESSONS.forEach((l) => l.exerciseIds.forEach((id) => expect(Q(id), `${l.id} ${id}`).toBeDefined())); });
  it('todas as habilidades têm ao menos uma questão', () => { SKILLS.forEach((s) => expect(QUESTIONS.some((q) => q.skillId === s.id), s.id).toBe(true)); });
});

describe('dificuldades e padrões de erro', () => {
  it('reproduz o exemplo: 5 erros em 10 em Eletromagnetismo, com campo e força magnética', () => {
    const d = detectDifficulties(em)[0];
    expect(d.block.name).toBe('Eletromagnetismo'); expect(d.errors).toBe(5); expect(d.total).toBe(10);
    expect(difficultySkills(d)).toContain('força magnética'); expect(difficultySkills(d)).toContain('campo magnético');
  });
  it('uma única questão nunca indica dificuldade nem padrão', () => {
    expect(detectDifficulties([at('v05', false, 0)])).toEqual([]); expect(errorPatterns([at('v05', false, 0, { selfCategory: 'atencao' })])).toEqual([]);
  });
  it('autoclassificação é evidência acumulada; erro sem causa declarada também é registrado', () => {
    const xs = ['v02', 'v03', 'v05'].map((q, i) => at(q, false, i, { selfCategory: 'conceitual' }));
    expect(errorPatterns(xs)[0]).toMatchObject({ label: 'Conceitual', declared: 3, confidence: 'alta' });
    const silent = ['v05', 'v06', 'v09'].map((q, i) => at(q, false, i)); const p = errorPatterns(silent)[0];
    expect(p === undefined || p.confidence === 'baixa').toBe(true);
  });
  it('etapas do CPE já demonstradas podem ser ignoradas', () => {
    const ok = (d: number) => at('q24', false, d, { cpe: { comando: 'demonstrada', prova: 'dificuldade', eliminacao: 'demonstrada' } });
    expect(cpeMastered([ok(0)])).toEqual([]); expect(cpeMastered([ok(0), ok(1)])).toEqual(['comando', 'eliminacao']);
  });
});

describe('recomendações e sessões', () => {
  it('prioriza a dificuldade e compõe aula, explicação ativa e questões gêmeas', () => {
    const r = recommend({ ...base, attempts: em, now: T0 + 6 * DAY })[0];
    expect(r.type).toBe('recuperacao'); expect(r.question).toBe('Vamos melhorar seu desempenho em Eletromagnetismo?'); expect(r.reason).toContain('5 erros em 10');
    const kinds = r.steps.map((s) => s.kind);
    expect(kinds).toContain('explicacao'); expect(kinds).toContain('gemea'); expect(kinds.some((k) => k === 'aula' || k === 'microaula')).toBe(true); expect(kinds.at(-1)).toBe('consolidacao'); expect(r.audit.length).toBeGreaterThan(1);
  });
  it('a composição não é rígida: erro de aplicação pede exemplo resolvido, não aula', () => {
    const proc = em.map((a) => (a.correct ? a : { ...a, selfCategory: 'procedimental' as const }));
    const kinds = recommend({ ...base, attempts: proc, now: T0 + 6 * DAY })[0].steps.map((s) => s.kind);
    expect(kinds).toContain('exemplo'); expect(kinds).not.toContain('aula');
  });
  it('quem resolve bem recebe comprovação; quem domina recebe aprofundamento', () => {
    const attempts = [at('q01', true, 0), at('q02', true, 2, { isTwin: true, twinLevel: 2 })];
    const a = recommend({ ...base, attempts, now: T0 + 3 * DAY }, 60);
    expect(a.find((p) => p.type === 'comprovacao')?.reason).toContain('explicar o conceito');
    const b = recommend({ ...base, attempts, explanations: [ex('e-pot-quad', 'demonstrada', 2)], now: T0 + 3 * DAY }, 60);
    expect(b.some((p) => p.type === 'aprofundamento' && p.skillIds[0] === 'fis-potencia')).toBe(true);
  });
  it('conteúdo não avaliado começa verificando o que o estudante já sabe', () => {
    const r = recommend({ ...base, attempts: [], now: T0 }).find((p) => p.type === 'aprendizagem')!;
    expect(r.steps[0].kind).toBe('verificacao'); expect(r.reason).toContain('não sabe se você domina');
  });
  it('adiar ou ignorar tira da lista e mantém a pendência; substituir oferece outra', () => {
    const all = recommend({ ...base, attempts: em, now: T0 + 6 * DAY }, 10); const key = all[0].key;
    const hidden = recommend({ ...base, attempts: em, now: T0 + 6 * DAY, pendings: [{ key, type: 'recuperacao', title: '', skillIds: [], status: 'adiada', createdAt: 0, until: T0 + 8 * DAY, reason: '' }] }, 10);
    expect(hidden.some((p) => p.key === key)).toBe(false);
    expect(recommend({ ...base, attempts: em, now: T0 + 9 * DAY, pendings: [{ key, type: 'recuperacao', title: '', skillIds: [], status: 'adiada', createdAt: 0, until: T0 + 8 * DAY, reason: '' }] }, 10).some((p) => p.key === key)).toBe(true);
    expect(alternativeTo(key, all)?.key).not.toBe(key);
  });
  it('reta final não traz conteúdo novo', () => {
    const exam = examDate(2027).getTime();
    expect(recommend({ ...base, attempts: em, examYear: 2027, now: exam - 20 * DAY }, 60).some((p) => p.type === 'aprendizagem')).toBe(false);
  });
  it('plano do dia respeita o tempo e domingo é livre', () => {
    const sunday = new Date('2026-08-09T10:00:00').getTime();
    expect(dayPlan({ ...base, attempts: em, now: sunday, weeklyHours: 6 })[0].minutes).toBe(0);
    expect(dayPlan({ ...base, attempts: em, now: T0 + 7 * DAY, weeklyHours: 6 }).length).toBeGreaterThan(0);
  });
  it('sem redações não há recomendação de redação', () => { expect(essayRecommendation({ essays: [], essayPractice: [] })).toBeNull(); });
});

describe('explicação ativa', () => {
  const t = explainTaskById('e-pot-quad')!;
  it('reconhece uma boa explicação em palavras próprias', () => {
    const r = evaluateExplanation(t, 'Como a resistência é constante, pela lei de Ohm a corrente dobra junto com a tensão. A potência é o produto das duas, então o dobro vezes o dobro dá quatro vezes o valor inicial.');
    expect(r.result).toBe('demonstrada');
  });
  it('lista de palavras-chave não basta', () => {
    expect(evaluateExplanation(t, 'resistência constante, corrente, tensão, dobro, potência, quatro vezes, quadrado, U²').result).toBe('nao_demonstrada');
  });
  it('concepção incorreta impede demonstração', () => {
    const r = evaluateExplanation(t, 'A corrente permanece constante porque a resistência não muda. Então a potência, que é o produto, quadruplica quando a tensão dobra duas vezes.');
    expect(r.result).toBe('nao_demonstrada'); expect(r.errors.length).toBeGreaterThan(0);
  });
  it('texto curto não demonstra; texto consistente fora da rubrica é inconclusivo; copiar a referência não vale', () => {
    expect(evaluateExplanation(t, 'Porque dobra.').result).toBe('nao_demonstrada');
    expect(evaluateExplanation(t, 'Quando ligamos um aparelho em outra tomada, o brilho muda bastante porque ele passa a receber muito mais do que foi projetado para suportar, e por isso ele esquenta demais e pode até queimar depois de algum tempo de uso.').result).toBe('inconclusiva');
    expect(evaluateExplanation(t, t.reference).result).toBe('nao_demonstrada');
  });
  it('com apoio não comprova autonomia', () => {
    const r = evaluateExplanation(t, 'Como a resistência é constante, a corrente dobra junto com a tensão. A potência é o produto das duas, então dobro vezes dobro dá quatro.', { assisted: true });
    expect(r.result).not.toBe('demonstrada'); expect(r.criteria.find((c) => c.id === 'autonomia')!.score).toBe(0);
  });
  it('a referência de cada atividade satisfaz a própria rubrica', () => {
    EXPLAIN_TASKS.forEach((k) => { const r = evaluateExplanation(k, k.reference); expect(r.missing, k.id).toEqual([]); expect(r.errors, k.id).toEqual([]); });
  });
  it('inclui os exemplos pedidos e adapta ao nível', () => {
    expect(pickTask('fis-potencia', 'avancado', [])!.id).toBe('e-pot-cond'); expect(pickTask('fis-potencia', 'intermediario', [])!.id).toBe('e-pot-quad');
    ['e-pot-ener', 'e-pot-quad', 'e-adh-aldo', 'e-equilibrio', 'e-centripeta'].forEach((id) => expect(explainTaskById(id)).toBeDefined());
  });
  it('com IA, o veredito continua sendo regra fixa do motor', () => {
    const c = (correcao: 0 | 1 | 2, completude: 0 | 1 | 2, coerencia: 0 | 1 | 2, relacoes: 0 | 1 | 2, autonomia: 0 | 1 | 2) => Object.entries({ correcao, completude, coerencia, relacoes, autonomia }).map(([id, score]) => ({ id, score, note: '' })) as never;
    expect(verdictFrom(c(2, 2, 2, 2, 2))).toBe('demonstrada'); expect(verdictFrom(c(0, 2, 2, 2, 2))).toBe('nao_demonstrada'); expect(verdictFrom(c(2, 1, 1, 1, 2))).toBe('parcial'); expect(verdictFrom(c(2, 2, 2, 2, 0))).toBe('nao_demonstrada');
  });
});

describe('questões gêmeas', () => {
  it('são inéditas e nunca repetem a original', () => {
    for (const lv of [1, 2, 3] as const) { const t = selectTwin('fis-potencia', lv, [at('q01', true, 0)], { originId: 'q01', seed: 7 }); expect(isNone(t)).toBe(false); if (!isNone(t)) expect(t.q.id).not.toBe('q01'); }
  });
  it('sem questão confiável, não apresenta nada', () => {
    const all = QUESTIONS.filter((q) => q.skillId === 'fil-antiga').map((q) => at(q.id, true, 0)); expect(isNone(selectTwin('fil-antiga', 2, all))).toBe(true);
  });
  it('modelos paramétricos: gabarito recalculado em todas as variações', () => {
    GENERATOR_SKILLS.forEach(({ id }) => { for (let s = 1; s <= 40; s++) { const g = generate(id, { seed: s * 31 })!; const calc = g.validation.find((v) => v.check === 'Verificação do cálculo')!; expect(calc.ok, `${id} ${s}`).toBe(true); if (g.status === 'aprovada') expect(new Set(g.q.alternatives!.map((a) => a.text)).size, `${id} ${s}`).toBe(5); } });
  });
  it('falha injetada é detectada', () => { for (let s = 1; s < 10; s++) expect(generate('fis-potencia', { seed: s, injectFault: true })!.status).not.toBe('aprovada'); });
  it('nível sobe com acerto e desce com erro', () => {
    expect(chooseLevel('fis-potencia', [at('q02', true, 0, { isTwin: true, twinLevel: 2 })])).toBe(3); expect(chooseLevel('fis-potencia', [at('q02', false, 0, { isTwin: true, twinLevel: 2 })])).toBe(1);
  });
});

describe('revisão adaptativa', () => {
  it('FSRS: intervalos crescem com acerto, caem com erro e diferem por avaliação', () => {
    const a = review(undefined, 3, T0); const b = review(a, 3, a.due); expect(b.s).toBeGreaterThan(a.s);
    expect(review(a, 1, a.due).s).toBeLessThan(a.s); expect(review(a, 4, a.due).due).toBeGreaterThan(review(a, 2, a.due).due);
    expect(retrievability(a, a.last)).toBeCloseTo(1); expect(retrievability(a, a.last + a.s * DAY)).toBeCloseTo(0.9, 2); expect(intervalFor(10, 0.9)).toBe(10);
  });
  it('intervalos variam conforme incidência e proximidade da prova', () => {
    const f = (id: string, left: number | null = null) => { let r = scheduleSkill(undefined, id, 'forte', T0, DEFAULT_PARAMS, left); for (let i = 0; i < 3; i++) r = scheduleSkill(r, id, 'forte', r.due, DEFAULT_PARAMS, left); return r.interval; };
    expect(f('bio-genetica')).toBeGreaterThan(f('bio-ecologia')); expect(f('bio-ecologia', 30)).toBeLessThanOrEqual(10);
    expect(scheduleSkill(scheduleSkill(undefined, 'bio-ecologia', 'forte', T0), 'bio-ecologia', 'fraca', T0 + DAY).interval).toBe(1);
  });
  it('atividade livre com evidência suficiente reagenda a revisão; chute e assistida não', async () => {
    expect(outcomeOfAttempt(at('q01', true, 0))).toBe('forte'); expect(outcomeOfAttempt(at('q01', true, 0, { confidence: 'chute' }))).toBeNull(); expect(outcomeOfAttempt(at('q01', true, 0, { assisted: true }))).toBeNull();
    const { useStore } = await import('../src/store/useStore');
    useStore.getState().createProfile({ nickname: 'T', course: '', examYear: 2030, weeklyHours: 6, goal: 'ENEM' });
    useStore.setState({ skillReviews: { 'fis-potencia': { due: 1, interval: 3, ease: 2, lapses: 0 } } });
    useStore.getState().recordAttempt({ qid: 'q01', chosen: 'C', correct: true, confidence: 'certeza', ts: Date.now(), mode: 'bateria' }, Q('q01'));
    expect(useStore.getState().skillReviews['fis-potencia'].due).toBeGreaterThan(Date.now());
  });
  it('fila prioriza e começa por recuperação ativa', () => {
    const attempts = [at('v01', true, 0)]; const items = dueSkillReviews({ 'fis-campo-magnetico': { due: T0, interval: 3, ease: 2, lapses: 1 } }, allDomains({ attempts, explanations: [] }), attempts, T0 + 5 * DAY);
    expect(items[0].options[0].kind).toBe('explicacao'); expect(items[0].options.some((o) => o.kind === 'inedita')).toBe(true);
  });
  it('planos semanal, mensal e final', () => {
    const p = strategicPlans({ domains: allDomains({ attempts: em, explanations: [] }), attempts: em, cards: FLASHCARDS, cardStates: {}, examYear: 2027, now: T0 + 6 * DAY });
    expect(p.map((x) => x.kind)).toEqual(['semanal', 'mensal', 'final']); expect(p[0].focus.length).toBeGreaterThan(0);
  });
});

describe('priorização estratégica', () => {
  it('incidência ordena, básico primeiro e dose por relevância', () => {
    expect(priorityWeight('bio-ecologia')).toBeGreaterThan(priorityWeight('bio-genetica')); expect(nextUnseen('fis-campo-magnetico', [])!.difficulty).toBe('Fácil');
    expect(exerciseLoad('bio-ecologia', []).min).toBe(15);
  });
  it.each([[120, 'base'], [90, 'consolidacao'], [30, 'reta_final'], [2, 'descanso'], [-30, 'pos']] as const)('%i dias → %s', (d, p) => { expect(studyPhase({ examYear: 2027 }, examDate(2027).getTime() - d * DAY + 12 * 3600000).phase).toBe(p); });
  it('há bloco de Eletromagnetismo no currículo', () => { expect(ALL_BLOCKS.some((b) => b.name === 'Eletromagnetismo')).toBe(true); });
});

describe('atividades independentes e bloqueio da IA', () => {
  it('bateria só vira evidência ao concluir; IA bloqueada enquanto há atividade', async () => {
    const { useStore, aiLock } = await import('../src/store/useStore'); const s = useStore.getState();
    s.createProfile({ nickname: 'T', course: '', examYear: 2030, weeklyHours: 6, goal: 'ENEM' });
    const id = s.startActivity({ kind: 'bateria', title: 'B', qids: ['q01', 'v01'] });
    expect(aiLock(useStore.getState()).locked).toBe(true);
    s.answerActivity(id, 'q01', { chosen: 'C', confidence: 'certeza', timeSec: 10 }); expect(useStore.getState().attempts).toHaveLength(0);
    s.pauseActivity(id); expect(aiLock(useStore.getState()).locked).toBe(false); s.resumeActivity(id);
    s.finishActivity(id); s.finishActivity(id);
    expect(useStore.getState().attempts).toHaveLength(1); expect(aiLock(useStore.getState()).locked).toBe(false);
    s.setOpenQuestion('q02'); expect(aiLock(useStore.getState()).locked).toBe(true); s.setOpenQuestion(null);
  });
  it('perfil novo começa vazio; perfil demonstrativo é identificado e gera a recomendação do exemplo', async () => {
    const { useStore } = await import('../src/store/useStore'); const { loadDemo } = await import('../src/store/demoStudent');
    useStore.getState().createProfile({ nickname: 'Real', course: '', examYear: 2030, weeklyHours: 6, goal: 'ENEM' });
    expect(useStore.getState()).toMatchObject({ demo: false, attempts: [], explanations: [], essays: [] });
    loadDemo('marina'); const s = useStore.getState(); expect(s.demo).toBe(true);
    const recs = recommend({ attempts: s.attempts, explanations: s.explanations, skillReviews: s.skillReviews, cards: FLASHCARDS, cardStates: s.cardStates, essays: s.essays, essayPractice: s.essayPractice, pendings: [], examYear: s.profile!.examYear }, 80);
    expect(recs[0].question).toBe('Vamos melhorar seu desempenho em Eletromagnetismo?'); expect(recs[0].reason).toContain('5 erros em 10'); expect(recs.some((r) => r.type === 'redacao')).toBe(true);
    expect([...allDomains(s).values()].filter((d) => d.state === 'consolidado').length).toBeGreaterThan(0);
    loadDemo('caio'); const c = useStore.getState(); expect([...allDomains(c).values()].filter((d) => d.state === 'consolidado').length).toBeGreaterThan(1);
  });
});
