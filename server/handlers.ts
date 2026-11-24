import { appendFileSync, mkdirSync } from 'node:fs';
import type { LLMProvider } from './providers';
import { ProviderError } from './providers';
import { DiagnoseSchema, EssaySchema, ExplainSchema, QuestionSchema, TutorReplySchema } from './schemas';
import { pseudonymize, scrub } from './privacy';
import { check, record, type Kind } from './usage';

/**
 * Handlers puros (testáveis com MockProvider). Cada resposta informa o motor usado, `demo: false`,
 * consumo e custo estimado. Erros voltam estruturados para que o front-end caia no modo demonstrativo identificado.
 */
export interface HandlerResult { status: number; body: unknown }
const TUTOR_POLICY = `Você é o Professor de IA do NEXO, para estudantes brasileiros que se preparam para o ENEM.
Princípios: identifique o que faltou no raciocínio do estudante em vez de apenas dar a resposta. Faça no máximo UMA pergunta orientadora por vez.
Adapte a profundidade ao nível informado (iniciante, intermediario, avancado). Explique diretamente quando pedirem; use perguntas só quando ajudarem.
Considere o histórico da conversa; não repita perguntas já respondidas corretamente; aponte contradições com gentileza.
Se o estudante pedir a resposta direta, dê-a de forma clara e breve. Não transforme dúvidas simples em textos longos (máximo ~120 palavras).
Nunca invente fatos, fórmulas, referências ou gabaritos. Se não tiver segurança, diga isso e marque uncertain=true.
Use o gabarito fornecido pela plataforma como verdade; não o contradiga. Responda em português do Brasil.`;
const ESSAY_POLICY = `Você avalia redações dissertativo-argumentativas no modelo das cinco competências do ENEM (C1 a C5), de forma FORMATIVA.
Para cada competência: nota estimada (0, 40, 80, 120, 160 ou 200), justificativa específica, trechos copiados LITERALMENTE do texto que sustentam a avaliação,
problemas concretos, sugestões objetivas e, se pertinente, um exercício de reescrita. Não invente erros: todo problema deve corresponder a um trecho real.
Não reescreva a redação pelo estudante; preserve sua autoria e estilo. Não afirme que a nota é oficial. Responda em português do Brasil.`;
const QUESTION_POLICY = `Você cria UMA questão objetiva ORIGINAL, no estilo indicado, com cinco alternativas (A–E), exatamente uma correta, distratores plausíveis
ligados a erros típicos, contexto, explicação e método rápido. Não copie questões de provas nem atribua autoria ou fonte. Confira cálculos e unidades.`;

function log(entry: Record<string, unknown>) {
  try { mkdirSync('server/data', { recursive: true }); appendFileSync('server/data/ai-interventions.jsonl', JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n'); } catch { /* logging nunca derruba a requisição */ }
}
function fail(e: unknown): HandlerResult {
  if (e instanceof ProviderError) return { status: e.code === 'not_configured' ? 503 : e.code === 'rate_limited' ? 429 : e.code === 'refusal' ? 422 : 502, body: { error: e.code, message: e.message, retryable: e.retryable } };
  return { status: 500, body: { error: 'internal', message: 'Erro interno.', retryable: false } };
}
function gate(user: string, kind: Kind): HandlerResult | null { const c = check(user, kind); return c.ok ? null : { status: 429, body: { error: 'limit', message: c.reason, retryable: false } }; }

export async function tutorHandler(p: LLMProvider, body: any): Promise<HandlerResult> {
  const user = pseudonymize(String(body?.userId ?? '')); const g = gate(user, 'tutor'); if (g) return g;
  const message = scrub(String(body?.message ?? '')).slice(0, 2000);
  if (!message.trim()) return { status: 400, body: { error: 'bad_request', message: 'Mensagem vazia.' } };
  const history = (Array.isArray(body?.history) ? body.history : []).slice(-10).map((h: any) => `${h.role === 'user' ? 'Estudante' : 'Tutor'}: ${scrub(String(h.text)).slice(0, 800)}`).join('\n');
  const q = body?.question;
  const ctx = q ? `Questão: ${scrub(q.context ?? '')}\n${scrub(q.statement ?? '')}\nAlternativas: ${(q.alternatives ?? []).map((a: any) => `${a.letter}) ${a.text}`).join(' | ')}\nGabarito (oficial da plataforma): ${q.correct ?? 'não informado'}\nResposta do estudante: ${q.chosen ?? '—'}` : 'Sem questão em contexto.';
  try {
    const r = await p.structured({ system: TUTOR_POLICY, user: `Modo: ${body?.mode ?? 'socratico'}\nNível demonstrado: ${['iniciante', 'intermediario', 'avancado'].includes(body?.level) ? body.level : 'não informado'}\n${ctx}\n\nConversa até agora:\n${history || '(início)'}\n\nNova mensagem do estudante: ${message}`, schema: TutorReplySchema, maxTokens: 1500, effort: 'low' });
    const cost = record(user, 'tutor', r.model, r.usage);
    log({ kind: 'tutor', user, mode: body?.mode, situation: body?.situation, understood: r.data.student_understood, uncertain: r.data.uncertain, model: r.model, usage: r.usage, usd: cost.usd });
    return { status: 200, body: { data: r.data, engine: `${p.name}:${r.model}`, demo: false, usage: r.usage, costUsd: cost.usd } };
  } catch (e) { log({ kind: 'tutor', user, error: (e as Error).message }); return fail(e); }
}

export async function essayHandler(p: LLMProvider, body: any): Promise<HandlerResult> {
  const user = pseudonymize(String(body?.userId ?? '')); const g = gate(user, 'essay'); if (g) return g;
  const text = scrub(String(body?.text ?? '')).slice(0, 12000);
  if (text.split(/\s+/).length < 60) return { status: 400, body: { error: 'bad_request', message: 'Texto muito curto para avaliação.' } };
  try {
    const r = await p.structured({ system: ESSAY_POLICY, user: `Tema: ${scrub(String(body?.theme?.title ?? ''))}\n\nRedação do estudante:\n"""\n${text}\n"""`, schema: EssaySchema, maxTokens: 6000, effort: 'medium' });
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
    const flat = norm(text);
    const comps = ['C1', 'C2', 'C3', 'C4', 'C5'].map((id) => {
      const c = r.data.competencies.find((x) => x.id === id);
      if (!c) return { id, score: 0, justification: 'Competência não avaliada pelo modelo.', quotes: [], problems: [], suggestions: [], exercise: null, unsupported: true };
      const quotes = c.quotes.filter((q) => q.trim().length > 3 && flat.includes(norm(q)));      // descarta trechos inventados
      const score = Math.max(0, Math.min(200, Math.round(c.score / 40) * 40));
      return { ...c, score, quotes, droppedQuotes: c.quotes.length - quotes.length, unsupported: score < 200 && quotes.length === 0 };
    });
    const cost = record(user, 'essay', r.model, r.usage);
    log({ kind: 'essay', user, total: comps.reduce((s, c) => s + c.score, 0), dropped: comps.reduce((s, c: any) => s + (c.droppedQuotes ?? 0), 0), model: r.model, usage: r.usage, usd: cost.usd });
    return { status: 200, body: { data: { competencies: comps, total: comps.reduce((s, c) => s + c.score, 0), general_comment: r.data.general_comment }, engine: `${p.name}:${r.model}`, demo: false, usage: r.usage, costUsd: cost.usd } };
  } catch (e) { log({ kind: 'essay', user, error: (e as Error).message }); return fail(e); }
}

export async function questionHandler(p: LLMProvider, body: any): Promise<HandlerResult> {
  const user = pseudonymize(String(body?.userId ?? '')); const g = gate(user, 'questions'); if (g) return g;
  try {
    const r = await p.structured({ system: QUESTION_POLICY, user: `Habilidade: ${scrub(String(body?.skillName ?? ''))}\nDificuldade: ${body?.difficulty ?? 'Média'}\nEstilo: ENEM\nPedido do estudante: ${scrub(String(body?.request ?? '')).slice(0, 500)}`, schema: QuestionSchema, maxTokens: 3000, effort: 'medium' });
    const alts = r.data.alternatives;
    const problems: string[] = [];
    if (alts.length !== 5) problems.push('Número de alternativas diferente de 5.');
    if (alts.filter((a) => a.correct).length !== 1) problems.push('Não há exatamente uma alternativa correta.');
    if (new Set(alts.map((a) => a.text.trim().toLowerCase())).size !== alts.length) problems.push('Alternativas repetidas.');
    if (r.data.context.length < 40) problems.push('Contexto insuficiente.');
    const cost = record(user, 'questions', r.model, r.usage);
    log({ kind: 'questions', user, problems, model: r.model, usage: r.usage, usd: cost.usd });
    // Questões de IA nunca entram como "aprovadas": vão para revisão humana (ou são rejeitadas se inconsistentes).
    return { status: 200, body: { data: r.data, validation: problems, status: problems.length ? 'rejeitada' : 'revisao', engine: `${p.name}:${r.model}`, demo: false, usage: r.usage, costUsd: cost.usd } };
  } catch (e) { log({ kind: 'questions', user, error: (e as Error).message }); return fail(e); }
}

/** Registro de intervenções pedagógicas (pseudonimizado) para avaliação pedagógica posterior. */
export function interventionLogHandler(body: any): HandlerResult {
  const e = body?.entry ?? {};
  log({ kind: 'intervention', user: pseudonymize(String(body?.userId ?? '')), qid: e.qid, skillId: e.skillId, situation: e.situation, intervention: e.intervention, outcome: e.outcome, confidence: e.confidence, engine: e.engine });
  return { status: 204, body: null };
}

export function healthHandler(p: LLMProvider): HandlerResult {
  return { status: 200, body: { configured: p.configured, provider: p.name, model: p.configured ? p.model : null } };
}

const DIAGNOSE_POLICY = `Você interpreta a JUSTIFICATIVA de um estudante que errou uma questão e indica a causa mais provável do erro, entre:
conceitual, interpretacao, calculo, formula, unidade, atencao, esquecimento, confusao_alternativas, lacuna_prerequisito, indeterminada.
Baseie-se apenas no texto do estudante. Se a justificativa não permitir concluir, responda "indeterminada". Cite literalmente o trecho que sustenta a conclusão.
Sua resposta é apenas uma evidência para um motor pedagógico determinístico; ela não decide sozinha o progresso do aluno.`;
export async function diagnoseHandler(p: LLMProvider, body: any): Promise<HandlerResult> {
  const user = pseudonymize(String(body?.userId ?? '')); const g = gate(user, 'tutor'); if (g) return g;
  const just = scrub(String(body?.justification ?? '')).slice(0, 800);
  if (just.trim().length < 6) return { status: 400, body: { error: 'bad_request', message: 'Justificativa curta demais.' } };
  try {
    const r = await p.structured({ system: DIAGNOSE_POLICY, user: `Questão: ${scrub(String(body?.statement ?? '')).slice(0, 800)}\nAlternativa escolhida: ${String(body?.chosen ?? '')}\nGabarito: ${String(body?.correct ?? '')}\nJustificativa do estudante: "${just}"`, schema: DiagnoseSchema, maxTokens: 600, effort: 'low' });
    const quote = r.data.quote && just.toLowerCase().includes(r.data.quote.toLowerCase()) ? r.data.quote : null;   // descarta citação inventada
    const cost = record(user, 'tutor', r.model, r.usage);
    log({ kind: 'diagnose', user, cause: r.data.cause, model: r.model, usage: r.usage, usd: cost.usd });
    return { status: 200, body: { data: { ...r.data, quote, confidence: quote ? Math.min(1, r.data.confidence) : Math.min(0.5, r.data.confidence) }, engine: `${p.name}:${r.model}`, demo: false } };
  } catch (e) { return fail(e); }
}

const EXPLAIN_POLICY = `Você avalia uma EXPLICAÇÃO escrita por um estudante, com base em uma rubrica. Pontue cada critério com 0, 1 ou 2:
correcao (ausência de erro científico), completude (ideias da rubrica presentes, com qualquer formulação equivalente), coerencia (frases que explicam, encadeadas),
relacoes (ligações causais ou comparativas explícitas) e autonomia (formulação própria, não lista de termos nem cópia). Palavras-chave soltas não bastam.
Aponte erros apenas com trecho LITERAL do estudante. Não dê nota final nem decida domínio: outro sistema decide. Responda em português do Brasil.`;
/** Interpretação de explicação ativa: a IA só pontua critérios; erros sem trecho literal são descartados. */
export async function explainHandler(p: LLMProvider, body: any): Promise<HandlerResult> {
  const user = pseudonymize(String(body?.userId ?? '')); const g = gate(user, 'tutor'); if (g) return g;
  const text = scrub(String(body?.text ?? '')).slice(0, 4000);
  if (text.split(/\s+/).filter(Boolean).length < 5) return { status: 400, body: { error: 'bad_request', message: 'Explicação curta demais.' } };
  try {
    const rubric = (Array.isArray(body?.rubric) ? body.rubric : []).slice(0, 12).map((x: unknown) => `- ${String(x)}`).join('\n');
    const r = await p.structured({ system: EXPLAIN_POLICY, user: `Pergunta: ${scrub(String(body?.prompt ?? ''))}\nNível: ${String(body?.level ?? '')}\nRubrica:\n${rubric}\nReferência (não exija as mesmas palavras): ${scrub(String(body?.reference ?? ''))}\n\nExplicação do estudante:\n"""\n${text}\n"""`, schema: ExplainSchema, maxTokens: 1500, effort: 'low' });
    const flat = text.replace(/\s+/g, ' ').toLowerCase();
    const errors = r.data.errors.filter((e) => e.quote.trim().length > 3 && flat.includes(e.quote.replace(/\s+/g, ' ').trim().toLowerCase()));
    const clamp = (n: number) => Math.max(0, Math.min(2, Math.round(n)));
    const criteria = (['correcao', 'completude', 'coerencia', 'relacoes', 'autonomia'] as const).map((id) => { const c = r.data.criteria.find((x) => x.id === id); const score = c ? clamp(c.score) : 1; return { id, note: c?.note ?? 'Não avaliado.', score: id === 'correcao' && score === 0 && !errors.length ? 1 : score }; });
    const cost = record(user, 'tutor', r.model, r.usage);
    log({ kind: 'explain', user, criteria: criteria.map((c) => c.score), model: r.model, usage: r.usage, usd: cost.usd });
    return { status: 200, body: { data: { criteria, found: r.data.found, missing: r.data.missing, errors: errors.map((e) => `“${e.quote}”: ${e.why}`) }, engine: `${p.name}:${r.model}`, demo: false, usage: r.usage, costUsd: cost.usd } };
  } catch (e) { log({ kind: 'explain', user, error: (e as Error).message }); return fail(e); }
}
