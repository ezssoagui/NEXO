import { describe, expect, it, beforeEach } from 'vitest';
import { openDb } from '../server/db';
import { authenticate, login, register, resetLoginThrottle } from '../server/auth';
import { adminMetrics, deleteMe, exportMe, getState, putState } from '../server/learning';
import { diagnoseHandler } from '../server/handlers';
import { MockProvider } from '../server/providers';
import { resetUsage } from '../server/usage';

const bearer = (t: string) => `Bearer ${t}`;
describe('Backend: persistência, autenticação e autorização', () => {
  let db: ReturnType<typeof openDb>;
  beforeEach(() => { db = openDb(':memory:'); resetLoginThrottle(); resetUsage(); delete process.env.NEXO_ADMIN_CODE; });

  it('cadastro por apelido + senha (sem e-mail), login e sessão', () => {
    expect(register(db, { nickname: 'a', password: '12345678' }).status).toBe(400);
    expect(register(db, { nickname: 'Ana', password: '123' }).status).toBe(400);
    const r = register(db, { nickname: 'Ana', password: '12345678' });
    expect(r.status).toBe(201); expect(r.body.role).toBe('student');
    expect(register(db, { nickname: 'ana', password: '12345678' }).status).toBe(409);
    expect(login(db, { nickname: 'Ana', password: 'errada00' }).status).toBe(401);
    const l = login(db, { nickname: 'ana', password: '12345678' });
    expect(l.status).toBe(200);
    expect(authenticate(db, bearer(l.body.token))?.nickname).toBe('Ana');
    expect(authenticate(db, bearer('token-falso'))).toBeNull();
  });
  it('bloqueia tentativas repetidas de login', () => {
    register(db, { nickname: 'Bia', password: '12345678' });
    for (let i = 0; i < 8; i++) login(db, { nickname: 'Bia', password: 'xxxxxxxx' });
    expect(login(db, { nickname: 'Bia', password: '12345678' }).status).toBe(429);
  });
  it('persiste o estado e cada tentativa; cada usuário só vê os próprios dados; não grava o token', () => {
    const a = register(db, { nickname: 'Caio', password: '12345678' }).body; const b = register(db, { nickname: 'Duda', password: '12345678' }).body;
    const ua = authenticate(db, bearer(a.token)); const ub = authenticate(db, bearer(b.token));
    const state = { attempts: [{ id: 't1', qid: 'q01', skillId: 'fis-potencia', correct: false, confidence: 'certeza', cause: 'conceitual', intervention: 'B', ts: 1 }], account: { token: a.token } };
    expect(putState(db, null, { state }, '{}').status).toBe(401);
    expect(putState(db, ua, { state }, JSON.stringify({ state })).status).toBe(200);
    expect(getState(db, ua).body.state.attempts).toHaveLength(1);
    expect(getState(db, ua).body.state.account).toBeUndefined();
    expect(getState(db, ub).body.state).toBeNull();
    expect(exportMe(db, ua).body.attempts[0].cause).toBe('conceitual');
  });
  it('métricas agregadas só para administradores', () => {
    process.env.NEXO_ADMIN_CODE = 'segredo';
    const s = register(db, { nickname: 'Aluno', password: '12345678' }).body;
    const ad = register(db, { nickname: 'Admin', password: '12345678', adminCode: 'segredo' }).body;
    expect(ad.role).toBe('admin');
    expect(adminMetrics(db, authenticate(db, bearer(s.token))).status).toBe(403);
    expect(adminMetrics(db, null).status).toBe(401);
    expect(adminMetrics(db, authenticate(db, bearer(ad.token))).body.users).toBe(2);
  });
  it('LGPD: exclusão remove conta, sessões e histórico', () => {
    const a = register(db, { nickname: 'Eva', password: '12345678' }).body; const u = authenticate(db, bearer(a.token));
    putState(db, u, { state: { attempts: [{ id: 'x', ts: 1 }] } }, '{}');
    expect(deleteMe(db, u).status).toBe(204);
    expect(authenticate(db, bearer(a.token))).toBeNull();
    expect(db.metrics().attempts).toBe(0);
  });
  it('IA interpreta justificativa apenas como evidência; citação inventada reduz a confiança', async () => {
    const p = new MockProvider(() => ({ cause: 'calculo', confidence: 0.9, quote: 'trecho que não existe' }));
    const r = await diagnoseHandler(p, { userId: 'u', statement: 'x', chosen: 'B', justification: 'eu multipliquei errado no final' });
    expect(r.status).toBe(200); expect((r.body as any).data.quote).toBeNull(); expect((r.body as any).data.confidence).toBeLessThanOrEqual(0.5);
  });
});
