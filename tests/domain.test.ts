import { describe, expect, it } from 'vitest';
import { allDomains, levelFor, skillDomain } from '../src/engine/domain';
import { indicators } from '../src/engine/indicators';
import { DEFAULT_PARAMS } from '../src/engine/params';
import { at, ex } from './helpers';

const S = 'fis-potencia';
const resolve = [at('q01', true, 0), at('q02', true, 2, { isTwin: true, twinLevel: 2 })];
describe('domínio em quatro dimensões', () => {
  it('sem evidência: não avaliado (≠ desconhecido)', () => {
    expect(skillDomain(S, { attempts: [], explanations: [] }).state).toBe('nao_avaliado');
  });
  it('excelente percentual de acertos sem compreensão NÃO gera domínio', () => {
    const d = skillDomain(S, { attempts: [...resolve, at('q31', true, 3)], explanations: [] });
    expect(d.dims.resolucao.status).toBe('demonstrada'); expect(d.dims.transferencia.status).toBe('demonstrada');
    expect(d.dims.compreensao.status).toBe('sem_evidencia'); expect(d.state).toBe('em_aprendizagem');
  });
  it('provisório exige resolução + compreensão + transferência; consolidado exige também retenção', () => {
    const base = { attempts: resolve, explanations: [ex('e-pot-quad', 'demonstrada', 2)] };
    expect(skillDomain(S, base).state).toBe('provisorio');
    expect(skillDomain(S, { ...base, attempts: [...resolve, at('q31', true, 9)] }).state).toBe('consolidado');
  });
  it('um único acerto, chute ou resposta assistida não comprovam', () => {
    expect(skillDomain(S, { attempts: [at('q01', true, 0)], explanations: [] }).dims.resolucao.status).toBe('parcial');
    expect(skillDomain(S, { attempts: [at('q01', true, 0, { confidence: 'chute' }), at('q02', true, 2, { confidence: 'chute' })], explanations: [] }).dims.resolucao.status).toBe('sem_evidencia');
    expect(skillDomain(S, { attempts: resolve.map((a) => ({ ...a, assisted: true })), explanations: [] }).dims.resolucao.status).toBe('sem_evidencia');
    expect(skillDomain(S, { attempts: resolve, explanations: [ex('e-pot-quad', 'demonstrada', 2, { assisted: true })] }).dims.compreensao.status).toBe('sem_evidencia');
  });
  it('explicação inconclusiva não conta nem a favor nem contra', () => {
    expect(skillDomain(S, { attempts: resolve, explanations: [ex('e-pot-quad', 'inconclusiva', 2)] }).dims.compreensao.status).toBe('sem_evidencia');
  });
  it('permite regressão quando novas evidências mostram perda', () => {
    const d = skillDomain(S, { attempts: [...resolve, at('q31', true, 9), at('q31', false, 20)], explanations: [ex('e-pot-quad', 'demonstrada', 2)] });
    expect(d.state).not.toBe('consolidado'); expect(d.regressed).toBe(true); expect(d.dims.retencao.status).toBe('negativa');
  });
  it('gêmea de aplicação direta (nível 1) não conta como transferência', () => {
    const d = skillDomain(S, { attempts: [at('q01', true, 0), at('q02', true, 2, { isTwin: true, twinLevel: 1 })], explanations: [] });
    expect(d.dims.transferencia.status).toBe('sem_evidencia');
  });
  it('questão de integração gera evidência de transferência para a habilidade integrada', () => {
    expect(skillDomain('mat-porcentagem', { attempts: [at('q31', true, 0)], explanations: [] }).dims.transferencia.status).toBe('demonstrada');
  });
  it('parâmetros são configuráveis', () => {
    expect(skillDomain(S, { attempts: [at('q01', true, 0)], explanations: [] }, { ...DEFAULT_PARAMS, resolucaoMin: 1 }).dims.resolucao.status).toBe('demonstrada');
  });
  it('nível acompanha o que foi demonstrado', () => {
    expect(levelFor(skillDomain(S, { attempts: [], explanations: [] }))).toBe('iniciante');
    expect(levelFor(skillDomain(S, { attempts: resolve, explanations: [] }))).toBe('intermediario');
    expect(levelFor(skillDomain(S, { attempts: resolve, explanations: [ex('e-pot-quad', 'demonstrada', 2)] }))).toBe('avancado');
  });
});
describe('indicadores separados', () => {
  it('perfil vazio: sem aproveitamento nem retenção (null, não zero)', () => {
    const i = indicators({ attempts: [], explanations: [] }, allDomains({ attempts: [], explanations: [] }));
    expect(i.accuracy.value).toBeNull(); expect(i.retention.value).toBeNull(); expect(i.coverage.n).toBe(0);
  });
  it('domínio = consolidadas ÷ total; cobertura e aproveitamento independem dele', () => {
    const data = { attempts: [...resolve, at('q31', true, 9), at('q03', false, 1)], explanations: [ex('e-pot-quad', 'demonstrada', 2)] };
    const i = indicators(data, allDomains(data));
    expect(i.domain.n).toBe(1); expect(i.domain.value).toBeCloseTo(1 / i.domain.total); expect(i.coverage.n).toBe(3); expect(i.accuracy.value).toBeCloseTo(0.75); expect(i.retention.value).toBe(1);
  });
});
