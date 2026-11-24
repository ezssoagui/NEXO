import type { CriterionScore, Explanation, ExplainLevel, ExplainResult } from '../types';
import { EXPLAIN_TASKS, tasksForSkill, type ExplainTask, type Prop } from '../data/explainTasks';

/**
 * AVALIAÇÃO DE EXPLICAÇÃO ATIVA (modo demonstrativo por regras).
 * Cinco critérios: correção científica, completude, coerência, relações conceituais e autonomia.
 * Avalia proposições dentro da mesma frase, detecta concepções incorretas, listas de palavras sem frase e cópia do enunciado.
 * Quando as regras não conseguem concluir, o resultado é "inconclusiva" — não conta nem a favor nem contra.
 */
export const EXPLAIN_ENGINE = 'Avaliador por regras do NEXO (demonstração, sem IA)';
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const sentences = (t: string) => t.split(/(?<=[.!?;])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 2);
const wordsOf = (t: string) => norm(t).match(/[a-z0-9²]{2,}/g) ?? [];
const CONNECT = /(^|[^a-zà-ú])(porque|pois|j[aá] que|uma vez que|como|logo|portanto|assim|ent[aã]o|por isso|consequentemente|enquanto|mas|por[eé]m|entretanto|no entanto|embora|quando|se|quanto mais|al[eé]m disso|dessa forma|ou seja|isto [eé])([^a-zà-ú]|$)/i;
/** Indícios de oração verbal (texto já sem acentos). */
const VERB = /\b(e|sao|era|foi|ser|esta|estao|tem|ha|existe|depende|aumenta|diminui|cria|gera|produz|muda|varia|permanece|fica|continua|atua|age|retem|reabsorve|responde|significa|mede|indica|representa|dobra|quadruplica|conserva|transforma|torna|faz|pode|precisa|deve|ocorre|acontece|surge|cancela|desloca|acelera|oxida|sofre|acumula|consome|libera|reduz|eleva|protege|compara|usa|garante|defende|admite|leva|ajuda|vai|vem|passa|sai|entra|cresce|cai|sobe|vira|\w{2,}(ando|endo|indo)|\w{3,}(am|em|ou|iu|ava|aria))\b/;
const matchProp = (p: Prop, ss: string[]) => ss.some((s) => p.any.some((group) => group.every((re) => re.test(s))));
const overlap = (a: string[], b: string[]) => { const A = new Set(a); return b.length ? b.filter((w) => A.has(w)).length / b.length : 0; };

export interface ExplainOutcome { result: ExplainResult; criteria: CriterionScore[]; found: string[]; missing: string[]; errors: string[] }
export function evaluateExplanation(task: ExplainTask, text: string, opts: { assisted?: boolean } = {}): ExplainOutcome {
  // Janelas de uma e duas frases: uma ideia pode se completar na frase seguinte.
  const base = sentences(text); const ss = [...base, ...base.slice(1).map((s, i) => `${base[i]} ${s}`)];
  const ws = wordsOf(text); const n = ws.length;
  const ideas = task.ideas.map((p) => ({ p, ok: matchProp(p, ss) })); const rels = task.relations.map((p) => ({ p, ok: matchProp(p, ss) }));
  const errors = task.misconceptions.filter((m) => base.some((s) => m.re.test(s))).map((m) => m.msg);
  const essential = ideas.filter((x) => x.p.essential); const essOk = essential.filter((x) => x.ok).length; const relOk = rels.filter((x) => x.ok).length;
  const promptWords = new Set(wordsOf(task.prompt)); const novelty = n ? ws.filter((w) => !promptWords.has(w)).length / n : 0;
  const separators = text.match(/[,;/]/g)?.length ?? 0;
  const keywordList = n >= 4 && (!base.some((s) => VERB.test(norm(s))) || separators / n > 0.28);
  const copied = overlap(ws, wordsOf(task.reference)) > 0.92;
  const coherent = !keywordList && n >= 12 && (base.length >= 2 || CONNECT.test(text));

  const c = (id: CriterionScore['id'], score: 0 | 1 | 2, note: string): CriterionScore => ({ id, score, note });
  const criteria = [
    c('correcao', errors.length ? 0 : essOk === 0 ? 1 : 2, errors.length ? errors.join(' ') : essOk === 0 ? 'Nenhum erro conhecido, mas as ideias centrais não foram reconhecidas.' : 'Sem contradições conhecidas.'),
    c('completude', essOk === essential.length ? 2 : essOk > 0 ? 1 : 0, `${essOk} de ${essential.length} ideia(s) essencial(is) reconhecida(s).`),
    c('coerencia', coherent ? 2 : n >= 12 && !keywordList ? 1 : 0, keywordList ? 'Parece uma lista de termos: construa frases que expliquem.' : n < 12 ? 'Texto muito curto para uma explicação.' : coherent ? 'Frases encadeadas.' : 'Ligue as ideias com causa, consequência ou comparação.'),
    c('relacoes', relOk === rels.length ? 2 : relOk > 0 || (CONNECT.test(text) && essOk > 0) ? 1 : 0, `${relOk} de ${rels.length} relação(ões) conceitual(is) reconhecida(s).`),
    c('autonomia', opts.assisted || copied ? 0 : novelty < 0.35 ? 1 : 2, opts.assisted ? 'Feita com apoio: não conta como comprovação.' : copied ? 'Texto muito próximo da referência.' : novelty < 0.35 ? 'Quase só retoma o enunciado.' : 'Formulação própria.'),
  ];
  const s = Object.fromEntries(criteria.map((x) => [x.id, x.score])) as Record<CriterionScore['id'], number>;
  let result: ExplainResult;
  if (errors.length || n < 8 || keywordList || copied) result = 'nao_demonstrada';
  else if (s.completude === 2 && s.coerencia === 2 && s.relacoes >= (task.level === 'iniciante' ? 1 : 2) && s.autonomia === 2) result = 'demonstrada';
  else if (s.completude >= 1 && s.coerencia >= 1 && essOk / Math.max(1, essential.length) >= 0.5) result = 'parcial';
  else if (n >= 25 && coherent && s.autonomia > 0) result = 'inconclusiva';   // texto consistente, fora do alcance das regras
  else result = 'nao_demonstrada';
  return { result, criteria, found: [...ideas, ...rels].filter((x) => x.ok).map((x) => x.p.label), missing: [...ideas.filter((x) => x.p.essential), ...rels].filter((x) => !x.ok).map((x) => x.p.label), errors };
}

export const RESULT_LABEL: Record<ExplainResult, string> = { demonstrada: 'Compreensão demonstrada', parcial: 'Compreensão parcial', nao_demonstrada: 'Ainda não demonstrada', inconclusiva: 'Avaliação inconclusiva' };
export const CRITERION_LABEL: Record<CriterionScore['id'], string> = { correcao: 'Correção científica', completude: 'Completude', coerencia: 'Coerência', relacoes: 'Relações conceituais', autonomia: 'Autonomia' };
export const LEVEL_LABEL: Record<ExplainLevel, string> = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' };
const ORDER: ExplainLevel[] = ['iniciante', 'intermediario', 'avancado'];

/** Próxima atividade adequada ao nível: prefere as não demonstradas e evita repetir a mesma no mesmo dia. */
export function pickTask(skillId: string, level: ExplainLevel, done: Explanation[], now = Date.now()): ExplainTask | undefined {
  const tasks = tasksForSkill(skillId);
  const last = (id: string) => Math.max(0, ...done.filter((x) => x.taskId === id).map((x) => x.ts));
  const ok = (id: string) => done.some((x) => x.taskId === id && x.result === 'demonstrada' && !x.assisted);
  const dist = (t: ExplainTask) => Math.abs(ORDER.indexOf(t.level) - ORDER.indexOf(level));
  const recent = (id: string) => Number(now - last(id) < 86400000);
  return [...tasks].sort((a, b) => recent(a.id) - recent(b.id) || Number(ok(a.id)) - Number(ok(b.id)) || dist(a) - dist(b))[0];
}
export const skillsWithTasks = () => [...new Set(EXPLAIN_TASKS.map((t) => t.skillId))];
