'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(params.get('erro') ? 'Não foi possível entrar com o Google.' : null);
  const [busy, setBusy] = useState(false);
  return (
    <Card className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">Entrar</h1>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setError(null);
        try {
          await api('/api/auth/login', { body: { email, password } });
          const back = params.get('voltar');
          router.push(back && back.startsWith('/') && !back.startsWith('//') ? back : '/inicio');
          router.refresh();
        } catch (err) { setError(err instanceof ApiError ? err.message : 'Falha ao entrar.'); } finally { setBusy(false); }
      }}>
        <Input label="E-mail" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Senha" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={busy} className="w-full">Entrar</Button>
      </form>
      <a href="/api/auth/google" className="mt-3 flex h-10 w-full items-center justify-center rounded-lg border border-border text-sm font-medium hover:bg-surface-2">Entrar com Google</a>
      <div className="mt-4 flex justify-between text-sm">
        <Link href="/recuperar-senha" className="text-primary">Esqueci a senha</Link>
        <Link href="/cadastro" className="text-primary">Criar conta</Link>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
