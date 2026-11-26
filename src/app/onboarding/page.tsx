import { redirect } from 'next/navigation';
import { currentUser } from '@/server/auth';
import { asService } from '@/server/db';
import { requiredDocuments } from '@/server/services/account';
import { OnboardingForm } from './form';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect('/entrar');
  if (user.onboarded) redirect('/inicio');
  const docs = await asService((tx) => requiredDocuments(tx));
  return (
    <main id="conteudo" className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Bem-vindo(a) ao NEXO</h1>
      <p className="mb-6 mt-1 text-muted">Só o essencial para personalizar seu estudo. Você não precisa fazer diagnóstico nem seguir cronograma.</p>
      <OnboardingForm documents={docs} />
    </main>
  );
}
