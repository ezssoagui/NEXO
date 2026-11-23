// Estudante de demonstração com histórico FICTÍCIO: serve só para visualizar
// como as telas ficam com dados. Tudo é gerado de forma determinística.
import { useStore } from './useStore';
import { QUESTIONS } from '../data/questions';
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

/** Probabilidade de acerto por disciplina (perfil: forte em Biologia/Linguagens, fraca em Física). */
const SKILL: Record<Subject, number> = { Biologia: 0.85, Linguagens: 0.8, Humanas: 0.75, Química: 0.65, Matemática: 0.55, Física: 0.4 } as Record<Subject, number>;
const CAUSES: ErrorCause[] = ['conceitual', 'interpretacao', 'calculo', 'formula', 'atencao', 'unidade'];

/** Gerador pseudoaleatório determinístico (mulberry32). */
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function loadDemoStudent() {
  const st = useStore.getState();
  const r = rng(2026);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const now = Date.now();
  const start = new Date(now - 21 * DAY); start.setHours(0, 0, 0, 0);

  st.loginPersona('iniciante'); // zera o estado
  useStore.setState({ profile: DEMO_STUDENT, schoolId: DEMO_STUDENT.schoolId, diagnosticDone: true, teamId: 'tm3' });

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
      const p = Math.min(0.95, SKILL[q.subject] + (recent ? 0.1 : 0));
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
  const simHistory = [
    { ts: now - 18 * DAY, name: 'Simulado ENEM — Natureza', correct: 11, total: 20, pct: 55 },
    { ts: now - 10 * DAY, name: 'Simulado ENEM — Matemática', correct: 12, total: 20, pct: 60 },
    { ts: now - 3 * DAY, name: 'Simulado ENEM — Natureza', correct: 14, total: 20, pct: 70 },
  ];
  useStore.setState({ cardStates, simHistory });
}
