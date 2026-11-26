import Link from 'next/link';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-xl font-bold tracking-tight text-primary">NEXO</Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/planos" className="text-muted hover:text-text">Planos</Link>
          <Link href="/entrar" className="font-medium text-primary">Entrar</Link>
        </nav>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="mx-auto flex w-full max-w-5xl flex-wrap gap-4 px-4 py-6 text-xs text-muted">
        <Link href="/legal/terms">Termos de uso</Link>
        <Link href="/legal/privacy">Privacidade</Link>
        <span>Notas de redação são estimativas, não avaliações oficiais. O NEXO não promete aprovação.</span>
      </footer>
    </div>
  );
}
