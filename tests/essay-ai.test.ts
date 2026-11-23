import { describe, expect, it, beforeEach } from 'vitest';
import { evaluateEssay, compareParagraph } from '../src/engine/essay';
import { ESSAY_THEMES, DEMO_ESSAYS } from '../src/data/essays';
import { AI, resetAIStatus } from '../src/services/ai';
import { essayHandler, tutorHandler, questionHandler } from '../server/handlers';
import { MockProvider, ProviderError } from '../server/providers';
import { resetUsage } from '../server/usage';
import { scrub } from '../server/privacy';

describe('Redação: feedback formativo', () => {
  it('cada competência traz justificativa, trechos do próprio texto e sugestões', () => {
    const d = DEMO_ESSAYS[1]; const ev = evaluateEssay(d.text, ESSAY_THEMES.find((t) => t.id === d.themeId)!);
    for (const c of ev.competencies) { expect(c.justification).toBeTruthy(); expect(Array.isArray(c.suggestions)).toBe(true); }
    const c1 = ev.competencies[0];
    c1.evidence!.forEach((q) => expect(d.text).toContain(q.replace(/[“”…]/g, '').slice(0, 10)));
  });
  it('reescrita de parágrafo: explica o que melhorou e o que falta', () => {
    const r = compareParagraph('Portanto o governo deve fazer alguma coisa para resolver esse problema.', 'Portanto, o Ministério da Educação deve ampliar bolsas de permanência, por meio de parcerias com as secretarias, a fim de reduzir a evasão, ou seja, garantir renda ao estudante que trabalha.', 'conclusao');
    expect(r.improved.join(' ')).toMatch(/meio|finalidade|detalhamento/);
    expect(r.note).toMatch(/autoria/);
  });
});

describe('Integração com IA: falhas e validação', () => {
  beforeEach(() => { resetAIStatus(); resetUsage(); });
  it('front-end: backend ausente → resposta demonstrativa identificada (nunca como IA real)', async () => {
    const failing = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    const r = await AI.evaluate(DEMO_ESSAYS[0].text, ESSAY_THEMES[0], failing);
    expect(r.demo).toBe(true); expect(r.fallbackReason).toMatch(/não encontrado/);
  });
  it('front-end: provedor configurado mas falhando → fallback com motivo', async () => {
    const fake = (async (url: string) => url.endsWith('/health') ? new Response(JSON.stringify({ configured: true, provider: 'anthropic', model: 'claude-opus-5-5' })) : new Response(JSON.stringify({ error: 'unavailable', message: 'Provedor indisponível (503).' }), { status: 502 })) as unknown as typeof fetch;
    const r = await AI.evaluate(DEMO_ESSAYS[0].text, ESSAY_THEMES[0], fake);
    expect(r.demo).toBe(true); expect(r.fallbackReason).toMatch(/indisponível/);
  });
  it('servidor: falha do provedor vira erro estruturado (502) e não derruba o serviço', async () => {
    const p = new MockProvider(() => { throw new ProviderError('unavailable', 'fora do ar', true); });
    const r = await tutorHandler(p, { userId: 'x', message: 'oi' });
    expect(r.status).toBe(502); expect((r.body as any).retryable).toBe(true);
  });
  it('servidor: saída fora do esquema é rejeitada', async () => {
    const p = new MockProvider(() => ({ foo: 'bar' }));
    const r = await tutorHandler(p, { userId: 'x', message: 'oi' });
    expect(r.status).toBe(502); expect((r.body as any).error).toBe('invalid_output');
  });
  it('servidor: trechos inventados pelo modelo são descartados e notas normalizadas', async () => {
    const text = DEMO_ESSAYS[0].text;
    const p = new MockProvider(() => ({ general_comment: 'ok', competencies: ['C1', 'C2', 'C3', 'C4', 'C5'].map((id) => ({ id, score: 150, justification: 'j', quotes: ['frase que não existe no texto', 'Em primeiro lugar, cabe destacar'], problems: [], suggestions: [], exercise: null })) }));
    const r = await essayHandler(p, { userId: 'x', text, theme: { title: 't' } });
    const c = (r.body as any).data.competencies[0];
    expect(c.quotes).toEqual(['Em primeiro lugar, cabe destacar']); expect(c.droppedQuotes).toBe(1); expect(c.score).toBe(160);
  });
  it('servidor: questão gerada por IA nunca entra como aprovada', async () => {
    const p = new MockProvider(() => ({ context: 'Contexto suficiente para uma questão de teste com dados.', statement: 'Qual?', alternatives: ['A', 'B', 'C', 'D', 'E'].map((l, i) => ({ letter: l, text: `op ${i}`, correct: i === 0, analysis: 'x' })), explanation: 'e', fast_method: 'f', hints: ['a', 'b', 'c'] }));
    const r = await questionHandler(p, { userId: 'x', skillName: 'Potência' });
    expect((r.body as any).status).toBe('revisao');
  });
  it('servidor: limite por usuário é aplicado', async () => {
    const p = new MockProvider(() => ({ reply: 'ok', diagnosis: null, student_understood: false, uncertain: false }));
    let last: any; for (let i = 0; i < 61; i++) last = await tutorHandler(p, { userId: 'limit-user', message: 'oi' });
    expect(last.status).toBe(429);
  });
  it('LGPD: dados pessoais são removidos antes de enviar ao provedor', () => {
    expect(scrub('meu email é ana@x.com e cpf 123.456.789-00')).not.toMatch(/ana@x\.com|123\.456/);
  });
});
