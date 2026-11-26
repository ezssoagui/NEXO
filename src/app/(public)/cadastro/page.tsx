'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (done) {
    return (
      <Card className="mx-auto max-w-md p-6">
        <h1 className="mb-2 text-2xl font-semibold">Confirme seu e-mail</h1>
        <p className="text-muted">Enviamos um link de confirmação para <strong>{email}</strong>. Após confirmar, entre para concluir o cadastro.</p>
        <Link href="/entrar" className="mt-4 inline-block text-primary">Ir para o login</Link>
      </Card>
    );
  }
  return (
    <Card className="mx-auto max-w-md p-6">
      <h1 className="mb-1 text-2xl font-semibold">Criar conta</h1>
      <p className="mb-4 text-sm text-muted">Pedimos apenas o essencial. Nome, ano do ENEM e data de nascimento vêm no próximo passo.</p>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setError(null);
        try {
          const r = await api<{ needsVerification: boolean; signedIn: boolean }>('/api/auth/signup', { body: { email, password } });
          if (r.signedIn) { router.push('/onboarding'); router.refresh(); return; }
          setDone(true);
        } catch (err) { setError(err instanceof ApiError ? err.message : 'Falha no cadastro.'); } finally { setBusy(false); }
      }}>
        <Input label="E-mail" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Senha" name="password" type="password" autoComplete="new-password" required minLength={10} hint="Mínimo de 10 caracteres, com letras e números."
          value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={busy} className="w-full">Criar conta</Button>
      </form>
      <p className="mt-4 text-sm">Já tem conta? <Link href="/entrar" className="text-primary">Entrar</Link></p>
    </Card>
  );
}
