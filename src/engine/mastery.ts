import type { Attempt, Evidence, MasteryState, Subject } from '../types';
import { SKILLS } from '../data/skills';
import { EVIDENCE_WEIGHT, isFragile } from './evidence';

export const MASTERY_LABEL: Record<MasteryState, string> = {
  nao_estudado: 'Ainda não estudado', desenvolvimento: 'Em desenvolvimento', provisorio: 'Domínio provisório', consistente: 'Domínio consistente',
};
export const MASTERY_COLOR: Record<MasteryState, string> = {
  nao_estudado: '#cbd5e1', desenvolvimento: '#f59e0b', provisorio: '#38bdf8', consistente: '#14b88d',
};

const DAY = 86400000;

/** Evidência de uma tentativa (tentativas antigas sem o campo são inferidas). */
export function evidenceOf(a: Attempt): Evidence {
  if (a.evidence) return a.evidence;
  if (a.confidence === 'nao_consegui') return 'nao_resolveu';
  if (a.correct) return a.confidence === 'chute' ? 'acerto_chute' : a.hintsUsed >= 2 ? 'acerto_com_dicas' : a.confidence === 'certeza' ? 'confianca_declarada' : a.confidence === 'nao_informada' ? 'acerto_sem_confianca' : 'acerto_duvida';
  return 'erro_conceitual';
}

/** Acerto "sólido": correto, sem chute, sem raciocínio incorreto e com no máximo 1 dica. */
export const solid = (a: Attempt) => {
  if (!a.correct || a.hintsUsed > 1) return false;
  const e = evidenceOf(a);
  return e === 'compreensao_demonstrada' || e === 'confianca_declarada' || e === 'acerto_duvida' || e === 'acerto_eliminacao' || e === 'acerto_sem_confianca';
};

export interface SkillMastery { skillId: string; state: MasteryState; score: number; reasons: string[]; attempts: number; fragile: boolean; regressed: boolean; evidence: Partial<Record<Evidence, number>> }

function rawState(list: Attempt[]): { state: MasteryState; score: number; novelSolid: boolean; solids: number; days: number } {
  if (!list.length) return { state: 'nao_estudado', score: 0, novelSolid: false, solids: 0, days: 0 };
  const recent = list.slice(-5);
  let num = 0, den = 0;
  recent.forEach((a, i) => { const w = (i + 1) ** 2 * (a.isNovel || a.isTwin ? 1.5 : 1); num += EVIDENCE_WEIGHT[evidenceOf(a)] * w; den += w; });
  const score = num / den;
  const solids = list.filter(solid);
  const novelSolid = solids.some((a) => a.isNovel || a.isTwin);
  const days = new Set(solids.map((a) => Math.floor(a.ts / DAY))).size;
  const last = list[list.length - 1];
  let state: MasteryState = 'desenvolvimento';
  // Um único acerto nunca eleva além de "em desenvolvimento" — exceto quando é comprovação em questão inédita após estudo.
  if (score >= 0.6 && (solids.length >= 2 || (novelSolid && list.length >= 2))) {
    state = 'provisorio';
    if (novelSolid && solids.length >= 2 && days >= 2 && last.correct) state = 'consistente';
  }
  return { state, score, novelSolid, solids: solids.length, days };
}

/**
 * Regras transparentes:
 *  - pontuação = média ponderada das últimas 5 tentativas, pesos quadráticos (recentes pesam mais) e 1,5× em questões inéditas;
 *    cada tentativa vale conforme a EVIDÊNCIA (compreensão demonstrada 1 · confiança 0,85 · dúvida 0,6 · eliminação 0,55 · dicas 0,45 ·
 *    raciocínio incorreto 0,25 · chute 0 · erros 0–0,2);
 *  - domínio provisório: pontuação ≥ 60% e (2 acertos sólidos OU acerto sólido em questão inédita após ao menos 2 tentativas);
 *  - domínio consistente: + acerto em questão inédita + acertos sólidos em ≥ 2 dias + última tentativa correta;
 *  - acerto frágil: o último acerto foi com dúvida, eliminação, dicas, chute ou raciocínio incorreto;
 *  - regressão: a habilidade já esteve em domínio e falhou em avaliação posterior.
 */
export function skillMastery(attempts: Attempt[], skillId: string): SkillMastery {
  const list = attempts.filter((a) => a.skillId === skillId).sort((a, b) => a.ts - b.ts);
  const evidence: Partial<Record<Evidence, number>> = {};
  list.forEach((a) => { const e = evidenceOf(a); evidence[e] = (evidence[e] ?? 0) + 1; });
  if (!list.length) return { skillId, state: 'nao_estudado', score: 0, reasons: ['Nenhuma tentativa registrada.'], attempts: 0, fragile: false, regressed: false, evidence };
  const r = rawState(list);
  const last = list[list.length - 1];
  const lastCorrect = [...list].reverse().find((a) => a.correct);
  const fragile = !!lastCorrect && isFragile(evidenceOf(lastCorrect)) && last.correct;
  let regressed = false;
  for (let i = 1; i < list.length; i++) {
    const st = rawState(list.slice(0, i)).state;
    if ((st === 'provisorio' || st === 'consistente') && !list[i].correct && !list.slice(i + 1).some(solid)) { regressed = true; break; }
  }
  const strength = r.score >= 0.75 ? 'alta' : r.score >= 0.5 ? 'média' : 'baixa';
  const reasons: string[] = [`Força das evidências recentes: ${strength}.`, `${r.solids} acerto(s) sólido(s) (sem chute, sem raciocínio incorreto, até 1 dica).`];
  if (list.length === 1 && last.correct) reasons.push('Um único acerto não basta para declarar domínio.');
  if (r.state === 'provisorio') { if (!r.novelSolid) reasons.push('Falta comprovar em questão inédita (gêmea).'); if (r.days < 2) reasons.push('Falta confirmar o acerto em outro dia (revisão espaçada).'); }
  if (r.state === 'desenvolvimento' && r.score < 0.6) reasons.push('As respostas recentes ainda não mostram segurança suficiente.');
  if (fragile) reasons.push('Último acerto foi frágil: uma verificação futura foi priorizada.');
  if (regressed) reasons.push('Atenção: domínio aparente com falha em avaliação posterior.');
  if (!last.correct) reasons.push('A tentativa mais recente foi incorreta.');
  if (r.state === 'consistente') reasons.push('Acerto em questão inédita e em dias diferentes: domínio consistente.');
  return { skillId, state: r.state, score: r.score, reasons, attempts: list.length, fragile, regressed, evidence };
}

/** Indicadores interpretáveis (contagens reais, sem percentuais arbitrários). */
export function masteryIndicators(attempts: Attempt[], skillId: string, now = Date.now()) {
  const list = attempts.filter((a) => a.skillId === skillId && !a.free).sort((a, b) => a.ts - b.ts);
  const secure = list.filter((a) => a.correct && solid(a) && evidenceOf(a) !== 'acerto_duvida' && evidenceOf(a) !== 'acerto_eliminacao').length;
  const doubt = list.filter((a) => a.correct && (evidenceOf(a) === 'acerto_duvida' || evidenceOf(a) === 'acerto_eliminacao')).length;
  const guess = list.filter((a) => a.correct && evidenceOf(a) === 'acerto_chute').length;
  const wrong = list.filter((a) => !a.correct).length;
  const novelCorrect = list.filter((a) => a.correct && (a.isTwin || a.isNovel) && solid(a)).length;
  const hints = list.reduce((s, a) => s + (a.hintsUsed || 0), 0);
  // Retenção observada: tentativas feitas ≥ 1 dia depois de um acerto sólido anterior na mesma habilidade.
  const reviews = list.filter((a, i) => list.slice(0, i).some((p) => solid(p) && a.ts - p.ts >= DAY));
  const retained = reviews.filter((a) => a.correct && a.confidence !== 'chute').length;
  const last = list[list.length - 1];
  return { attempts: list.length, secure, doubt, guess, wrong, novelCorrect, hints, reviews: reviews.length, retained, daysSinceLast: last ? Math.floor((now - last.ts) / DAY) : null };
}

export function allMastery(attempts: Attempt[]) {
  return SKILLS.map((s) => ({ ...skillMastery(attempts, s.id), skill: s }));
}

export function subjectStats(attempts: Attempt[]) {
  const subjects: Subject[] = ['Matemática', 'Física', 'Química', 'Biologia', 'Linguagens', 'Humanas'];
  const m = allMastery(attempts);
  return subjects.map((sub) => {
    const sk = m.filter((x) => x.skill.subject === sub);
    // Proporção REAL de habilidades em domínio (provisório ou consistente) — não é um percentual inventado.
    const dominated = sk.filter((x) => x.state === 'provisorio' || x.state === 'consistente').length;
    const developing = sk.filter((x) => x.state === 'desenvolvimento').length;
    const at = attempts.filter((a) => a.subject === sub && !a.free);
    return { subject: sub, mastery: Math.round((dominated / Math.max(1, sk.length)) * 100), dominated, developing, total: sk.length, accuracy: at.length ? Math.round((at.filter((a) => a.correct).length / at.length) * 100) : 0, attempts: at.length };
  });
}
