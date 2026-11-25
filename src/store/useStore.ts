import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Activity, Attempt, CardRating, CardState, CpeStepId, ErrorCategory, Essay, EssayPractice, EssayVersion, Explanation, Flashcard, GeneratedQuestion, Pending, Profile, Question, SessionPlan, SessionRecord, SkillReview } from '../types';
import { QUESTIONS } from '../data/questions';
import { DEFAULT_PARAMS, type Params } from '../engine/params';
import { review as fsrsReview } from '../engine/fsrs';
import { outcomeOfAttempt, outcomeOfExplanation, scheduleSkill } from '../engine/skillReview';
import { studyPhase } from '../engine/strategy';

/** Estado local do protótipo. Só guarda fatos (respostas, explicações, textos); domínio e indicadores são sempre recalculados. */
export interface Settings { dark: boolean; askConfidence: boolean; showTimer: boolean }
export interface State {
  profile: Profile | null; demo: boolean;
  attempts: Attempt[]; explanations: Explanation[]; essays: Essay[]; essayPractice: EssayPractice[];
  skillReviews: Record<string, SkillReview>; cardStates: Record<string, CardState>; customCards: Flashcard[];
  sessions: SessionRecord[]; pendings: Pending[]; activities: Activity[]; generated: GeneratedQuestion[];
  lessonsSeen: Record<string, number>;
  settings: Settings; params: Params; pseudoId: string; reports: { id: string; target: string; reason: string; ts: number }[];
  account?: { nickname: string; token: string; role: 'student' | 'admin'; syncedAt?: number };
  /** Transitório: há uma questão independente aberta e ainda não respondida. */
  openQuestion: string | null; toast?: { msg: string; ts: number };

  notify: (msg: string) => void;
  createProfile: (p: Profile, demo?: boolean) => void; updateProfile: (p: Partial<Profile>) => void;
  setOpenQuestion: (id: string | null) => void;
  recordAttempt: (a: Omit<Attempt, 'id' | 'skillId' | 'subject'>, q: Question) => Attempt;
  classifyError: (attemptId: string, c: ErrorCategory | undefined) => void;
  recordCpe: (attemptId: string, r: Partial<Record<CpeStepId, 'demonstrada' | 'dificuldade' | 'pulada'>>) => void;
  markCorrected: (attemptId: string) => void;
  recordExplanation: (x: Omit<Explanation, 'id'>) => Explanation; selfCheckExplanation: (id: string, c: NonNullable<Explanation['selfCheck']>) => void;
  rateCard: (id: string, r: CardRating) => void; addCard: (c: Flashcard) => void;
  saveDraft: (themeId: string, text: string) => void; saveVersion: (themeId: string, v: EssayVersion) => void; addEssayPractice: (p: Omit<EssayPractice, 'id' | 'ts'>) => void;
  startSession: (p: SessionPlan) => string; advanceSession: (id: string, outcome: SessionRecord['log'][number]['outcome'], ref?: string) => void; gotoSessionStep: (id: string, idx: number) => void; abandonSession: (id: string) => void;
  setPending: (p: SessionPlan, status: Pending['status'], days: number) => void; clearPending: (key: string) => void;
  startActivity: (a: Pick<Activity, 'kind' | 'title' | 'qids' | 'limitSec'>) => string; answerActivity: (id: string, qid: string, ans: Activity['answers'][string]) => void; moveActivity: (id: string, idx: number) => void; pauseActivity: (id: string) => void; resumeActivity: (id: string) => void; finishActivity: (id: string) => void; deferQuestion: (id: string) => void; discardActivity: (id: string) => void;
  addGenerated: (g: GeneratedQuestion) => void; seeLesson: (id: string) => void;
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void; setParam: <K extends keyof Params>(k: K, v: Params[K]) => void; resetParams: () => void;
  report: (target: string, reason: string) => void; setAccount: (a: State['account']) => void; hydrate: (data: Partial<State>) => void; logout: () => void; deleteAll: () => void;
}

const DAY = 86400000;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const empty = () => ({
  profile: null as Profile | null, demo: false, attempts: [] as Attempt[], explanations: [] as Explanation[], essays: [] as Essay[], essayPractice: [] as EssayPractice[],
  skillReviews: {} as Record<string, SkillReview>, cardStates: {} as Record<string, CardState>, customCards: [] as Flashcard[],
  sessions: [] as SessionRecord[], pendings: [] as Pending[], activities: [] as Activity[], generated: [] as GeneratedQuestion[], lessonsSeen: {} as Record<string, number>,
  pseudoId: uid('u'), reports: [] as State['reports'], account: undefined as State['account'], openQuestion: null as string | null,
});
export const STORE_KEY = 'nexo-v3';

export const useStore = create<State>()(persist((set, get) => {
  const daysLeft = () => studyPhase(get().profile).daysLeft;
  const patchActivity = (id: string, f: (a: Activity) => Activity) => set({ activities: get().activities.map((a) => (a.id === id ? f(a) : a)) });
  const patchAttempt = (id: string, p: Partial<Attempt>) => set({ attempts: get().attempts.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  return {
    ...empty(), settings: { dark: false, askConfidence: true, showTimer: false }, params: { ...DEFAULT_PARAMS },
    notify: (msg) => set({ toast: { msg, ts: Date.now() } }),
    createProfile: (profile, demo = false) => set({ ...empty(), profile, demo }),
    updateProfile: (p) => { const cur = get().profile; if (cur) set({ profile: { ...cur, ...p } }); },
    setOpenQuestion: (id) => set({ openQuestion: id }),
    recordAttempt: (a, q) => {
      const attempt: Attempt = { ...a, id: uid('a'), skillId: q.skillId, subject: q.subject };
      const out = outcomeOfAttempt(attempt);
      const skillReviews = out ? { ...get().skillReviews, [q.skillId]: scheduleSkill(get().skillReviews[q.skillId], q.skillId, out, attempt.ts, get().params, daysLeft()) } : get().skillReviews;
      set({ attempts: [...get().attempts, attempt], skillReviews });
      return attempt;
    },
    classifyError: (id, c) => patchAttempt(id, { selfCategory: c }),
    recordCpe: (id, r) => patchAttempt(id, { cpe: { ...get().attempts.find((a) => a.id === id)?.cpe, ...r } }),
    markCorrected: (id) => patchAttempt(id, { corrected: true }),
    recordExplanation: (x) => {
      const rec: Explanation = { ...x, id: uid('x') }; const out = outcomeOfExplanation(rec);
      set({ explanations: [...get().explanations, rec], skillReviews: out ? { ...get().skillReviews, [x.skillId]: scheduleSkill(get().skillReviews[x.skillId], x.skillId, out, x.ts, get().params, daysLeft()) } : get().skillReviews });
      return rec;
    },
    selfCheckExplanation: (id, c) => set({ explanations: get().explanations.map((e) => (e.id === id ? { ...e, selfCheck: c } : e)) }),
    rateCard: (id, r) => set({ cardStates: { ...get().cardStates, [id]: fsrsReview(get().cardStates[id], r, Date.now(), get().params.retencaoAlvoFsrs) } }),
    addCard: (c) => { if (!get().customCards.some((x) => x.id === c.id || x.front === c.front)) set({ customCards: [...get().customCards, c] }); },
    saveDraft: (themeId, text) => { const es = get().essays; set({ essays: es.some((e) => e.themeId === themeId) ? es.map((e) => (e.themeId === themeId ? { ...e, draft: text } : e)) : [...es, { id: uid('e'), themeId, versions: [], draft: text }] }); },
    saveVersion: (themeId, v) => { const es = get().essays; set({ essays: es.some((e) => e.themeId === themeId) ? es.map((e) => (e.themeId === themeId ? { ...e, versions: [...e.versions, v], draft: v.text } : e)) : [...es, { id: uid('e'), themeId, versions: [v], draft: v.text }] }); },
    addEssayPractice: (p) => set({ essayPractice: [...get().essayPractice, { ...p, id: uid('p'), ts: Date.now() }] }),

    startSession: (p) => {
      const cur = get().sessions.find((s) => s.key === p.key && s.status === 'andamento'); if (cur) return cur.id;
      const { priority: _p, ...plan } = p; const rec: SessionRecord = { ...plan, id: uid('s'), idx: 0, status: 'andamento', startedAt: Date.now(), log: [] };
      set({ sessions: [...get().sessions, rec], pendings: get().pendings.filter((x) => x.key !== p.key) });
      return rec.id;
    },
    advanceSession: (id, outcome, ref) => set({ sessions: get().sessions.map((s) => { if (s.id !== id) return s; const idx = s.idx + 1; const fin = idx >= s.steps.length; return { ...s, idx, log: [...s.log, { idx: s.idx, ts: Date.now(), outcome, ref }], status: fin ? 'concluida' : s.status, finishedAt: fin ? Date.now() : s.finishedAt }; }) }),
    gotoSessionStep: (id, idx) => set({ sessions: get().sessions.map((s) => (s.id === id ? { ...s, idx: Math.max(0, Math.min(idx, s.steps.length - 1)) } : s)) }),
    abandonSession: (id) => set({ sessions: get().sessions.map((s) => (s.id === id ? { ...s, status: 'abandonada', finishedAt: Date.now() } : s)) }),
    setPending: (p, status, days) => set({ pendings: [...get().pendings.filter((x) => x.key !== p.key), { key: p.key, type: p.type, title: p.title, skillIds: p.skillIds, status, createdAt: Date.now(), until: Date.now() + days * DAY, reason: p.reason }] }),
    clearPending: (key) => set({ pendings: get().pendings.filter((x) => x.key !== key) }),

    startActivity: (a) => { const id = uid('t'); set({ activities: [...get().activities, { ...a, id, idx: 0, answers: {}, status: 'andamento', startedAt: Date.now() }] }); return id; },
    answerActivity: (id, qid, ans) => patchActivity(id, (a) => ({ ...a, answers: { ...a.answers, [qid]: ans } })),
    moveActivity: (id, idx) => patchActivity(id, (a) => ({ ...a, idx: Math.max(0, Math.min(idx, a.qids.length - 1)) })),
    pauseActivity: (id) => patchActivity(id, (a) => ({ ...a, status: 'pausada' })),
    resumeActivity: (id) => patchActivity(id, (a) => ({ ...a, status: 'andamento' })),
    deferQuestion: (id) => patchActivity(id, (a) => ({ ...a, qids: [...a.qids.slice(0, a.idx), ...a.qids.slice(a.idx + 1), a.qids[a.idx]] })),
    /** Só ao concluir as respostas viram evidência: antes disso não há correção nem efeito no perfil. */
    finishActivity: (id) => {
      const act = get().activities.find((a) => a.id === id); if (!act || act.status === 'concluida') return;
      const ids: string[] = [];
      act.qids.forEach((qid, i) => {
        const ans = act.answers[qid]; const q = getQuestion(qid); if (!ans || !q) return;
        const alt = q.alternatives?.find((x) => x.letter === ans.chosen); const correct = isCorrect(q, ans.chosen);
        const at = get().recordAttempt({ qid, chosen: ans.chosen, correct, confidence: ans.confidence, ts: Date.now() + i, mode: act.kind === 'bateria' ? 'bateria' : act.kind === 'simulado' ? 'simulado' : 'diagnostico', timeSec: ans.timeSec, errorType: correct ? undefined : alt?.errorType }, q);
        ids.push(at.id);
      });
      patchActivity(id, (a) => ({ ...a, status: 'concluida', finishedAt: Date.now(), attemptIds: ids }));
    },
    discardActivity: (id) => set({ activities: get().activities.filter((a) => a.id !== id) }),

    addGenerated: (g) => set({ generated: [g, ...get().generated.filter((x) => x.q.id !== g.q.id)].slice(0, 200) }),
    seeLesson: (id) => set({ lessonsSeen: { ...get().lessonsSeen, [id]: Date.now() } }),
    setSetting: (k, v) => set({ settings: { ...get().settings, [k]: v } }),
    setParam: (k, v) => set({ params: { ...get().params, [k]: v } }), resetParams: () => set({ params: { ...DEFAULT_PARAMS } }),
    report: (target, reason) => set({ reports: [...get().reports, { id: uid('rp'), target, reason, ts: Date.now() }] }),
    setAccount: (account) => set({ account }),
    hydrate: (data) => { if (!data || typeof data !== 'object') return; const { toast: _t, account: _a, openQuestion: _o, ...rest } = data; set({ ...rest, params: { ...DEFAULT_PARAMS, ...rest.params } }); },
    logout: () => set({ ...empty() }),
    deleteAll: () => { try { localStorage.removeItem(STORE_KEY); ['nexo-v2', 'nexo-sims'].forEach((k) => localStorage.removeItem(k)); } catch { /* armazenamento indisponível */ } set({ ...empty() }); },
  };
}, {
  name: STORE_KEY,
  partialize: (s) => { const { toast: _t, openQuestion: _o, ...rest } = s; return rest as State; },
  merge: (persisted, current) => { const p = (persisted ?? {}) as Partial<State>; return { ...current, ...p, settings: { ...current.settings, ...p.settings }, params: { ...DEFAULT_PARAMS, ...p.params } }; },
}));

export const isCorrect = (q: Question, chosen: string) => q.type === 'aberta' ? Math.abs(+chosen.replace(',', '.') - q.openAnswer!.value) <= (q.openAnswer!.tolerance ?? 1e-6) : !!q.alternatives?.find((a) => a.letter === chosen)?.correct;
export function getQuestion(id: string): Question | undefined { return QUESTIONS.find((q) => q.id === id) ?? useStore.getState().generated.find((g) => g.q.id === id)?.q; }

/** Regra obrigatória: a IA fica indisponível durante resolução independente. */
export interface AiLock { locked: boolean; reason?: string; activity?: Activity }
export function aiLock(s: Pick<State, 'activities' | 'openQuestion'>): AiLock {
  const activity = s.activities.find((a) => a.status === 'andamento');
  if (activity) return { locked: true, activity, reason: `Você está em ${activity.kind === 'simulado' ? 'um simulado' : activity.kind === 'bateria' ? 'uma bateria de exercícios' : 'uma avaliação diagnóstica'}. A IA volta na correção.` };
  if (s.openQuestion) return { locked: true, reason: s.openQuestion.startsWith('x:') ? 'Há uma explicação ativa em andamento. A IA volta depois do envio.' : 'Há uma questão em resolução independente. A IA volta na correção.' };
  return { locked: false };
}
export const useAiLock = () => { const activities = useStore((s) => s.activities); const openQuestion = useStore((s) => s.openQuestion); return aiLock({ activities, openQuestion }); };
