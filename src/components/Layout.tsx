import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Route as RouteIcon, BookOpen, ListChecks, RefreshCw, PenLine, Timer, MessageSquare, LineChart, Settings, Menu, X, Moon, Sun, Lock } from 'lucide-react';
import { useAiLock, useStore } from '../store/useStore';
import { Logo, cx, Toast } from './ui';
import AIStatusBadge from './AIStatusBadge';

export const NAV = [
  { to: '/inicio', label: 'Início', icon: Home },
  { to: '/percurso', label: 'Meu percurso', icon: RouteIcon },
  { to: '/conteudos', label: 'Conteúdos', icon: BookOpen },
  { to: '/questoes', label: 'Questões', icon: ListChecks },
  { to: '/revisoes', label: 'Revisões', icon: RefreshCw },
  { to: '/redacao', label: 'Redação', icon: PenLine },
  { to: '/simulados', label: 'Simulados', icon: Timer },
  { to: '/professor', label: 'Professor de IA', icon: MessageSquare },
  { to: '/desempenho', label: 'Meu desempenho', icon: LineChart },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];
const MOBILE = [['/inicio', 'Início'], ['/percurso', 'Percurso'], ['/questoes', 'Questões'], ['/revisoes', 'Revisões']] as const;

export default function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false); const loc = useLocation(); const nav = useNavigate();
  const demo = useStore((s) => s.demo); const dark = useStore((s) => s.settings.dark); const setSetting = useStore((s) => s.setSetting); const logout = useStore((s) => s.logout);
  const lock = useAiLock();
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  const items = (
    <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: I }) => (
        <NavLink key={to} to={to} className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors', isActive ? 'bg-ink-100 font-medium text-ink-900 dark:bg-ink-800 dark:text-white' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-900 dark:hover:text-white')}>
          <I size={17} strokeWidth={1.75} aria-hidden />{label}{to === '/professor' && lock.locked && <Lock size={13} className="ml-auto text-ink-400" aria-label="Indisponível durante a resolução" />}
        </NavLink>
      ))}
    </nav>
  );
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Pular para o conteúdo</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink-200 bg-white px-3 py-5 dark:border-ink-800 dark:bg-ink-950 lg:flex">
        <button onClick={() => nav('/inicio')} className="mb-6 px-3 text-left" aria-label="NEXO, ir para o início"><Logo /></button>
        <div className="flex-1 overflow-y-auto">{items}</div>
        <div className="flex items-center justify-between px-3 pt-4"><AIStatusBadge /><ThemeButton dark={dark} onClick={() => setSetting('dark', !dark)} /></div>
      </aside>
      {open && <div className="fixed inset-0 z-40 bg-ink-950/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cx('fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white px-3 py-5 transition-transform dark:bg-ink-950 lg:hidden', open ? 'translate-x-0 shadow-xl' : 'invisible -translate-x-full')} aria-hidden={!open}>
        <div className="mb-5 flex items-center justify-between px-3"><Logo /><button className="btn-quiet" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={18} /></button></div>
        <div className="flex-1 overflow-y-auto">{items}</div><div className="px-3 pt-4"><AIStatusBadge /></div>
      </aside>
      <div className="lg:pl-60">
        {demo && <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"><span><strong>Dados demonstrativos.</strong> Este histórico é fictício.</span><button className="underline" onClick={() => { logout(); nav('/'); }}>Sair da demonstração</button></div>}
        <header className="flex items-center gap-3 border-b border-ink-200 px-4 py-3 dark:border-ink-800 lg:hidden">
          <button className="btn-quiet" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button><Logo /><span className="ml-auto"><ThemeButton dark={dark} onClick={() => setSetting('dark', !dark)} /></span>
        </header>
        <main id="main" className="mx-auto max-w-5xl px-4 pb-28 pt-8 sm:px-8 lg:pb-16 lg:pt-12">{children}</main>
      </div>
      <nav aria-label="Navegação rápida" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-ink-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-ink-800 dark:bg-ink-950 lg:hidden">
        {MOBILE.map(([to, label]) => { const I = NAV.find((n) => n.to === to)!.icon; return <NavLink key={to} to={to} className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2 text-[11px]', isActive ? 'font-medium text-brand-700 dark:text-brand-300' : 'text-ink-500')}><I size={19} strokeWidth={1.75} aria-hidden />{label}</NavLink>; })}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-ink-500"><Menu size={19} strokeWidth={1.75} aria-hidden />Mais</button>
      </nav>
      <Toast />
    </div>
  );
}
const ThemeButton = ({ dark, onClick }: { dark: boolean; onClick: () => void }) => <button className="btn-quiet" onClick={onClick} aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button>;
