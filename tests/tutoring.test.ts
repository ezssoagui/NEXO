import { describe, expect, it } from 'vitest';
import { startCpe, answerCpe, revealCpe } from '../src/engine/cpe';
import { startSocratic, answerSocratic } from '../src/engine/socratic';
import { Q } from './helpers';

describe('C–P–E adaptativo', () => {
  it('investiga comando → prova → eliminação e encerra quando o aluno compreende', () => {
    const q = Q('q23');
    let t = startCpe(q, 'C');
    expect(t.tag).toBe('C');
    t = answerCpe(q, t.state, 'Pede a tese que o autor defende sobre leitura e celulares');
    expect(t.state.step).toBe('prova'); // leitura correta do comando → pede a prova
    t = answerCpe(q, t.state, 'achei que falava que a tela é melhor');
    expect(t.text).toContain('não');
    t = answerCpe(q, t.state, 'A minha alternativa vai além do texto: o texto não compara tela e papel, é extrapolação');
    expect(t.state.step).toBe('fim'); expect(t.state.understood).toBe(true);
  });
  it('pula etapas desnecessárias quando a justificativa já mostra o comando', () => {
    const t = startCpe(Q('q23'), 'C', 'O autor defende a tese sobre o desafio da escola com textos longos');
    expect(t.state.step).toBe('prova');
  });
  it('encerra cedo se o aluno diz que entendeu', () => {
    const q = Q('q23'); const t = answerCpe(q, startCpe(q, 'A').state, 'entendi');
    expect(t.state.step).toBe('fim');
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
