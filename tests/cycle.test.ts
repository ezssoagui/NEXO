import { describe, expect, it } from 'vitest';
import { classifyResponse } from '../src/engine/intervention';
import { startCycle, recordTwin, interrupt, postpone, finishTeaching, checkConsolidation } from '../src/engine/cycle';
import { chooseLevel, isNone, selectTwin } from '../src/engine/twins';
import { skillMastery } from '../src/engine/mastery';
import { Q, attempt } from './helpers';

const err = () => { const a = attempt('q01', 'B', 'certeza'); return { a, h: classifyResponse(Q('q01'), { correct: false, confidence: 'certeza', hintsUsed: 0, chosen: 'B', justification: 'a potência cai pela metade' }) }; };

describe('Ciclo de domínio e questões gêmeas', () => {
  it('erro abre ciclo em "ensino"; interrupção voluntária é registrada', () => {
    const { h } = err(); const c = startCycle('q01', 'fis-potencia', h);
    expect(c.stage).toBe('ensino');
    const i = interrupt(c); expect(i.status).toBe('interrompido'); expect(i.history.at(-1)!.note).toMatch(/interrompida/);
    expect(postpone(c).status).toBe('adiado');
  });
  it('gêmea respondida corretamente leva à consolidação e eleva o domínio', () => {
    const { a, h } = err(); let c = finishTeaching(startCycle('q01', 'fis-potencia', h), 'compreendeu');
    expect(c.stage).toBe('comprovacao');
    const tw = attempt('q02', 'D', 'certeza', { isTwin: true, ts: Date.now() + 1000 }, [a]);
    c = recordTwin(c, tw, 2);
    expect(c.stage).toBe('consolidacao'); expect(c.twinLevel).toBe(3);
    expect(skillMastery([a, tw], 'fis-potencia').state).toBe('provisorio');
  });
  it('gêmea respondida incorretamente volta ao ensino e reduz o nível', () => {
    const { a, h } = err(); let c = startCycle('q01', 'fis-potencia', h);
    const tw = attempt('q02', 'C', 'certeza', { isTwin: true }, [a]);
    c = recordTwin(c, tw, 2);
    expect(c.stage).toBe('ensino'); expect(c.twinLevel).toBe(1);
    expect(skillMastery([a, tw], 'fis-potencia').state).toBe('desenvolvimento');
  });
  it('consolidação só conclui com acerto em outro dia', () => {
    const { a, h } = err(); const tw = attempt('q02', 'D', 'certeza', { isTwin: true });
    let c = recordTwin(startCycle('q01', 'fis-potencia', h), tw, 2);
    expect(checkConsolidation(c, [a, tw]).stage).toBe('consolidacao');
    const later = attempt('q31', 'B', 'certeza', { ts: Date.now() + 2 * 86400000 });
    c = checkConsolidation(c, [a, tw, later]); expect(c.stage).toBe('concluido');
  });
  it('nível da gêmea conforme situação e desempenho', () => {
    expect(chooseLevel('D')).toBe(1); expect(chooseLevel('C')).toBe(2);
    expect(chooseLevel('D', [{ correct: true, level: 1 }])).toBe(2); expect(chooseLevel('D', [{ correct: false, level: 2 }])).toBe(1);
  });
  it('seleção: nível 1 gerado e validado; nível 2 banco revisado; nível 3 integração; nunca repete a original', () => {
    const l1 = selectTwin(Q('q01'), 1, []); expect(isNone(l1)).toBe(false); if (!isNone(l1)) { expect(l1.kind).toBe('gerada'); expect(l1.q.id).not.toBe('q01'); }
    const l2 = selectTwin(Q('q01'), 2, []); if (!isNone(l2)) { expect(l2.q.id).toBe('q02'); expect(l2.reviewed).toBe(true); }
    const l3 = selectTwin(Q('q01'), 3, []); if (!isNone(l3)) { expect(l3.q.integrates).toBeTruthy(); expect(l3.level).toBe(3); }
  });
  it('sem questão inédita confiável, não apresenta questão como validada', () => {
    const seen = ['q28'].map((id) => attempt(id, 'C', 'certeza'));
    const r = selectTwin(Q('q28'), 2, seen); // filosofia: sem gerador, sem outra questão do banco
    expect(isNone(r)).toBe(true);
  });
});
