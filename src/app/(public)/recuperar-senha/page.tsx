'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Card className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">Recuperar senha</h1>
      {sent ? <p className="text-muted">Se existir uma conta com esse e-mail, você receberá um link para redefinir a senha.</p> : (
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true);
          try { await api('/api/auth/password/forgot', { body: { email } }); } catch { /* resposta neutra */ }
          setSent(true); setBusy(false);
        }}>
          <Input label="E-mail" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" loading={busy} className="w-full">Enviar link</Button>
        </form>
      )}
    </Card>
  );
}
