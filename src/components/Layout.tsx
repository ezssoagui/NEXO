import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Route as RouteIcon, ListChecks, Bot, PenLine, Layers, Timer, LineChart, User, Menu, X, Moon, Sun, Shield, Sparkles, LogOut } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Logo, cx, Toast } from './ui';
import { levelInfo, totalXP } from '../engine/gamification';
import AIStatusBadge from './AIStatusBadge';

export const NAV = [
  { to: '/inicio', label: 'Início', icon: Home },
  { to: '/trilha', label: 'Minha trilha', icon: RouteIcon },
  { to: '/questoes', label: 'Questões ENEM', icon: ListChecks },
  { to: '/tutor', label: 'IA Tutora', icon: Bot },
  { to: '/redacao', label: 'Redação', icon: PenLine },
  { to: '/flashcards', label: 'Flashcards', icon: Layers },
  { to: '/simulados', label: 'Simulados', icon: Timer },
  { to: '/desempenho', label: 'Meu desempenho', icon: LineChart },
  { to: '/perfil', label: 'Perfil e LGPD', icon: User },
];
const MOBILE = ['/inicio', '/questoes', '/tutor', '/flashcards'];

export default function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { profile, xpEvents, settings, setSetting, plan, role, loginRole, logout } = useStore();
  const loc = useLocation(); const nav = useNavigate();
  const xp = totalXP(xpEvents); const lv = levelInfo(xp);
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => { document.documentElement.classList.toggle('dark', settings.dark); }, [settings.dark]);

  const roleNav = role === 'admin' ? [{ to: '/admin', label: 'Administração', icon: Shield }] : [];
  const items = [...roleNav, ...NAV];

  const NavItems = () => (
    <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon: I }) => (
        <NavLink key={to} to={to} className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition', isActive ? 'bg-mint-500/15 text-navy-900 dark:text-mint-300' : 'text-slate-600 hover:bg-slate-100 hover:text-navy-900 dark:text-slate-400 dark:hover:bg-navy-800 dark:hover:text-white')}>
          <I size={18} aria-hidden />{label}
        </NavLink>
      ))}
      <NavLink to="/planos" className={({ isActive }) => cx('mt-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold', isActive ? 'bg-navy-800 text-white' : 'bg-navy-50 text-navy-800 hover:bg-navy-100 dark:bg-navy-800 dark:text-mint-200')}>
        <Sparkles size={18} aria-hidden />{plan === 'plus' ? 'NEXO Plus ativo' : 'Conhecer o Plus'}
      </NavLink>
    </nav>
  );

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Pular para o conteúdo</a>
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-5 dark:border-navy-800 dark:bg-navy-950 lg:flex">
        <button onClick={() => nav('/inicio')} className="mb-6 px-2 text-left"><Logo /><div className="muted mt-1 text-[11px] tracking-wide">Aprender. Evoluir. Conquistar.</div></button>
        <div className="flex-1 overflow-y-auto pr-1"><NavItems /></div>
        <RoleSwitch role={role} onChange={(r) => { loginRole(r); nav(r === 'admin' ? '/admin' : '/inicio'); }} />
      </aside>

      {/* Drawer mobile */}
      {open && <div className="fixed inset-0 z-40 bg-navy-950/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cx('fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white px-4 py-5 shadow-xl transition-transform dark:bg-navy-950 lg:hidden', open ? 'translate-x-0' : '-translate-x-full')} aria-hidden={!open}>
        <div className="mb-5 flex items-center justify-between"><Logo /><button className="btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={16} /></button></div>
        <div className="flex-1 overflow-y-auto"><NavItems /></div>
        <RoleSwitch role={role} onChange={(r) => { loginRole(r); nav(r === 'admin' ? '/admin' : '/inicio'); }} />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur dark:border-navy-800 dark:bg-navy-950/85 sm:px-6">
          <button className="btn-ghost btn-sm lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={18} /></button>
          <div className="lg:hidden"><Logo size={26} /></div>
          <span className="chip hidden border border-slate-300 bg-slate-50 text-slate-700 dark:border-navy-600 dark:bg-navy-900 dark:text-slate-300 md:inline-flex">NEXO V1 · 100% ENEM</span><AIStatusBadge />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <NavLink to="/desempenho" className="hidden items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold dark:bg-navy-800 sm:flex" title={`${lv.toNext} XP para o próximo nível`}>
              <span className="text-navy-800 dark:text-mint-300">Nível {lv.level}</span>
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-300 dark:bg-navy-700"><span className="block h-full bg-mint-500" style={{ width: `${lv.progress * 100}%` }} /></span>
              <span className="muted">{xp} XP</span>
            </NavLink>
            <button className="btn-ghost btn-sm" onClick={() => setSetting('dark', !settings.dark)} aria-label={settings.dark ? 'Ativar modo claro' : 'Ativar modo escuro'}>{settings.dark ? <Sun size={16} /> : <Moon size={16} />}</button>
            <NavLink to="/perfil" className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-800 text-sm font-bold text-mint-300" aria-label="Perfil">{profile?.nickname?.[0]?.toUpperCase() ?? '?'}</NavLink>
            <button className="btn-ghost btn-sm hidden sm:inline-flex" onClick={() => { logout(); nav('/'); }} aria-label="Sair"><LogOut size={16} /></button>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12">{children}</main>
      </div>

      {/* Bottom nav mobile */}
      <nav aria-label="Navegação rápida" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-navy-800 dark:bg-navy-950/95 lg:hidden">
        {NAV.filter((n) => MOBILE.includes(n.to)).map(({ to, label, icon: I }) => (
          <NavLink key={to} to={to} className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-mint-600 dark:text-mint-400' : 'text-slate-500')}><I size={20} aria-hidden />{label.split(' ')[0]}</NavLink>
        ))}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500"><Menu size={20} aria-hidden />Mais</button>
      </nav>
      <Toast />
    </div>
  );
}

function RoleSwitch({ role, onChange }: { role: string; onChange: (r: 'student' | 'admin') => void }) {
  return (
    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-navy-800">
      <label htmlFor="role" className="muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">Perfil de acesso (demo)</label>
      <select id="role" className="input !py-2 text-xs" value={role} onChange={(e) => onChange(e.target.value as any)}>
        <option value="student">Estudante</option><option value="admin">Administrador(a)</option>
      </select>
    </div>
  );
}
