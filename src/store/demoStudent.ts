// Perfis DEMONSTRATIVOS: histórico FICTÍCIO, carregado só por escolha explícita e identificado em toda a interface.
import type { Attempt, CardRating, CardState, ErrorCategory, Explanation, Profile, Question } from '../types';
import { QUESTIONS, questionById } from '../data/questions';
import { FLASHCARDS } from '../data/flashcards';
import { DEMO_ESSAYS, ESSAY_THEMES } from '../data/essays';
import { explainTaskById } from '../data/explainTasks';
import { evaluateEssay } from '../engine/essay';
import { EXPLAIN_ENGINE } from '../engine/explain';
import { review } from '../engine/fsrs';
import { skillById } from '../data/skills';
import { useStore } from './useStore';

const DAY = 86400000;
export const nextExamYear = (now = new Date()) => (now.getMonth() >= 10 ? now.getFullYear() + 1 : now.getFullYear());
export const DEMO_PROFILES: Record<'marina' | 'caio', { label: string; desc: string; profile: () => Profile }> = {
  marina: { label: 'Marina', desc: 'Três semanas de estudo, com dificuldade em Eletromagnetismo e na Competência 3 da redação.', profile: () => ({ nickname: 'Marina', course: 'Medicina', examYear: nextExamYear(), weeklyHours: 12, goal: 'ENEM' }) },
  caio: { label: 'Caio', desc: 'Desempenho alto e domínio em parte do currículo: recebe comprovações e aprofundamentos.', profile: () => ({ nickname: 'Caio', course: 'Engenharia Elétrica', examYear: nextExamYear(), weeklyHours: 14, goal: 'ENEM' }) },
};

type Row = [qid: string, daysAgo: number, ok: boolean, extra?: Partial<Attempt>];
const wrongLetter = (q: Question) => q.alternatives!.find((a) => !a.correct)!;

function build(rows: Row[], explains: [taskId: string, daysAgo: number, result: Explanation['result']][], now: number) {
  type Ev = { ts: number; run: () => void };
  const st = useStore.getState; const evs: Ev[] = [];
  rows.forEach(([qid, d, ok, extra], i) => {
    const q = questionById(qid)!; const right = q.alternatives!.find((a) => a.correct)!; const alt = ok ? right : q.alternatives!.find((a) => a.letter === extra?.chosen) ?? wrongLetter(q);
    const ts = now - d * DAY + (i % 7) * 240000 - 3600000;
    evs.push({ ts, run: () => st().recordAttempt({ qid, chosen: alt.letter, correct: ok, confidence: ok ? 'certeza' : 'duvida', ts, mode: 'adaptativo', timeSec: 60 + (i % 5) * 25, errorType: ok ? undefined : alt.errorType, corrected: true, ...extra }, q) });
  });
  explains.forEach(([taskId, d, result]) => {
    const t = explainTaskById(taskId)!; const ts = now - d * DAY;
    evs.push({ ts, run: () => st().recordExplanation({ taskId, skillId: t.skillId, level: t.level, text: '(explicação fictícia do perfil demonstrativo)', ts, result, engine: EXPLAIN_ENGINE, demo: true, criteria: [], context: 'livre' }) });
  });
  evs.sort((a, b) => a.ts - b.ts).forEach((e) => e.run());
}

export function loadDemo(who: keyof typeof DEMO_PROFILES, now = Date.now()) {
  useStore.getState().createProfile(DEMO_PROFILES[who].profile(), true);
  const c = (selfCategory: ErrorCategory, chosen?: string): Partial<Attempt> => ({ selfCategory, chosen });
  if (who === 'marina') build([
    // Biologia: domínio consolidado em ecologia e osmorregulação em progresso
    ['q15', 20, true], ['v26', 18, true], ['v58', 12, true], ['v27', 5, true], ['q13', 19, true], ['q14', 10, true, { isTwin: true, twinLevel: 2 }],
    ['v24', 16, true], ['v25', 8, true],
    // Matemática
    ['q37', 20, true], ['q38', 18, true], ['q17', 17, true], ['q18', 9, true, { isTwin: true, twinLevel: 2 }], ['q33', 4, true], ['q22', 15, true], ['v32', 7, true], ['q20', 14, false, c('procedimental')], ['q19', 6, true], ['v30', 6, true], ['v31', 5, false, c('aplicacao')],
    // Química
    ['v20', 13, true], ['v21', 11, true], ['q11', 12, true], ['q07', 10, false, c('conceitual')], ['q08', 4, true],
    // Física: mecânica razoável, eletromagnetismo com dificuldade (5 erros em 10)
    ['q03', 19, true], ['q04', 15, true], ['v16', 14, true], ['v17', 13, false, c('procedimental')],
    ['q01', 16, true], ['v13', 12, true], ['v14', 11, true], ['v01', 9, true], ['v02', 8, false, c('aplicacao', 'B')], ['v03', 6, false, c('conceitual', 'C')], ['v05', 5, false, c('conceitual', 'A')], ['v06', 4, false, c('conceitual', 'A')], ['v09', 3, false, c('conceitual', 'B')], ['v07', 2, true],
    // Linguagens e Humanas
    ['q23', 17, true], ['q24', 9, false, { cpe: { comando: 'demonstrada', prova: 'dificuldade', eliminacao: 'demonstrada' } }], ['v35', 8, true], ['v36', 6, true], ['q25', 7, true], ['v38', 10, true], ['v39', 3, false, { cpe: { comando: 'demonstrada', prova: 'dificuldade', eliminacao: 'demonstrada' } }],
    ['q26', 16, true], ['v57', 7, true], ['q27', 12, true], ['v49', 4, true], ['v47', 5, true], ['v52', 9, true], ['v54', 6, true],
  ], [['e-adh-aldo', 11, 'demonstrada'], ['e-porcent', 8, 'demonstrada'], ['e-glicemia', 9, 'parcial'], ['e-newton', 10, 'demonstrada'], ['e-media', 6, 'demonstrada'], ['e-campo', 7, 'parcial']], now);
  else build([
    ['q01', 30, true], ['q02', 24, true, { isTwin: true, twinLevel: 2 }], ['q31', 10, true], ['v13', 28, true], ['v14', 20, true], ['v15', 8, true], ['v01', 22, true], ['v02', 20, true], ['v03', 9, true], ['v05', 21, true], ['v06', 18, true], ['v07', 12, true], ['v09', 5, true], ['v10', 11, true], ['v12', 6, true],
    ['q03', 30, true], ['q04', 20, true], ['q36', 9, true], ['v16', 25, true], ['v17', 16, true], ['v18', 14, true], ['q05', 13, true], ['q06', 15, true], ['v34', 6, true],
    ['q37', 30, true], ['q38', 27, true], ['q17', 26, true], ['q18', 17, true, { isTwin: true, twinLevel: 2 }], ['q33', 8, true], ['q20', 24, true], ['v28', 13, true], ['v29', 5, true], ['q22', 21, true], ['v32', 12, true], ['v30', 18, true], ['v31', 10, true], ['q21', 9, true],
    ['q07', 23, true], ['q08', 15, true, { isTwin: true, twinLevel: 2 }], ['q09', 14, true], ['v20', 19, true], ['v22', 8, true],
    ['q23', 20, false, { cpe: { comando: 'dificuldade', prova: 'demonstrada', eliminacao: 'demonstrada' } }], ['q24', 12, false, { cpe: { comando: 'dificuldade', prova: 'demonstrada', eliminacao: 'dificuldade' } }], ['v36', 7, false, { cpe: { comando: 'dificuldade', prova: 'demonstrada', eliminacao: 'demonstrada' } }], ['q26', 18, true], ['v57', 6, false], ['q27', 11, true],
  ], [['e-pot-quad', 22, 'demonstrada'], ['e-pot-cond', 4, 'demonstrada'], ['e-pot-ener', 19, 'demonstrada'], ['e-forca-mag', 13, 'demonstrada'], ['e-porcent', 18, 'demonstrada'], ['e-equilibrio', 14, 'demonstrada'], ['e-newton', 12, 'demonstrada']], now);

  // Flashcards
  const cardStates: Record<string, CardState> = {};
  FLASHCARDS.slice(0, 16).forEach((card, i) => { let s: CardState | undefined; let t = now - (15 - (i % 6)) * DAY; for (let k = 0; k < 1 + (i % 3); k++) { s = review(s, ([3, 3, 2, 4, 1][(i + k) % 5]) as CardRating, t); t += 4 * DAY; } cardStates[card.id] = s!; });
  // Redações (textos demonstrativos)
  const theme = (id: string) => ESSAY_THEMES.find((t) => t.id === id)!; const weak = DEMO_ESSAYS[1], good = DEMO_ESSAYS[0], mid = DEMO_ESSAYS[2];
  const mk = (e: typeof weak, d: number, themeId = e.themeId) => ({ id: `e-demo-${e.id}`, themeId, draft: e.text, versions: [{ text: e.text, ts: now - d * DAY, eval: evaluateEssay(e.text, theme(themeId)) }] });
  useStore.setState({ cardStates, essays: who === 'marina' ? [mk(weak, 12), mk(mid, 5)] : [mk(good, 9)] });
}

/** Verifica referências do histórico demonstrativo (usado nos testes). */
export const demoQuestionsExist = () => QUESTIONS.length > 0 && !!skillById('fis-potencia');
