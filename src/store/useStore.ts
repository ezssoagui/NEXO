import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Attempt, CardRating, CardState, Essay, EssayVersion, Flashcard, GeneratedQuestion, InterventionLogEntry, MasteryCycle, Profile, Question, Situation, SkillReview, XPEvent } from '../types';
import { PERSONAS } from './seed';
import { schedule, scheduleSkill, setSrsConfig, DEFAULT_SRS, type SrsConfig } from '../engine/srs';
import { skillMastery } from '../engine/mastery';
import { xpForAttempt } from '../engine/gamification';
import { DEFAULT_LIMITS, monthKey, type Plan, type UsageKind } from '../engine/billing';
import { checkConsolidation, recordTwin } from '../engine/cycle';
import { errorTypeForSituation } from '../engine/intervention';
import { QUESTIONS } from '../data/questions';
import { CHALLENGES } from '../data/demo';

export type Role = 'student' | 'admin';
export interface ReviewItemT { id: string; title: string; kind: 'questao' | 'material'; status: 'pendente' | 'aprovado' | 'devolvido'; note?: string; qid?: string }

interface State {
  role: Role; profile: Profile | null; diagnosticDone: boolean;
  attempts: Attempt[]; cardStates: Record<string, CardState>; customCards: Flashcard[];
  essays: Essay[]; xpEvents: XPEvent[]; generated: GeneratedQuestion[];
  cycles: MasteryCycle[]; skillReviews: Record<string, SkillReview>; interventionLog: InterventionLogEntry[];
  teamId?: string; schoolId?: string; challengeProgress: Record<string, number>; joinedChallenges: string[];
  plan: Plan; usage: { month: string; tutor: number; essay: number; gen: number }; limits: typeof DEFAULT_LIMITS; checkoutLog: { ts: number; plan: Plan }[];
  reviewQueue: ReviewItemT[];
  settings: { dark: boolean; rankingOptIn: boolean; publicProfile: boolean; portfolioPublic: boolean; timer: boolean; autonomy: 'mais_autonomia' | 'equilibrado' | 'mais_apoio'; confidencePrompt: 'adaptativo' | 'sempre' | 'nunca'; studyMode: 'adaptativo' | 'livre' };
  srsConfig: SrsConfig; simHistory: { ts: number; pct: number; name: string; correct: number; total: number }[];
  account?: { nickname: string; token: string; role: 'student' | 'admin'; syncedAt?: number };
  reports: { id: string; target: string; reason: string; ts: number }[];
  pseudoId: string;
  toast?: { msg: string; ts: number };
  notify: (msg: string) => void;
  loginPersona: (p: keyof typeof PERSONAS) => void;
  loginRole: (r: Role) => void;
  createProfile: (p: Profile) => void;
  finishDiagnostic: () => void;
  recordAttempt: (a: Omit<Attempt, 'id' | 'skillId' | 'subject'>, q: Question, opts?: { twinLevel?: number }) => { xp: XPEvent[]; attempt: Attempt };
  reclassifyAttempt: (attemptId: string, s: Exclude<Situation, 'AMB'>) => void;
  upsertCycle: (c: MasteryCycle) => void;
  logIntervention: (e: InterventionLogEntry) => void;
  rateCard: (id: string, r: CardRating, opts?: { free?: boolean; difficulty?: number }) => string;
  addCard: (c: Flashcard) => void;
  saveDraft: (themeId: string, text: string) => void;
  saveVersion: (themeId: string, v: EssayVersion) => void;
  addXP: (amount: number, reason: string, key: string) => boolean;
  addGenerated: (g: GeneratedQuestion) => void;
  setGeneratedStatus: (id: string, s: GeneratedQuestion['status']) => void;
  joinTeam: (id: string) => void; setSchool: (id: string) => void;
  joinChallenge: (id: string) => void; progressChallenge: (id: string, n?: number) => void;
  canUse: (k: UsageKind) => boolean; consume: (k: UsageKind) => boolean;
  subscribe: (p: Plan) => void; setLimit: (plan: Plan, k: UsageKind, v: number) => void;
  setSetting: <K extends keyof State['settings']>(k: K, v: State['settings'][K]) => void;
  addRetry: (attemptId: string, chosen: string, correct: boolean) => void;
  updateAttempt: (attemptId: string, patch: Partial<Attempt>) => void;
  setSrs: (c: Partial<SrsConfig>) => void;
  addSim: (r: State['simHistory'][number]) => void;
  setAccount: (a: State['account']) => void;
  hydrate: (data: any) => void;
  reviewDecision: (id: string, s: ReviewItemT['status'], note?: string) => void;
  report: (target: string, reason: string) => void;
  logout: () => void; deleteAll: () => void;
}

const DAY = 86400000;
const newPseudo = () => 'u-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** Estado de um estudante recém-chegado: tudo zerado. */
const empty = () => ({
  role: 'student' as Role, profile: null, diagnosticDone: false, attempts: [], cardStates: {}, customCards: [], essays: [], xpEvents: [], generated: [],
  cycles: [] as MasteryCycle[], skillReviews: {} as Record<string, SkillReview>, interventionLog: [] as InterventionLogEntry[],
  teamId: undefined, schoolId: undefined, challengeProgress: {}, joinedChallenges: [], plan: 'free' as Plan, usage: { month: monthKey(), tutor: 0, essay: 0, gen: 0 }, limits: DEFAULT_LIMITS, checkoutLog: [],
  reviewQueue: [
    { id: 'r1', title: 'Questão gerada: potência de um forno elétrico', kind: 'questao' as const, status: 'pendente' as const },
    { id: 'r2', title: 'Material: "Concentração e pH" (rascunho de IA)', kind: 'material' as const, status: 'pendente' as const },
    { id: 'r3', title: 'Material: "Probabilidade: contando com cuidado" (rascunho de IA)', kind: 'material' as const, status: 'pendente' as const },
  ],
  reports: [], pseudoId: newPseudo(), simHistory: [] as State['simHistory'], account: undefined as State['account'],
});

export const useStore = create<State>()(persist((set, get) => ({
  ...empty(),
  settings: { dark: false, rankingOptIn: true, publicProfile: false, portfolioPublic: false, timer: false, autonomy: 'equilibrado', confidencePrompt: 'adaptativo', studyMode: 'adaptativo' },
  srsConfig: { ...DEFAULT_SRS },
  notify: (msg) => set({ toast: { msg, ts: Date.now() } }),
  loginPersona: (p) => set({ ...empty(), role: 'student', profile: PERSONAS[p].profile, schoolId: PERSONAS[p].profile.schoolId }),
  loginRole: (r) => set({ role: r }),
  createProfile: (p) => set({ ...empty(), profile: { ...p, persona: 'custom' }, schoolId: p.schoolId }),
  finishDiagnostic: () => set({ diagnosticDone: true }),
  recordAttempt: (a, q, opts) => {
    const prev = get().attempts;
    const attempt: Attempt = { ...a, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, skillId: q.skillId, subject: q.subject };
    const before = skillMastery(prev, q.skillId).state;
    const after = skillMastery([...prev, attempt], q.skillId).state;
    const today = new Date(attempt.ts).toDateString();
    const practiceToday = get().xpEvents.filter((e) => new Date(e.ts).toDateString() === today && /^[^:]+:\d+$/.test(e.key)).reduce((s, e) => s + e.amount, 0);
    const xp = xpForAttempt(attempt, prev, before, after, practiceToday);
    const attempts = [...prev, attempt];
    // Revisão adaptativa da habilidade (não alterada por revisão livre).
    const skillReviews = attempt.free ? get().skillReviews : { ...get().skillReviews, [q.skillId]: scheduleSkill(get().skillReviews[q.skillId], attempt).review };
    // Ciclo de domínio: comprovação e consolidação.
    let cycles = get().cycles;
    if (attempt.cycleId && (attempt.isTwin || attempt.isNovel)) cycles = cycles.map((c) => (c.id === attempt.cycleId ? recordTwin(c, attempt, opts?.twinLevel ?? c.twinLevel) : c));
    cycles = cycles.map((c) => (c.skillId === q.skillId ? checkConsolidation(c, attempts) : c));
    set({ attempts, xpEvents: [...get().xpEvents, ...xp], skillReviews, cycles });
    get().joinedChallenges.forEach((cid) => { const c = CHALLENGES.find((x) => x.id === cid); if (c && c.questionIds.includes(q.id) && attempt.correct && attempt.confidence !== 'chute') get().progressChallenge(cid); });
    return { xp, attempt };
  },
  reclassifyAttempt: (id, s) => set({ attempts: get().attempts.map((a) => (a.id === id ? { ...a, situation: s, reclassified: true, errorType: errorTypeForSituation(s) ?? a.errorType, evidence: s === 'C' ? 'erro_interpretativo' : s === 'D' ? 'erro_conceitual' : s === 'E' ? 'erro_procedimental' : 'erro_desatencao' } : a)) }),
  upsertCycle: (c) => { const cs = get().cycles; set({ cycles: cs.some((x) => x.id === c.id) ? cs.map((x) => (x.id === c.id ? c : x)) : [...cs, c] }); },
  logIntervention: (e) => set({ interventionLog: [...get().interventionLog.slice(-499), e] }),
  rateCard: (id, r, opts) => {
    const { state, explanation } = schedule(get().cardStates[id], r, Date.now(), { free: opts?.free, difficulty: opts?.difficulty });
    set({ cardStates: { ...get().cardStates, [id]: state } });
    if (!opts?.free && get().joinedChallenges.includes('c4')) get().progressChallenge('c4');
    if (!opts?.free) get().addXP(2, 'Revisão concluída', `rev-${id}-${new Date().toDateString()}`); // 1x por cartão por dia (antifraude)
    return explanation;
  },
  addCard: (c) => { if (get().customCards.some((x) => x.front === c.front)) return; set({ customCards: [...get().customCards, c] }); },
  saveDraft: (themeId, text) => { const es = [...get().essays]; const i = es.findIndex((e) => e.themeId === themeId); if (i >= 0) es[i] = { ...es[i], draft: text }; else es.push({ id: `e-${Date.now()}`, themeId, versions: [], draft: text }); set({ essays: es }); },
  saveVersion: (themeId, v) => { const es = [...get().essays]; const i = es.findIndex((e) => e.themeId === themeId); if (i >= 0) es[i] = { ...es[i], versions: [...es[i].versions, v], draft: v.text }; else es.push({ id: `e-${Date.now()}`, themeId, versions: [v], draft: v.text }); set({ essays: es }); },
  addXP: (amount, reason, key) => { if (get().xpEvents.some((e) => e.key === key)) return false; set({ xpEvents: [...get().xpEvents, { ts: Date.now(), amount, reason, key }] }); return true; },
  addGenerated: (g) => set({ generated: [g, ...get().generated.filter((x) => x.q.id !== g.q.id)] }),
  setGeneratedStatus: (id, s) => set({ generated: get().generated.map((g) => (g.q.id === id ? { ...g, status: s } : g)) }),
  joinTeam: (id) => set({ teamId: id }), setSchool: (id) => set({ schoolId: id }),
  joinChallenge: (id) => set({ joinedChallenges: [...new Set([...get().joinedChallenges, id])] }),
  progressChallenge: (id, n = 1) => set({ challengeProgress: { ...get().challengeProgress, [id]: (get().challengeProgress[id] ?? 0) + n } }),
  canUse: (k) => { const u = get().usage.month === monthKey() ? get().usage : { month: monthKey(), tutor: 0, essay: 0, gen: 0 }; return u[k] < get().limits[get().plan][k]; },
  consume: (k) => { if (!get().canUse(k)) return false; const u = get().usage.month === monthKey() ? get().usage : { month: monthKey(), tutor: 0, essay: 0, gen: 0 }; set({ usage: { ...u, [k]: u[k] + 1 } }); return true; },
  subscribe: (p) => set({ plan: p, checkoutLog: [...get().checkoutLog, { ts: Date.now(), plan: p }] }),
  setLimit: (plan, k, v) => set({ limits: { ...get().limits, [plan]: { ...get().limits[plan], [k]: v } } }),
  setSetting: (k, v) => set({ settings: { ...get().settings, [k]: v } }),
  addRetry: (id, chosen, correct) => set({ attempts: get().attempts.map((a) => (a.id === id ? { ...a, retries: [...(a.retries ?? []), { chosen, correct, ts: Date.now() }] } : a)) }),
  updateAttempt: (id, patch) => set({ attempts: get().attempts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }),
  setSrs: (c) => { const cfg = { ...get().srsConfig, ...c }; setSrsConfig(cfg); set({ srsConfig: cfg }); },
  addSim: (r) => set({ simHistory: [...get().simHistory.filter((x) => x.ts !== r.ts), r] }),
  setAccount: (a) => set({ account: a }),
  hydrate: (data) => { if (!data || typeof data !== 'object') return; const { toast, account, ...rest } = data; set({ ...rest }); if (rest.srsConfig) setSrsConfig(rest.srsConfig); },
  reviewDecision: (id, s, note) => set({ reviewQueue: get().reviewQueue.map((r) => (r.id === id ? { ...r, status: s, note } : r)) }),
  report: (target, reason) => set({ reports: [...get().reports, { id: `rp${Date.now()}`, target, reason, ts: Date.now() }] }),
  logout: () => set({ ...empty(), settings: get().settings }),
  deleteAll: () => { localStorage.removeItem('nexo-v2'); localStorage.removeItem('nexo-sims'); set({ ...empty() }); },
}), { name: 'nexo-v2', partialize: (s) => { const { toast, ...rest } = s; return rest as any; }, merge: (persisted: any, current) => ({ ...current, ...persisted, settings: { ...current.settings, ...(persisted?.settings ?? {}) } }), onRehydrateStorage: () => (st) => { if (st?.srsConfig) setSrsConfig(st.srsConfig); } }));

export function getQuestion(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id) ?? useStore.getState().generated.find((g) => g.q.id === id)?.q;
}
export const DAY_MS = DAY;
