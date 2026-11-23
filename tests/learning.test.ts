import { describe, expect, it } from 'vitest';
import { decide, recommendForSkill, selectIntervention } from '../src/engine/learning';
import { diagnose } from '../src/engine/diagnosis';
import { skillMastery } from '../src/engine/mastery';
import { scheduleSkill } from '../src/engine/srs';
import { Q, attempt } from './helpers';

const DAY = 86400000;
const r = (correct: boolean, chosen: string, confidence: any = 'certeza', extra: any = {}) => ({ correct, chosen, confidence, hintsUsed: 0, ...extra });

describe('NEXO Learning Engine — cenários de aceitação', () => {
  it('A — acerto seguro: registra e avança sem intervenção', () => {
    const d = decide({ q: Q('q13'), response: r(true, 'B'), history: [] });
    expect(d.diagnosis.outcome).toBe('acerto_seguro'); expect(d.intervention).toBe('nenhuma'); expect(d.next.kind).toBe('avancar'); expect(d.review.needed).toBe(false);
  });
  it('B — acerto com dúvida: registra incerteza e recomenda verificação posterior', () => {
    const d = decide({ q: Q('q17'), response: r(true, 'B', 'duvida'), history: [] });
    expect(d.diagnosis.outcome).toBe('acerto_duvida'); expect(d.intervention).toBe('E'); expect(d.review).toMatchObject({ needed: true, inDays: 1 }); expect(d.next.kind).toBe('praticar');
  });
  it('C — confusão entre duas alternativas: CPE', () => {
    const d = decide({ q: Q('q23'), response: r(false, 'C', 'duvida', { justification: 'Fiquei em dúvida entre a C e a D' }), history: [] });
    expect(d.diagnosis.cause).toBe('confusao_alternativas'); expect(d.intervention).toBe('B'); expect(d.cpe).toBe(true);
  });
  it('D — erro conceitual sem conhecimento parcial: microaula + verificação inédita', () => {
    const d = decide({ q: Q('q13'), response: r(false, 'D', 'certeza', { justification: 'Não sei o que esse hormônio faz' }), history: [] });
    expect(d.diagnosis.cause).toBe('conceitual'); expect(d.intervention).toBe('C'); expect(d.next.kind).toBe('praticar'); expect(d.next.to).toContain('gemea=1');
  });
  it('D — erro conceitual com conhecimento parcial: tutoria socrática', () => {
    const d = decide({ q: Q('q01'), response: r(false, 'B', 'duvida', { justification: 'A potência cai pela metade com a tensão' }), history: [] });
    expect(d.diagnosis.cause).toBe('conceitual'); expect(d.intervention).toBe('B'); expect(d.cpe).toBe(false);
  });
  it('E — erro de cálculo com procedimento correto: corrige a etapa sem repetir teoria', () => {
    const d = decide({ q: Q('q01'), response: r(false, 'E', 'certeza', { justification: 'A resistência é constante, usei U²/R e dividi por 8' }), history: [] });
    expect(d.diagnosis.cause).toBe('calculo'); expect(d.intervention).toBe('E');
  });
  it('F — lacuna de pré-requisito: estequiometria depende de proporção', () => {
    const history = [attempt('q37', 'B', 'certeza', { ts: Date.now() - 2 * DAY }), attempt('q38', 'A', 'certeza', { ts: Date.now() - DAY })];
    const d = decide({ q: Q('q09'), response: r(false, 'A'), history });
    expect(d.diagnosis.cause).toBe('lacuna_prerequisito'); expect(d.diagnosis.prerequisite).toBe('mat-proporcao'); expect(d.intervention).toBe('G'); expect(d.next.kind).toBe('prerequisitos');
    expect(recommendForSkill('qui-estequiometria', [...history, attempt('q09', 'A', 'certeza')]).action).toBe('prerequisitos');
  });
  it('F — se o pré-requisito já está dominado, a dependência não é presumida', () => {
    const t = Date.now();
    const history = [attempt('q37', 'A', 'certeza', { ts: t - 3 * DAY }), attempt('q38', 'B', 'certeza', { ts: t - 2 * DAY, isTwin: true })];
    expect(skillMastery(history, 'mat-proporcao').state).not.toBe('desenvolvimento');
    const d = diagnose(Q('q09'), r(false, 'A'), history);
    expect(d.cause).not.toBe('lacuna_prerequisito');
  });
  it('G — esquecimento: havia domínio e errou em revisão posterior; revisões ficam mais próximas', () => {
    const t = Date.now();
    const history = [attempt('q01', 'C', 'certeza', { ts: t - 10 * DAY }), attempt('q02', 'D', 'certeza', { ts: t - 9 * DAY, isTwin: true })];
    const d = decide({ q: Q('q31'), response: r(false, 'A'), history, now: t });
    expect(d.diagnosis.cause).toBe('esquecimento'); expect(d.intervention).toBe('A'); expect(d.next.kind).toBe('revisao');
    const before = scheduleSkill(scheduleSkill(undefined, history[0]).review, history[1]).review;
    const after = scheduleSkill(before, attempt('q31', 'A', 'certeza', { ts: t }));
    expect(after.review.interval).toBeLessThan(before.interval);
  });
  it('H — estudante avançado: domínio consistente recebe desafio, sem explicação', () => {
    const t = Date.now();
    const history = [attempt('q01', 'C', 'certeza', { ts: t - 5 * DAY }), attempt('q02', 'D', 'certeza', { ts: t - 3 * DAY, isTwin: true })];
    const d = decide({ q: Q('q36'), response: r(true, 'A'), history: [...history, attempt('q03', 'B', 'certeza', { ts: t - 2 * DAY }), attempt('q04', 'B', 'certeza', { ts: t - DAY, isTwin: true })], now: t });
    expect(d.intervention).toBe('nenhuma');
    const rec = recommendForSkill('fis-potencia', history, {}, t);
    expect(['desafio', 'avancar']).toContain(rec.action);
  });
});

describe('Diagnóstico — nunca presumir a causa só pela alternativa', () => {
  it('sem justificativa nem histórico, a causa fica indeterminada e pede justificativa', () => {
    const d = diagnose(Q('q01'), r(false, 'B'));
    expect(d.cause).toBe('indeterminada'); expect(d.needsJustification).toBe(true); expect(d.provisional).toBe('conceitual'); expect(d.confidence).toBeLessThan(0.5);
  });
  it('a justificativa curta resolve a incerteza', () => {
    const d = diagnose(Q('q03'), r(false, 'A', 'certeza', { justification: 'esqueci de converter a unidade para m/s' }));
    expect(['unidade', 'esquecimento']).toContain(d.cause); expect(d.needsJustification).toBe(false);
  });
  it('relato do aluno é evidência forte e permite reclassificar', () => {
    const d = diagnose(Q('q03'), r(false, 'C'), [], Date.now());
    expect(d.cause).toBe('indeterminada');
    const d2 = diagnose(Q('q03'), { ...r(false, 'C'), studentReport: 'atencao' });
    expect(d2.cause).toBe('atencao');
  });
  it('tempo de resposta só reforça, nunca decide sozinho', () => {
    const d = diagnose(Q('q13'), r(false, 'D', 'certeza', { timeSec: 2 }));
    expect(d.cause).toBe('indeterminada');
  });
  it('acertos distinguidos: seguro, dúvida, tentativa, com dicas', () => {
    expect(diagnose(Q('q13'), r(true, 'B')).outcome).toBe('acerto_seguro');
    expect(diagnose(Q('q13'), r(true, 'B', 'duvida')).outcome).toBe('acerto_duvida');
    expect(diagnose(Q('q13'), r(true, 'B', 'chute')).outcome).toBe('acerto_tentativa');
    expect(diagnose(Q('q13'), { ...r(true, 'B'), hintsUsed: 2 }).outcome).toBe('acerto_com_dicas');
  });
  it('outras abordagens são oferecidas ao aluno', () => {
    const d = diagnose(Q('q03'), r(false, 'A', 'certeza', { justification: 'converti a unidade errado' }));
    const s = selectIntervention(Q('q03'), d, []);
    expect(s.code).toBe('F'); expect(s.options.length).toBeGreaterThan(0);
  });
  it('erro conceitual recorrente escala para aula estruturada', () => {
    const h = [attempt('q13', 'A', 'certeza', { cause: 'conceitual' }), attempt('q14', 'A', 'certeza', { cause: 'conceitual' })];
    const d = decide({ q: Q('q13'), response: r(false, 'C', 'certeza', { justification: 'não sei' }), history: h });
    expect(d.intervention).toBe('D');
  });
  it('um acerto isolado não é prova de domínio', () => {
    expect(skillMastery([attempt('q13', 'B', 'certeza')], 'bio-hormonios').state).toBe('desenvolvimento');
  });
});
