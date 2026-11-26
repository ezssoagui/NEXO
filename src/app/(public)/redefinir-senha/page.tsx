'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';

function ResetForm() {
  const token = useSearchParams().get('token_hash') ?? '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">Nova senha</h1>
      {done ? <p>Senha alterada. <Link href="/entrar" className="text-primary">Entrar</Link></p> : (
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setError(null);
          try { await api('/api/auth/password/reset', { body: { token_hash: token, password } }); setDone(true); }
          catch (err) { setError(err instanceof ApiError ? err.message : 'Falha.'); } finally { setBusy(false); }
        }}>
          <Input label="Nova senha" name="password" type="password" autoComplete="new-password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={busy} disabled={!token} className="w-full">Salvar</Button>
        </form>
      )}
    </Card>
  );
}

export default function ResetPage() {
  return <Suspense><ResetForm /></Suspense>;
}
