import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetEnvCache } from '@/config/env';
import { setDbForTests } from '@/server/db';
import type { Database } from '@/server/db/types';
import { devMailbox, localProvider } from '@/server/auth/local-provider';
import { freshDb } from './helpers';

const PASSWORD = 'SenhaForte123';
let db: Database;

function mode(v: 'required' | 'off') {
  process.env.NEXO_EMAIL_VERIFICATION = v;
  resetEnvCache();
}

beforeAll(async () => {
  process.env.NEXO_ENV = 'test';
  db = await freshDb();
  setDbForTests(db);
});

afterAll(async () => {
  delete process.env.NEXO_EMAIL_VERIFICATION;
  resetEnvCache();
  setDbForTests(undefined);
  await db.close();
});

describe('verificação de e-mail no cadastro (ADR-020)', () => {
  it('desligada: cadastro devolve sessão, não envia e-mail e permite login imediato', async () => {
    mode('off');
    const before = devMailbox().length;
    const r = await localProvider.signUp('direto@example.com', PASSWORD);
    expect(r.ok && r.needsVerification).toBe(false);
    expect(r.ok && r.session?.email).toBe('direto@example.com');
    expect(devMailbox().length).toBe(before);
    const [u] = await db.query<{ email_confirmed_at: Date | null }>(`select email_confirmed_at from auth.users where email = 'direto@example.com'`);
    expect(u!.email_confirmed_at).toBeNull(); // não finge que o e-mail foi confirmado
    expect((await localProvider.signIn('direto@example.com', PASSWORD)).ok).toBe(true);
    expect((await localProvider.signIn('direto@example.com', 'SenhaErrada123')).ok).toBe(false);
  });

  it('exigida: cadastro sem sessão, envia link e bloqueia login até confirmar', async () => {
    mode('required');
    const r = await localProvider.signUp('confirma@example.com', PASSWORD);
    expect(r.ok && r.needsVerification).toBe(true);
    expect(r.ok && r.session).toBeNull();
    expect(await localProvider.signIn('confirma@example.com', PASSWORD)).toEqual({ ok: false, code: 'email_not_verified' });
    const link = devMailbox().filter((m) => m.to === 'confirma@example.com').at(-1)!.link;
    const token = new URL(link).searchParams.get('token_hash')!;
    expect((await localProvider.verifyEmail(token, 'signup')).ok).toBe(true);
    expect((await localProvider.signIn('confirma@example.com', PASSWORD)).ok).toBe(true);
  });

  it('conta antiga não confirmada passa a entrar quando a verificação é desligada', async () => {
    mode('required');
    await localProvider.signUp('antiga@example.com', PASSWORD);
    expect((await localProvider.signIn('antiga@example.com', PASSWORD)).ok).toBe(false);
    mode('off');
    expect((await localProvider.signIn('antiga@example.com', PASSWORD)).ok).toBe(true);
  });
});
