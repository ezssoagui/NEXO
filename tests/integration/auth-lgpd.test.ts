import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type DB } from '../../server/db';
import { resetV1LoginThrottle } from '../../server/repositories/users';
import { createAuthRoutes } from '../../server/routes/auth';

describe('US1: Autenticação por e-mail/senha, recuperação e direitos LGPD', () => {
  let db: DB;
  let auth: ReturnType<typeof createAuthRoutes>;

  beforeEach(() => {
    db = openDb(':memory:');
    resetV1LoginThrottle();
    auth = createAuthRoutes(db);
  });

  it('cadastra por e-mail + senha + apelido, faz login, recupera senha e invalida sessões antigas', () => {
    expect(auth.register({ email: 'invalido', password: 'Password123', nickname: 'Ana' }).status).toBe(400);
    const reg = auth.register({ email: 'ana@nexo.edu.br', password: 'Password123', nickname: 'Ana', isMinor: true, lgpdConsent: true });
    expect(reg.status).toBe(201);
    const oldToken = (reg.body as any).token;
    expect(auth.authenticate(`Bearer ${oldToken}`)?.email).toBe('ana@nexo.edu.br');

    // Reset de senha
    const forgot = auth.forgotPassword({ email: 'ana@nexo.edu.br' });
    const resetToken = (forgot.body as any).devResetToken;
    expect(resetToken).toBeTruthy();

    const reset = auth.resetPassword({ token: resetToken, newPassword: 'NovaSenha123' });
    expect(reset.status).toBe(200);

    // Sessão antiga invalidada
    expect(auth.authenticate(`Bearer ${oldToken}`)).toBeNull();
    // Login com nova senha funciona
    expect(auth.login({ email: 'ana@nexo.edu.br', password: 'Password123' }).status).toBe(401);
    expect(auth.login({ email: 'ana@nexo.edu.br', password: 'NovaSenha123' }).status).toBe(200);
  });

  it('mantém perfil pedagógico de menor sem CPF e garante exportação/exclusão LGPD mesmo sem assinatura ativa', () => {
    const reg = auth.register({ email: 'menor@nexo.edu.br', password: 'Password123', nickname: 'Lucas', isMinor: true, lgpdConsent: true });
    const token = (reg.body as any).token;
    const user = auth.authenticate(`Bearer ${token}`);

    const me = auth.me(user);
    expect(me.status).toBe(200);
    expect((me.body as any).hasPedagogicalAccess).toBe(false);
    expect((me.body as any).user.isMinor).toBe(true);
    expect((me.body as any).profile).not.toHaveProperty('cpf');

    // Exportação LGPD funciona sem assinatura ativa
    const exp = auth.exportMe(user);
    expect(exp.status).toBe(200);
    expect((exp.body as any).account.email).toBe('menor@nexo.edu.br');

    // Exclusão definitiva LGPD remove conta e sessões
    expect(auth.deleteMe(user).status).toBe(204);
    expect(auth.authenticate(`Bearer ${token}`)).toBeNull();
  });
});
