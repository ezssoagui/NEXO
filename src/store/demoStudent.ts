// Histórico FICTÍCIO (3 semanas) para que todo perfil já comece com dados nas telas.
// Gerado de forma determinística a partir do próprio perfil.
import { useStore } from './useStore';
import { QUESTIONS } from '../data/questions';
import { SUBJECTS } from '../data/skills';
import { TEAMS } from '../data/demo';
import { FLASHCARDS } from '../data/flashcards';
import { ESSAY_THEMES, DEMO_ESSAYS } from '../data/essays';
import { evaluateEssay } from '../engine/essay';
import { schedule } from '../engine/srs';
import type { CardRating, CardState, Confidence, ErrorCause, Profile, Subject } from '../types';

const DAY = 86400000;

export const DEMO_STUDENT: Profile = {
  nickname: 'Marina', grade: '3º ano do ensino médio', schoolType: 'publica', schoolId: 's2', institution: 'EEEFM Vale Verde (fictícia)',
  goal: 'ENEM', course: 'Medicina', difficulties: ['Física', 'Matemática'], weeklyHours: 12, examYear: 2026,
  personalGoal: 'Passar de 750 pontos no ENEM', persona: 'custom',
};

/** Probabilidade de acerto por disciplina: Marina tem valores próprios; os demais saem das dificuldades declaradas. */
const MARINA_SKILL: Record<Subject, number> = { Biologia: 0.85, Linguagens: 0.8, Humanas: 0.75, Química: 0.65, Matemática: 0.55, Física: 0.4 };
const LEVEL: Record<NonNullable<Profile['persona']>, number> = { iniciante: 0.62, avancado: 0.82, olimpico: 0.8, custom: 0.7 };
const CAUSES: ErrorCause[] = ['conceitual', 'interpretacao', 'calculo', 'formula', 'atencao', 'unidade'];

/** Gerador pseudoaleatório determinístico (mulberry32). */
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Semente estável por apelido, para cada perfil ter um histórico próprio. */
const seedOf = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 2026);

export function loadDemoStudent() { loadStudentWithHistory(DEMO_STUDENT, { seed: 2026, skill: (s) => MARINA_SKILL[s], teamId: 'tm3' }); }

/** Cria o estudante (substituindo o estado atual) já com histórico fictício. */
export function loadStudentWithHistory(profile: Profile, opts: { seed?: number; skill?: (s: Subject) => number; teamId?: string } = {}) {
  const st = useStore.getState();
  const level = LEVEL[profile.persona ?? 'custom'];
  const skill = opts.skill ?? ((s: Subject) => (profile.difficulties.includes(s) ? level - 0.22 : level));
  const r = rng(opts.seed ?? seedOf(profile.nickname));
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const now = Date.now();
  const start = new Date(now - 21 * DAY); start.setHours(0, 0, 0, 0);

  st.createProfile(profile); // zera o estado
  useStore.setState({ profile, diagnosticDone: true, teamId: opts.teamId ?? TEAMS.find((t) => t.schoolId && t.schoolId === profile.schoolId)?.id });

  // 1) Questões respondidas nas últimas 3 semanas (mais estudo e melhora recente).
  const objective = QUESTIONS.filter((q) => q.type === 'objetiva' && q.alternatives?.length);
  for (let d = 0; d < 21; d++) {
    if (r() < 0.25) continue; // folgas
    const recent = d >= 14;
    const n = 2 + Math.floor(r() * (recent ? 6 : 4));
    for (let i = 0; i < n; i++) {
      const q = pick(objective);
      const ts = start.getTime() + d * DAY + (18 + r() * 4) * 3600000 + i * 240000;
      if (ts > now) continue;
      const p = Math.min(0.95, skill(q.subject) + (recent ? 0.1 : 0));
      const correct = r() < p;
      const right = q.alternatives!.find((a) => a.correct)!;
      const wrongs = q.alternatives!.filter((a) => !a.correct);
      const alt = correct ? right : pick(wrongs);
      const confidence: Confidence = correct ? (r() < 0.75 ? 'certeza' : 'duvida') : pick<Confidence>(['duvida', 'certeza', 'chute']);
      st.recordAttempt({
        qid: q.id, chosen: alt.letter, correct, confidence, hintsUsed: correct ? 0 : Math.floor(r() * 2), ts,
        mode: pick(['pratica', 'sessao', 'sessao', 'tutoria']), timeSec: 40 + Math.floor(r() * 160),
        situation: correct ? (confidence === 'certeza' ? 'A' : 'B') : undefined,
        errorType: correct ? undefined : alt.errorType,
        cause: correct ? undefined : pick(CAUSES),
      }, q);
    }
  }

  // 2) Redações deste mês (uma com duas versões) e uma do mês passado.
  const theme = (id: string) => ESSAY_THEMES.find((t) => t.id === id)!;
  const essay = (id: string) => DEMO_ESSAYS.find((e) => e.id === id)!;
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const inMonth = (daysAgo: number) => Math.max(monthStart.getTime() + 3600000, now - daysAgo * DAY);
  const d1 = essay('d1'), d2 = essay('d2');
  const draftD2 = d2.text.split('\n\n').slice(0, -1).join('\n\n');
  const version = (text: string, themeId: string, ts: number) => ({ text, ts, eval: evaluateEssay(text, theme(themeId)) });
  useStore.setState({
    essays: [
      { id: 'e-demo-1', themeId: d2.themeId, versions: [version(draftD2, d2.themeId, inMonth(9)), version(d2.text, d2.themeId, inMonth(6))], draft: d2.text },
      { id: 'e-demo-2', themeId: d1.themeId, versions: [version(d1.text, d1.themeId, inMonth(2))], draft: d1.text },
      { id: 'e-demo-3', themeId: 't4', versions: [version(d2.text, 't4', monthStart.getTime() - 5 * DAY)], draft: d2.text },
    ],
  });

  // 3) Flashcards revisados (alguns já vencidos para aparecerem como pendentes).
  const cardStates: Record<string, CardState> = {};
  FLASHCARDS.slice(0, 18).forEach((c, i) => {
    let s: CardState | undefined; let t = now - (14 - (i % 7)) * DAY;
    for (let k = 0; k < 1 + (i % 3); k++) { const rating: CardRating = pick(['seguro', 'seguro', 'duvida', 'errei']); s = schedule(s, rating, t).state; t += 3 * DAY; }
    cardStates[c.id] = s!;
  });

  // 4) Simulados.
  const avg = SUBJECTS.reduce((s, x) => s + skill(x), 0) / SUBJECTS.length;
  const names = profile.goal === 'ENEM' ? ['Simulado ENEM — Natureza', 'Simulado ENEM — Matemática', 'Simulado ENEM — Natureza']
    : profile.goal === 'Olimpíadas' ? ['Olimpíadas', 'Simulado rápido', 'Olimpíadas']
    : profile.goal === 'Vestibular' ? ['Vestibular (estilo)', 'Simulado rápido', 'Vestibular (estilo)']
    : ['Simulado ENEM — Natureza', 'Vestibular (estilo)', 'Simulado ENEM — Natureza'];
  const simHistory = names.map((name, i) => {
    const correct = Math.round(20 * Math.min(0.95, avg - 0.1 + i * 0.07));
    return { ts: now - [18, 10, 3][i] * DAY, name, correct, total: 20, pct: correct * 5 };
  });
  useStore.setState({ cardStates, simHistory });
}
