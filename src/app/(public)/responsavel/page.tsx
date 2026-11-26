'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button, Card } from '@/components/ui';

/** Consentimento do responsável para menores (13.2). Fluxo a validar juridicamente antes do piloto. */
function Guardian() {
  const token = useSearchParams().get('token') ?? '';
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const decide = async (decision: 'granted' | 'revoked') => {
    setBusy(true);
    try { await api('/api/guardian', { body: { token, decision } }); setResult(decision === 'granted' ? 'Consentimento registrado. Obrigado!' : 'Recusa registrada.'); }
    catch (e) { setResult(e instanceof ApiError ? e.message : 'Falha.'); } finally { setBusy(false); }
  };
  return (
    <Card className="mx-auto max-w-lg p-6">
      <h1 className="mb-2 text-2xl font-semibold">Autorização do responsável</h1>
      <p className="text-muted">Um estudante menor de 18 anos indicou você como responsável no NEXO, plataforma de estudos para o ENEM. Leia os <Link className="text-primary" href="/legal/terms">Termos</Link> e a <Link className="text-primary" href="/legal/privacy">Política de Privacidade</Link>.</p>
      {result ? <p className="mt-4 font-medium">{result}</p> : (
        <div className="mt-4 flex gap-2">
          <Button loading={busy} disabled={!token} onClick={() => decide('granted')}>Autorizo</Button>
          <Button variant="secondary" loading={busy} disabled={!token} onClick={() => decide('revoked')}>Não autorizo</Button>
        </div>
      )}
    </Card>
  );
}

export default function GuardianPage() {
  return <Suspense><Guardian /></Suspense>;
}
