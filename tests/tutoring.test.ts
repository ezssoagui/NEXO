import { describe, expect, it } from 'vitest';
import { checkElimination, checkProof, ELIMINATION_TYPES, readCommand, revealCpe, splitSentences } from '../src/engine/cpe';
import { usesCpe, usesErrorForm } from '../src/engine/correctionRules';
import { QUESTIONS } from '../src/data/questions';
import { startSocratic, answerSocratic } from '../src/engine/socratic';
import { Q } from './helpers';

describe('CPE', () => {
  it('lê o comando, localiza a prova e identifica o erro da alternativa', () => {
    const q = Q('v45');
    expect(readCommand(q, 'o motivo principal da preocupação das autoridades com os quilombos')).toBe(true); expect(readCommand(q, 'fala de história')).toBe(false);
    const ss = splitSentences(q.context!); expect(ss.filter((x) => checkProof(q, x))).toHaveLength(1);
    expect(checkElimination(q, 'A', 'Inversão')).toBe(true); expect(checkElimination(q, 'A', 'Extrapolação')).toBe(false);
  });
  it('toda questão com CPE tem prova localizável no texto e tipos de erro reconhecidos', () => {
    QUESTIONS.filter((x) => x.cpe).forEach((x) => { expect(splitSentences(x.context!).some((s) => checkProof(x, s)), x.id).toBe(true); x.cpe!.excesso.forEach((e) => expect(ELIMINATION_TYPES.some((t) => checkElimination(x, e.letter, t.id)), `${x.id} ${e.letter}`).toBe(true)); });
  });
  it('só é usado em erros médios e difíceis de Linguagens e Humanas; formulário só em Matemática e Natureza', () => {
    expect(usesCpe(Q('v45'), false)).toBe(true); expect(usesCpe(Q('v45'), true)).toBe(false); expect(usesCpe(Q('v35'), false)).toBe(false); expect(usesCpe(Q('v06'), false)).toBe(false);
    expect(usesErrorForm(Q('v06'), false)).toBe(true); expect(usesErrorForm(Q('v06'), true)).toBe(false); expect(usesErrorForm(Q('v45'), false)).toBe(false);
  });
  it('revela a explicação completa sob pedido', () => { expect(revealCpe(Q('q23'))).toContain('Comando'); });
});

describe('Tutor socrático adaptativo (exemplo da potência elétrica)', () => {
  it('investiga a corrente com a Lei de Ohm, reage à concepção errada e chega ao fator 4', () => {
    let t = startSocratic('fis-potencia', Q('q01'));
    expect(t.text).toMatch(/constante/);
    t = answerSocratic(t.state, 'a resistência');
    expect(t.text).toMatch(/Lei de Ohm/);
    t = answerSocratic(t.state, 'a corrente continua a mesma');
    expect(t.done).toBe(false); expect(t.contradiction).toBeFalsy(); expect(t.text).toMatch(/U = R·I/);   // contrapergunta específica, não a resposta
    t = answerSocratic(t.state, 'ah, a corrente dobra também');
    expect(t.text).toMatch(/P = U·I/);
    t = answerSocratic(t.state, 'a potência quadruplica');
    expect(t.done).toBe(true); expect(t.text).toMatch(/inédita/);
  });
  it('não repete perguntas: uma resposta completa resolve várias etapas', () => {
    let t = startSocratic('fis-potencia', Q('q01'));
    t = answerSocratic(t.state, 'a resistência');
    t = answerSocratic(t.state, 'a corrente dobra, então a potência quadruplica');
    expect(t.done).toBe(true);
  });
  it('detecta contradição com resposta anterior', () => {
    let t = startSocratic('fis-potencia', Q('q01'));
    t = answerSocratic(t.state, 'resistência');
    t = answerSocratic(t.state, 'dobra');
    t = answerSocratic(t.state, 'a corrente continua a mesma então não sei');
    expect(t.contradiction).toBe(true); expect(t.text).toMatch(/mesma proporção da tensão/);
  });
  it('aproveita a justificativa: começa pelo ponto que faltou', () => {
    const t = startSocratic('fis-potencia', Q('q01'), ['r_const']);
    expect(t.text).toMatch(/Lei de Ohm/);
  });
  it('permite pedir a resposta direta a qualquer momento', () => {
    const t = answerSocratic(startSocratic('fis-potencia', Q('q01')).state, 'me dá a resposta', Q('q01'));
    expect(t.done).toBe(true); expect(t.text).toMatch(/Resolução/);
  });
  it('explica curto após duas tentativas sem prender o aluno', () => {
    let t = startSocratic('mat-porcentagem', Q('q17'));
    t = answerSocratic(t.state, 'hmm talvez 2');
    t = answerSocratic(t.state, 'não sei mesmo');
    expect(t.text).toMatch(/vou explicar/);
  });
});
