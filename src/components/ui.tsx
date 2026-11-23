import { useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { FlaskConical, X } from 'lucide-react';
import { useStore } from '../store/useStore';

export const cx = clsx;

export function Card({ children, className, ...p }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('card animate-fadeUp', className)} {...p}>{children}</div>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>{subtitle && <p className="muted mt-1 max-w-2xl text-sm sm:text-base">{subtitle}</p>}</div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function DemoBadge({ label = 'Demonstração', title }: { label?: string; title?: string }) {
  return <span title={title ?? 'Funcionalidade simulada localmente, sem IA real ou serviço externo.'} className="chip border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"><FlaskConical size={12} aria-hidden />{label}</span>;
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'mint' | 'navy' | 'amber' | 'red' | 'violet' | 'sky' }) {
  const t = { slate: 'bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-300', mint: 'bg-mint-100 text-mint-800 dark:bg-mint-500/15 dark:text-mint-300', navy: 'bg-navy-100 text-navy-800 dark:bg-navy-700 dark:text-navy-100', amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300', red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', sky: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' }[tone];
  return <span className={cx('chip', t)}>{children}</span>;
}

export function Progress({ value, className, color = 'bg-mint-500', label, hex }: { value: number; className?: string; color?: string; label?: string; hex?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return <div className={cx('h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-navy-800', className)} role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}><div className={cx('h-full rounded-full transition-all duration-500', !hex && color)} style={{ width: `${v * 100}%`, background: hex }} /></div>;
}

export function Ring({ value, size = 64, stroke = 7, children, color = '#14b88d' }: { value: number; size?: number; stroke?: number; children?: ReactNode; color?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden><circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-slate-200 dark:stroke-navy-800" /><circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" stroke={color} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: 'stroke-dashoffset .6s' }} /></svg>
      <div className="absolute text-center text-sm font-bold">{children}</div>
    </div>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <div className="card flex items-start gap-3 !p-4">
      {icon && <div className="rounded-xl bg-navy-50 p-2 text-navy-700 dark:bg-navy-800 dark:text-mint-300">{icon}</div>}
      <div className="min-w-0"><div className="muted text-xs font-medium">{label}</div><div className="font-display text-xl font-bold text-navy-900 dark:text-white">{value}</div>{hint && <div className="muted text-xs">{hint}</div>}</div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-navy-900">
      {tabs.map((t) => <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cx('whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition', value === t.id ? 'bg-white text-navy-900 shadow-sm dark:bg-navy-700 dark:text-white' : 'text-slate-600 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white')}>{t.label}</button>)}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); if (open) window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-navy-900 sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-lg font-bold">{title}</h2><button className="btn-ghost btn-sm" onClick={onClose} aria-label="Fechar"><X size={16} /></button></div>
        {children}
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  const [show, setShow] = useState(false);
  useEffect(() => { if (toast) { setShow(true); const t = setTimeout(() => setShow(false), 3200); return () => clearTimeout(t); } }, [toast]);
  if (!toast || !show) return null;
  return <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 animate-fadeUp rounded-xl bg-navy-900 px-4 py-3 text-sm font-medium text-white shadow-lg lg:bottom-6">{toast.msg}</div>;
}

/** Renderizador mínimo: **negrito** e quebras de linha. */
export function Rich({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cx('prose-nexo', className)}>
      {text.split(/\n\n+/).map((para, i) => (
        <p key={i}>{para.split('\n').map((line, j) => <span key={j}>{j > 0 && <br />}{line.split(/(\*\*[^*]+\*\*)/).map((part, k) => part.startsWith('**') ? <strong key={k}>{part.slice(2, -2)}</strong> : part)}</span>)}</p>
      ))}
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-navy-700"><div className="font-semibold">{title}</div>{text && <p className="muted mt-1 text-sm">{text}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="9" fill="#112142" /><path d="M9 23V9l14 14V9" stroke="#34d3a6" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span className="font-display text-lg font-extrabold tracking-tight text-navy-900 dark:text-white">NEXO</span>
    </div>
  );
}
