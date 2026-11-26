'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Loading } from '@/components/ui';

function Confirm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token_hash');
  const type = params.get('type') ?? 'signup';
  const [result, setResult] = useState<'ok' | 'error' | null>(null);
  useEffect(() => {
    if (!token) return;
    api('/api/auth/verify', { body: { token_hash: token, type } })
      .then(() => { setResult('ok'); setTimeout(() => router.push('/onboarding'), 800); })
      .catch(() => setResult('error'));
  }, [token, type, router]);
  const state = !token ? 'error' : result ?? 'loading';
  return (
    <Card className="mx-auto max-w-md p-6">
      {state === 'loading' && <Loading label="Confirmando e-mail…" />}
      {state === 'ok' && <p>E-mail confirmado! Redirecionando…</p>}
      {state === 'error' && <p>Link inválido ou expirado. <Link href="/entrar" className="text-primary">Voltar</Link></p>}
    </Card>
  );
}

export default function ConfirmPage() {
  return <Suspense><Confirm /></Suspense>;
}
