import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/server/auth';
import { AdminMfaGate } from './mfa-gate';

export const dynamic = 'force-dynamic';

const NAV: [string, string][] = [
  ['/admin', 'Visão geral'], ['/admin/usuarios', 'Usuários'], ['/admin/conteudo', 'Conteúdos'], ['/admin/importacao', 'Importação'],
  ['/admin/ia', 'IA'], ['/admin/financeiro', 'Financeiro'], ['/admin/monitoramento', 'Monitoramento'], ['/admin/feedback', 'Feedback'], ['/admin/configuracoes', 'Configurações'],
];

/** Painel administrativo (12.3): papel admin + MFA obrigatório (13.3). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/entrar?voltar=/admin');
  if (!user.isAdmin) notFound();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="font-bold text-primary">NEXO · Administração</Link>
          <Link href="/inicio" className="text-sm text-muted">Voltar ao app</Link>
        </div>
        {user.aal === 'aal2' && (
          <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2" aria-label="Administração">
            {NAV.map(([href, label]) => <Link key={href} href={href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-text">{label}</Link>)}
          </nav>
        )}
      </header>
      <main id="conteudo" className="mx-auto max-w-7xl px-4 py-6">{user.aal === 'aal2' ? children : <AdminMfaGate />}</main>
    </div>
  );
}
