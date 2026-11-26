'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError, useApi } from '@/lib/api';
import { Button, Card, Input, Loading } from '@/components/ui';

/** Etapa obrigatória de MFA (TOTP) antes de qualquer função administrativa. */
export function AdminMfaGate() {
  const router = useRouter();
  const { data, loading } = useApi<{ enrolled: boolean }>('/api/auth/mfa');
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (loading) return <Loading />;
  return (
    <Card className="mx-auto max-w-md space-y-3 p-6">
      <h1 className="text-xl font-semibold">Verificação em duas etapas</h1>
      <p className="text-sm text-muted">A administração exige autenticação multifator.</p>
      {!data?.enrolled && !secret && (
        <Button onClick={async () => { try { const r = await api<{ secret: string }>('/api/auth/mfa', { body: { action: 'enroll' } }); setSecret(r.secret); } catch (e) { setError((e as Error).message); } }}>Configurar autenticador</Button>
      )}
      {secret && <div className="text-sm"><p>Chave para o aplicativo autenticador:</p><code className="block break-all rounded bg-surface-2 p-2" data-testid="totp-secret">{secret}</code></div>}
      {(data?.enrolled || secret) && (
        <form className="space-y-2" onSubmit={async (e) => {
          e.preventDefault(); setError(null);
          try { await api('/api/auth/mfa', { body: { action: 'verify', code } }); router.refresh(); }
          catch (err) { setError(err instanceof ApiError ? err.message : 'Código inválido.'); }
        }}>
          <Input label="Código de 6 dígitos" name="code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
          <Button type="submit">Verificar</Button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </Card>
  );
}
