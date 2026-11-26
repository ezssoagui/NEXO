import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { currentUser } from '@/server/auth';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/entrar');
  if (!user.onboarded) redirect('/onboarding');
  return <AppShell user={{ email: user.email, isAdmin: user.isAdmin }}>{children}</AppShell>;
}
