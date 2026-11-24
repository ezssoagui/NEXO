/**
 * SERVIÇO DE IA DO FRONT-END
 * --------------------------
 * - Nenhuma chave existe no navegador: chamadas reais vão para o backend (/api/ai/*), que guarda as credenciais.
 * - Se o backend não estiver configurado, estiver fora do ar ou falhar, o resultado vem do motor DEMONSTRATIVO local,
 *   com `demo: true` e o motivo em `fallbackReason` — nunca apresentado como resposta de IA real.
 * - O provedor pode ser trocado no servidor sem mudar o front-end.
 */
import type { EssayEval, GeneratedQuestion, Difficulty } from '../types';
import type { EssayTheme } from '../data/essays';
import { evaluateEssay, ESSAY_ENGINE } from '../engine/essay';
import { generate } from '../engine/generator';
import { respond, type TutorContext, type TutorState, type TutorReply } from '../engine/tutor';
import type { CriterionScore, Explanation, ExplainResult } from '../types';
import type { ExplainTask } from '../data/explainTasks';
import { evaluateExplanation, EXPLAIN_ENGINE, type ExplainOutcome } from '../engine/explain';
import { skillById } from '../data/skills';

export interface AIResult<T> { data: T; engine: string; demo: boolean; fallbackReason?: string; costUsd?: number }
export interface AIStatus { mode: 'remote' | 'demo'; provider?: string; model?: string; reason?: string; checkedAt: number }

const MODE = (import.meta as any).env?.VITE_AI_MODE ?? 'auto'; // 'auto' | 'demo' | 'remote'
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let status: AIStatus | null = null;

async function fetchJson(url: string, body?: unknown, timeoutMs = 20000, fetchImpl: typeof fetch = fetch) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
    const json = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(json?.message ?? `HTTP ${res.status}`), { code: json?.error ?? 'http_error', status: res.status });
    return json;
  } catch (e: any) { if (e?.name === 'AbortError') throw Object.assign(new Error('Tempo esgotado'), { code: 'timeout' }); throw e; } finally { clearTimeout(t); }
}

export async function getAIStatus(force = false, fetchImpl: typeof fetch = fetch): Promise<AIStatus> {
  if (MODE === 'demo') return (status = { mode: 'demo', reason: 'Modo demonstrativo forçado pela configuração (VITE_AI_MODE=demo).', checkedAt: Date.now() });
  if (status && !force && Date.now() - status.checkedAt < 60000) return status;
  try {
    const h = await fetchJson('/api/ai/health', undefined, 2500, fetchImpl);
    status = h?.configured ? { mode: 'remote', provider: h.provider, model: h.model, checkedAt: Date.now() } : { mode: 'demo', reason: 'Backend de IA ativo, mas sem credenciais configuradas.', checkedAt: Date.now() };
  } catch { status = { mode: 'demo', reason: 'Backend de IA não encontrado (rode `npm run server` com credenciais para usar IA real).', checkedAt: Date.now() }; }
  return status;
}
export const resetAIStatus = () => { status = null; };

const pseudo = () => { try { return JSON.parse(localStorage.getItem('nexo-v3') ?? '{}')?.state?.pseudoId ?? 'anon'; } catch { return 'anon'; } };

/** Executa a chamada remota; em qualquer falha, devolve o resultado demonstrativo com o motivo explícito. */
async function withFallback<T>(remote: () => Promise<AIResult<T>>, demo: () => Promise<AIResult<T>>, fetchImpl: typeof fetch = fetch): Promise<AIResult<T>> {
  const st = await getAIStatus(false, fetchImpl);
  if (st.mode !== 'remote') { const d = await demo(); return { ...d, fallbackReason: st.reason }; }
  try { return await remote(); }
  catch (e: any) {
    const reason = e?.code === 'limit' ? `Limite de uso de IA atingido: ${e.message}` : e?.code === 'timeout' ? 'A IA demorou demais para responder.' : `IA indisponível no momento (${e?.message ?? 'erro'}).`;
    const d = await demo(); return { ...d, fallbackReason: `${reason} Resposta gerada pelo modo demonstrativo.` };
  }
}

/** Regra fixa do motor pedagógico: transforma critérios (0–2) em resultado. */
export function verdictFrom(criteria: CriterionScore[]): ExplainResult {
  const s = Object.fromEntries(criteria.map((c) => [c.id, c.score])) as Record<CriterionScore['id'], number>;
  if (s.correcao === 0 || s.autonomia === 0) return 'nao_demonstrada';
  if (s.correcao === 2 && s.completude === 2 && s.coerencia >= 1 && s.relacoes === 2) return 'demonstrada';
  return s.completude >= 1 && s.coerencia >= 1 ? 'parcial' : 'nao_demonstrada';
}
export type { Explanation };

export const AI = {
  async reply(state: TutorState, message: string, ctx: TutorContext & { history?: { role: string; text: string }[] }, fetchImpl: typeof fetch = fetch): Promise<AIResult<{ reply: TutorReply; state: TutorState }>> {
    const demo = async (): Promise<AIResult<{ reply: TutorReply; state: TutorState }>> => { await delay(350); return { data: respond(state, message, ctx), engine: 'Motor de regras (demonstração, sem IA)', demo: true }; };
    const remote = async (): Promise<AIResult<{ reply: TutorReply; state: TutorState }>> => {
      const q = state.context?.q;
      const r = await fetchJson('/api/ai/tutor', { userId: pseudo(), mode: state.mode, message, history: ctx.history ?? [], level: ctx.levels?.[state.skill ?? ''], question: q ? { context: q.context, statement: q.statement, alternatives: q.alternatives?.map((a) => ({ letter: a.letter, text: a.text })), correct: q.alternatives?.find((a) => a.correct)?.letter, chosen: state.context?.attempt?.chosen } : undefined }, 30000, fetchImpl);
      return { data: { reply: { text: r.data.reply, diagnosis: r.data.diagnosis ?? undefined, uncertain: r.data.uncertain }, state }, engine: `IA real · ${r.engine}`, demo: false, costUsd: r.costUsd };
    };
    return withFallback(remote, demo, fetchImpl);
  },
  async evaluate(text: string, theme: EssayTheme, fetchImpl: typeof fetch = fetch): Promise<AIResult<EssayEval>> {
    const local = evaluateEssay(text, theme);
    const demo = async () => { await delay(700); return { data: local, engine: ESSAY_ENGINE, demo: true }; };
    const remote = async () => {
      const r = await fetchJson('/api/ai/essay', { userId: pseudo(), text, theme: { title: theme.title } }, 60000, fetchImpl);
      // Mantém destaques e estatísticas verificáveis do motor local; usa a avaliação do modelo (já validada no servidor) por competência.
      const competencies = local.competencies.map((c) => { const ai = r.data.competencies.find((x: any) => x.id === c.id); return ai ? { ...c, score: ai.score, justification: ai.justification + (ai.unsupported ? ' (sem trecho verificável — trate com cautela)' : ''), evidence: ai.quotes.map((q: string) => `“${q}”`), problems: ai.problems, suggestions: ai.suggestions, exercise: ai.exercise ?? undefined } : c; });
      return { data: { ...local, competencies, total: competencies.reduce((s, c) => s + c.score, 0), engine: `IA real · ${r.engine}` }, engine: `IA real · ${r.engine}`, demo: false, costUsd: r.costUsd };
    };
    return withFallback(remote, demo, fetchImpl);
  },
  async generate(skillId: string, opts: { difficulty?: Difficulty; injectFault?: boolean; request?: string }, fetchImpl: typeof fetch = fetch): Promise<AIResult<GeneratedQuestion | null>> {
    const demo = async () => { await delay(450); return { data: generate(skillId, opts), engine: 'Gerador paramétrico + validador (demonstração)', demo: true }; };
    if (opts.injectFault) return demo(); // teste do validador é sempre local
    const remote = async () => {
      const r = await fetchJson('/api/ai/questions', { userId: pseudo(), skillName: skillById(skillId)?.name ?? skillId, difficulty: opts.difficulty, request: opts.request }, 45000, fetchImpl);
      const d = r.data; const sk = skillById(skillId)!;
      const g: GeneratedQuestion = {
        q: { id: `IA-${Date.now().toString(36)}`, exam: 'ENEM', style: 'Estilo ENEM (gerada por IA)', subject: sk.subject, area: sk.area, topic: sk.name, skillId, year: new Date().getFullYear(), difficulty: opts.difficulty ?? 'Média', type: 'objetiva', source: 'gerada_ia_demo', context: d.context, statement: d.statement, alternatives: d.alternatives.map((a: any) => ({ letter: a.letter, text: a.text, correct: a.correct || undefined, analysis: a.analysis })), hints: [d.hints[0] ?? '', d.hints[1] ?? '', d.hints[2] ?? d.explanation], explanation: d.explanation, fastMethod: d.fast_method, flashcard: { front: `Revise: ${sk.name}`, back: d.fast_method } },
        validation: [{ check: 'Estrutura (5 alternativas, 1 correta, sem repetição)', ok: !r.validation.length, detail: r.validation.join(' ') || 'OK' }, { check: 'Revisão humana', ok: false, detail: 'Questões geradas por IA aguardam revisão antes de entrar no banco oficial.' }],
        status: r.status, request: opts.request ?? sk.name, ts: Date.now(),
      };
      return { data: g, engine: `IA real · ${r.engine}`, demo: false, costUsd: r.costUsd };
    };
    return withFallback(remote, demo, fetchImpl);
  },
  /**
   * Avalia uma explicação ativa. A IA (se conectada) interpreta critério a critério; o RESULTADO é decidido por regra fixa
   * (verdictFrom), nunca pela IA. Sem IA, usa o avaliador por regras, identificado.
   */
  async explain(task: ExplainTask, text: string, opts: { assisted?: boolean } = {}, fetchImpl: typeof fetch = fetch): Promise<AIResult<ExplainOutcome>> {
    const local = evaluateExplanation(task, text, opts);
    const demo = async () => { await delay(300); return { data: local, engine: EXPLAIN_ENGINE, demo: true }; };
    const remote = async () => {
      const r = await fetchJson('/api/ai/explain', { userId: pseudo(), prompt: task.prompt, level: task.level, rubric: [...task.ideas, ...task.relations].map((p) => p.label), reference: task.reference, text }, 30000, fetchImpl);
      const criteria: CriterionScore[] = r.data.criteria.map((c: CriterionScore) => (c.id === 'autonomia' && opts.assisted ? { ...c, score: 0, note: 'Feita com apoio: não conta como comprovação.' } : c));
      return { data: { result: verdictFrom(criteria), criteria, found: r.data.found, missing: r.data.missing, errors: r.data.errors }, engine: `IA real · ${r.engine}`, demo: false, costUsd: r.costUsd };
    };
    return withFallback(remote, demo, fetchImpl);
  },
};
export const DemoProvider = AI; // compatibilidade
