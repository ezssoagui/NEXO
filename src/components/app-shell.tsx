'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { BarChart3, BookOpen, ClipboardList, Home, ListChecks, LogOut, MessageSquarePlus, Monitor, Moon, PenLine, Search, Settings, Shield, Sun, User } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Modal, Select, Textarea, cn } from './ui';
import { useToast } from './toast';

const NAV = [
  { href: '/inicio', label: 'Início', icon: Home },
  { href: '/estudar', label: 'Estudar', icon: BookOpen },
  { href: '/questoes', label: 'Questões', icon: ListChecks },
  { href: '/simulados', label: 'Simulados', icon: ClipboardList },
  { href: '/redacao', label: 'Redação', icon: PenLine },
  { href: '/desempenho', label: 'Desempenho', icon: BarChart3 },
];

type ThemePref = 'light' | 'dark' | 'system';

export function applyTheme(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme-pref', pref);
  document.cookie = `nexo_theme=${pref}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new Event('nexo-theme'));
}

function subscribeTheme(cb: () => void) {
  window.addEventListener('nexo-theme', cb);
  return () => window.removeEventListener('nexo-theme', cb);
}
const themeSnapshot = () => (document.documentElement.getAttribute('data-theme-pref') as ThemePref | null) ?? 'system';

function ThemeToggle() {
  const pref = useSyncExternalStore(subscribeTheme, themeSnapshot, () => 'system' as ThemePref);
  const next: Record<ThemePref, ThemePref> = { light: 'dark', dark: 'system', system: 'light' };
  const Icon = pref === 'light' ? Sun : pref === 'dark' ? Moon : Monitor;
  const label = { light: 'Tema claro', dark: 'Tema escuro', system: 'Tema automático' }[pref];
  return (
    <button
      className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text"
      aria-label={`${label}. Alternar tema`}
      title={label}
      onClick={() => {
        const n = next[pref];
        applyTheme(n);
        void api('/api/me/preferences', { method: 'PATCH', body: { theme: n } }).catch(() => undefined);
      }}
    >
      <Icon className="size-5" />
    </button>
  );
}

interface SearchResults {
  subtopics: { id: string; name: string; topic: string }[];
  lessons: { id: string; title: string; kind: string }[];
  questions: { id: string; area_code: string; year: number | null; snippet: string }[];
  flashcards: { id: string; front: string; deck_id: string }[];
  errors: { id: string; question_id: string; snippet: string }[];
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div className="mt-3"><div className="mb-1 text-xs font-semibold uppercase text-muted">{title}</div><ul className="space-y-1">{children}</ul></div>;
}

function SearchItem({ href, children, onClose }: { href: string; children: ReactNode; onClose: () => void }) {
  return <li><Link href={href} onClick={onClose} className="block rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">{children}</Link></li>;
}

/** Busca global discreta (5.14) — metadados armazenados, sem IA. */
function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ q: string; res: SearchResults | null } | null>(null);
  const term = q.trim();
  useEffect(() => {
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      try { setFound({ q: term, res: await api<SearchResults>(`/api/search?q=${encodeURIComponent(term)}`) }); } catch { setFound({ q: term, res: null }); }
    }, 300);
    return () => clearTimeout(t);
  }, [term]);
  const res = term.length >= 2 && found?.q === term ? found.res : null;
  const loading = term.length >= 2 && found?.q !== term;
  return (
    <Modal open={open} onClose={onClose} title="Buscar">
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Conteúdos, aulas, questões, flashcards…" aria-label="Termo de busca"
        className="h-11 w-full rounded-lg border border-border bg-surface px-3" />
      {loading && <p className="mt-3 text-sm text-muted">Buscando…</p>}
      {res && (
        <div>
          {res.subtopics.length > 0 && <Section title="Conteúdos">{res.subtopics.map((s) => <SearchItem onClose={onClose} key={s.id} href={`/estudar/conteudo/${s.id}`}>{s.name} <span className="text-muted">· {s.topic}</span></SearchItem>)}</Section>}
          {res.lessons.length > 0 && <Section title="Aulas e materiais">{res.lessons.map((l) => <SearchItem onClose={onClose} key={l.id} href={`/estudar/aula/${l.id}`}>{l.title}</SearchItem>)}</Section>}
          {res.questions.length > 0 && <Section title="Questões">{res.questions.map((x) => <SearchItem onClose={onClose} key={x.id} href={`/questoes/${x.id}`}>{x.snippet}…</SearchItem>)}</Section>}
          {res.flashcards.length > 0 && <Section title="Flashcards">{res.flashcards.map((f) => <SearchItem onClose={onClose} key={f.id} href={`/estudar/flashcards?deck=${f.deck_id}`}>{f.front}</SearchItem>)}</Section>}
          {res.errors.length > 0 && <Section title="Caderno de erros">{res.errors.map((e) => <SearchItem onClose={onClose} key={e.id} href={`/questoes/${e.question_id}`}>{e.snippet}…</SearchItem>)}</Section>}
          {Object.values(res).every((v) => v.length === 0) && <p className="mt-3 text-sm text-muted">Nenhum resultado.</p>}
        </div>
      )}
    </Modal>
  );
}

/** Feedback discreto e opcional (14.7). */
export function FeedbackButton({ entityType, entityId, label = 'Enviar feedback', defaultKind = 'suggestion' }: { entityType?: string; entityId?: string; label?: string; defaultKind?: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(defaultKind);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-text"><MessageSquarePlus className="size-4" />{label}</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Feedback">
        <div className="space-y-3">
          <Select label="Tipo" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="question_error">Erro em questão</option>
            <option value="evaluation_issue">Correção inadequada</option>
            <option value="technical">Erro técnico</option>
            <option value="suggestion">Sugestão</option>
          </Select>
          <Textarea label="Mensagem" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
          <Button loading={busy} disabled={message.trim().length < 3} onClick={async () => {
            setBusy(true);
            try {
              await api('/api/feedback', { body: { kind, message, entityType, entityId } });
              toast('success', 'Obrigado! Seu feedback foi enviado.');
              setOpen(false); setMessage('');
            } catch (e) { toast('error', (e as Error).message); } finally { setBusy(false); }
          }}>Enviar</Button>
        </div>
      </Modal>
    </>
  );
}

export function AppShell({ children, user }: { children: ReactNode; user: { email: string; isAdmin: boolean } }) {
  const path = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Durante sessão/simulado/redação: interface sem distrações (10.5/9.9).
  const focusMode = /^\/(estudar\/sessao|simulados\/prova|redacao\/escrever)/.test(path);
  if (focusMode) return <main id="conteudo" className="mx-auto max-w-5xl px-4 py-4">{children}</main>;
  return (
    <div className="md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface p-3 md:flex" aria-label="Barra lateral">
        <Link href="/inicio" className="mb-6 px-2 text-xl font-bold tracking-tight text-primary">NEXO</Link>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Navegação principal">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={path.startsWith(href) ? 'page' : undefined}
              className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium', path.startsWith(href) ? 'bg-primary-soft text-primary-strong' : 'text-muted hover:bg-surface-2 hover:text-text')}>
              <Icon className="size-5" aria-hidden /> {label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1 border-t border-border pt-3">
          {user.isAdmin && <Link href="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2"><Shield className="size-5" /> Administração</Link>}
          <Link href="/perfil" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2"><User className="size-5" /> Perfil</Link>
          <Link href="/configuracoes" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2"><Settings className="size-5" /> Configurações</Link>
          <button onClick={async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined); router.push('/entrar'); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2"><LogOut className="size-5" /> Sair</button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-bg/90 px-4 py-2 backdrop-blur">
          <Link href="/inicio" className="text-lg font-bold text-primary md:hidden">NEXO</Link>
          <div className="flex flex-1 justify-end gap-1">
            <button onClick={() => setSearchOpen(true)} aria-label="Buscar (Ctrl+K)" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text"><Search className="size-5" /></button>
            <ThemeToggle />
            <Link href="/perfil" aria-label="Perfil" className="rounded-lg p-2 text-muted hover:bg-surface-2 md:hidden"><User className="size-5" /></Link>
            <Link href="/configuracoes" aria-label="Configurações" className="rounded-lg p-2 text-muted hover:bg-surface-2 md:hidden"><Settings className="size-5" /></Link>
          </div>
        </header>
        <main id="conteudo" className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:pb-10">{children}</main>
        <footer className="mx-auto hidden max-w-6xl justify-between px-4 pb-6 text-xs text-muted md:flex">
          <div className="flex gap-3"><Link href="/legal/terms">Termos</Link><Link href="/legal/privacy">Privacidade</Link></div>
          <FeedbackButton />
        </footer>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-border bg-surface md:hidden" aria-label="Navegação inferior">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={path.startsWith(href) ? 'page' : undefined}
            className={cn('flex flex-col items-center gap-0.5 py-2 text-[10px]', path.startsWith(href) ? 'text-primary' : 'text-muted')}>
            <Icon className="size-5" aria-hidden /> {label}
          </Link>
        ))}
      </nav>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
