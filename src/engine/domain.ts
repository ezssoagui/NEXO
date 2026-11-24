import type { Attempt, DimStatus, Dimension, DomainState, Explanation } from '../types';
import { SKILLS, skillById } from '../data/skills';
import { QUESTIONS } from '../data/questions';
import { DEFAULT_PARAMS, type Params } from './params';

/**
 * SISTEMA DE DOMÍNIO — quatro dimensões independentes: resolução, compreensão, transferência e retenção.
 * Não há média ponderada: cada dimensão precisa de evidência própria.
 *  - provisório: resolução + compreensão + transferência;
 *  - consolidado: provisório + retenção ao longo do tempo;
 *  - regressão: novas evidências negativas desfazem uma dimensão (o estado é sempre recalculado do histórico).
 * Respostas assistidas e chutes nunca comprovam. Funções puras e auditáveis.
 */
const DAY = 86400000;
export const STATE_LABEL: Record<DomainState, string> = { nao_avaliado: 'Não avaliado', em_aprendizagem: 'Em aprendizagem', provisorio: 'Domínio provisório', consolidado: 'Domínio consolidado' };
export const DIM_LABEL: Record<Dimension, string> = { resolucao: 'Resolução', compreensao: 'Compreensão', transferencia: 'Transferência', retencao: 'Retenção' };
export const DIM_STATUS_LABEL: Record<DimStatus, string> = { sem_evidencia: 'Sem evidência', parcial: 'Parcial', demonstrada: 'Demonstrada', negativa: 'Não demonstrada' };

export interface Evidence { ts: number; dim: Dimension; value: 'positiva' | 'parcial' | 'negativa'; source: 'questao' | 'gemea' | 'explicacao'; ref: string; note: string }
export interface LearnData { attempts: Attempt[]; explanations: Explanation[] }
export interface DimView { status: DimStatus; note: string }
export interface SkillDomain { skillId: string; state: DomainState; dims: Record<Dimension, DimView>; regressed: boolean; evidence: Evidence[]; evaluated: boolean; last?: number }

const qIndex = new Map(QUESTIONS.map((q) => [q.id, q]));
/** Acerto que sustenta evidência de resolução. */
export const isSolid = (a: Attempt) => a.correct && !a.assisted && a.confidence !== 'chute' && a.confidence !== 'nao_consegui';
const touches = (a: Attempt, skillId: string) => a.skillId === skillId || !!qIndex.get(a.qid)?.integrates?.includes(skillId);

/** Converte o histórico em evidências por dimensão, em ordem cronológica. */
export function evidenceFor(skillId: string, data: LearnData, params: Params = DEFAULT_PARAMS): Evidence[] {
  const out: Evidence[] = [];
  const seen = new Set<string>(); let firstTs: number | undefined; let firstSolid: number | undefined;
  type Ev = { ts: number; a?: Attempt; x?: Explanation };
  const events: Ev[] = [
    ...data.attempts.filter((a) => touches(a, skillId)).map((a): Ev => ({ ts: a.ts, a })),
    ...data.explanations.filter((x) => x.skillId === skillId).map((x): Ev => ({ ts: x.ts, x })),
  ].sort((p, q) => p.ts - q.ts);
  for (const { a, x } of events) {
    if (a) {
      const q = qIndex.get(a.qid); const own = a.skillId === skillId; const integ = !!q?.integrates?.length;
      const push = (dim: Dimension, value: Evidence['value'], note: string) => out.push({ ts: a.ts, dim, value, source: a.isTwin ? 'gemea' : 'questao', ref: a.qid, note });
      if (a.assisted) { firstTs ??= a.ts; continue; }
      const solid = isSolid(a); const novel = !seen.has(a.qid);
      const days = firstSolid === undefined ? 0 : Math.floor((a.ts - firstSolid) / DAY);
      if (own) {
        if (solid) push('resolucao', a.confidence === 'duvida' ? 'parcial' : 'positiva', a.confidence === 'duvida' ? 'Acerto com dúvida declarada.' : 'Acerto independente.');
        else if (!a.correct) push('resolucao', 'negativa', a.confidence === 'nao_consegui' ? 'Não conseguiu resolver.' : 'Resposta incorreta.');
      }
      // Transferência: gêmea de nível 2–3, integração ou questão inédita em dia posterior ao primeiro contato.
      const transfer = a.twinLevel !== 1 && ((a.twinLevel ?? 0) >= 2 || integ || (own && firstTs !== undefined && a.ts - firstTs >= DAY));
      if (novel && transfer) {
        if (solid) push('transferencia', a.confidence === 'duvida' ? 'parcial' : 'positiva', integ ? 'Acerto em questão que integra habilidades.' : 'Acerto em contexto novo.');
        else if (!a.correct && own) push('transferencia', 'negativa', 'Erro em contexto novo.');
      }
      if (own && firstSolid !== undefined && a.ts - firstSolid >= params.retencaoDias * DAY) {
        if (solid) push('retencao', 'positiva', `Acerto ${days} dias após a primeira demonstração.`);
        else if (!a.correct) push('retencao', 'negativa', `Erro ${days} dias após a primeira demonstração.`);
      }
      if (own) { seen.add(a.qid); firstTs ??= a.ts; if (solid) firstSolid ??= a.ts; }
    } else if (x) {
      firstTs ??= x.ts;
      if (x.assisted || x.result === 'inconclusiva') continue;
      const value = x.result === 'demonstrada' ? 'positiva' as const : x.result === 'parcial' ? 'parcial' as const : 'negativa' as const;
      out.push({ ts: x.ts, dim: 'compreensao', value, source: 'explicacao', ref: x.taskId, note: value === 'positiva' ? 'Explicação autônoma demonstrada.' : value === 'parcial' ? 'Explicação parcial.' : 'Explicação com erro conceitual ou insuficiente.' });
      if (value === 'positiva') {
        if (firstSolid !== undefined && x.ts - firstSolid >= params.retencaoDias * DAY) out.push({ ts: x.ts, dim: 'retencao', value: 'positiva', source: 'explicacao', ref: x.taskId, note: 'Explicação demonstrada após intervalo.' });
        firstSolid ??= x.ts;
      }
    }
  }
  return out;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));
function dimensions(ev: Evidence[], params: Params): Record<Dimension, DimView> {
  const of = (d: Dimension) => ev.filter((e) => e.dim === d);
  const res = of('resolucao').slice(-params.janelaResolucao);
  const pos = res.reduce((s, e) => s + (e.value === 'positiva' ? 1 : e.value === 'parcial' ? 0.5 : 0), 0);
  const rate = res.length ? pos / res.length : 0;
  const resolucao: DimView = !res.length ? { status: 'sem_evidencia', note: 'Nenhuma resolução independente.' }
    : pos >= params.resolucaoMin && rate >= params.resolucaoTaxa ? { status: 'demonstrada', note: `${fmt(pos)} acerto(s) sólido(s) nas últimas ${res.length} respostas.` }
    : pos > 0 ? { status: 'parcial', note: `${fmt(pos)} acerto(s) sólido(s) em ${res.length}; são necessários ${params.resolucaoMin} e ${Math.round(params.resolucaoTaxa * 100)}% da janela.` }
    : { status: 'negativa', note: `${res.length} resposta(s) sem acerto sólido.` };
  const simple = (d: Dimension, min: number, none: string, ok: (n: number) => string, partial: string, neg: string): DimView => {
    const list = of(d); if (!list.length) return { status: 'sem_evidencia', note: none };
    // A evidência mais recente vale: um insucesso posterior desfaz a demonstração até nova comprovação.
    if (list[list.length - 1].value === 'negativa') return { status: 'negativa', note: neg };
    const n = list.filter((e) => e.value === 'positiva').length;
    return n >= min ? { status: 'demonstrada', note: ok(n) } : { status: 'parcial', note: partial };
  };
  return {
    resolucao,
    compreensao: simple('compreensao', params.compreensaoMin, 'Ainda não explicou com as próprias palavras.', (n) => `${n} explicação(ões) autônoma(s) demonstrada(s).`, 'Explicação parcial: faltam ideias ou relações.', 'A explicação mais recente mostrou erro ou lacuna.'),
    transferencia: simple('transferencia', params.transferenciaMin, 'Ainda não resolveu em contexto novo.', (n) => `${n} acerto(s) em contexto novo ou integração.`, 'Acerto com dúvida em contexto novo.', 'Erro recente em contexto novo.'),
    retencao: simple('retencao', 1, `Sem verificação após ${params.retencaoDias} dias.`, (n) => `${n} verificação(ões) bem-sucedida(s) após o intervalo.`, 'Verificação parcial.', 'Falhou na verificação mais recente após o intervalo.'),
  };
}
const stateOf = (d: Record<Dimension, DimView>): DomainState => {
  const ok = (x: Dimension) => d[x].status === 'demonstrada';
  if (Object.values(d).every((v) => v.status === 'sem_evidencia')) return 'nao_avaliado';
  if (ok('resolucao') && ok('compreensao') && ok('transferencia')) return ok('retencao') ? 'consolidado' : 'provisorio';
  return 'em_aprendizagem';
};
const RANK: Record<DomainState, number> = { nao_avaliado: 0, em_aprendizagem: 1, provisorio: 2, consolidado: 3 };

export function skillDomain(skillId: string, data: LearnData, params: Params = DEFAULT_PARAMS): SkillDomain {
  const evidence = evidenceFor(skillId, data, params);
  const dims = dimensions(evidence, params); const state = stateOf(dims);
  let peak = 0;
  for (let i = 1; i < evidence.length; i++) peak = Math.max(peak, RANK[stateOf(dimensions(evidence.slice(0, i), params))]);
  const touched = data.attempts.some((a) => a.skillId === skillId) || data.explanations.some((x) => x.skillId === skillId);
  return { skillId, state, dims, regressed: peak >= 2 && RANK[state] < peak, evidence, evaluated: evidence.length > 0 || touched, last: evidence.at(-1)?.ts };
}
export type DomainMap = Map<string, SkillDomain>;
export const allDomains = (data: LearnData, params: Params = DEFAULT_PARAMS): DomainMap => new Map(SKILLS.map((s) => [s.id, skillDomain(s.id, data, params)]));

/** Nível das explicações e do tutor conforme o que já foi demonstrado. */
export function levelFor(d: SkillDomain): 'iniciante' | 'intermediario' | 'avancado' {
  if (d.state === 'provisorio' || d.state === 'consolidado') return 'avancado';
  if (d.dims.resolucao.status === 'demonstrada' || d.dims.compreensao.status === 'demonstrada') return 'intermediario';
  return 'iniciante';
}
export const skillName = (id: string) => skillById(id)?.name ?? id;
