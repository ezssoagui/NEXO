import { useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { DimStatus, DomainState } from '../types';
import { STATE_LABEL } from '../engine/domain';

export const cx = clsx;

export function Card({ children, className, ...p }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('card', className)} {...p}>{children}</div>;
}
export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-semibold">{title}</h1>{subtitle && <p className="muted mt-1 max-w-2xl text-sm">{subtitle}</p>}</div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
type Tone = 'slate' | 'brand' | 'green' | 'amber' | 'red';
export function Badge({ children, tone = 'slate', title }: { children: ReactNode; tone?: Tone; title?: string }) {
  const t = { slate: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300', brand: 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200', green: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300', amber: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300', red: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300' }[tone];
  return <span className={cx('chip', t)} title={title}>{children}</span>;
}
export const stateTone = (s: DomainState): Tone => ({ nao_avaliado: 'slate', em_aprendizagem: 'amber', provisorio: 'brand', consolidado: 'green' } as const)[s];
export const StateBadge = ({ state }: { state: DomainState }) => <Badge tone={stateTone(state)}>{STATE_LABEL[state]}</Badge>;
export const dimDot = (s: DimStatus) => ({ sem_evidencia: 'bg-ink-200 dark:bg-ink-700', parcial: 'bg-amber-400', demonstrada: 'bg-emerald-500', negativa: 'bg-red-400' }[s]);

export function Progress({ value, className, label, color = 'bg-brand-500' }: { value: number; className?: string; label?: string; color?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800', className)} role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}><div className={cx('h-full rounded-full transition-all', color)} style={{ width: `${v * 100}%` }} /></div>;
}
/** Indicador compacto: valor, rótulo e uma linha de contexto. */
export function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return <div className="min-w-0"><div className="muted text-xs">{label}</div><div className="mt-0.5 text-xl font-semibold text-ink-900 dark:text-white">{value}</div>{hint && <div className="muted mt-0.5 text-xs">{hint}</div>}</div>;
}
export const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx('mb-6 flex gap-5 overflow-x-auto border-b border-ink-200 dark:border-ink-800', className)}>
      {tabs.map((t) => <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cx('-mb-px whitespace-nowrap border-b-2 pb-2.5 text-sm font-medium transition-colors', value === t.id ? 'border-brand-600 text-ink-900 dark:border-brand-400 dark:text-white' : 'border-transparent text-ink-500 hover:text-ink-800 dark:hover:text-ink-200')}>{t.label}</button>)}
    </div>
  );
}
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); if (open) window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-ink-900 sm:max-w-lg sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-base font-semibold">{title}</h2><button className="btn-quiet" onClick={onClose} aria-label="Fechar"><X size={16} /></button></div>
        {children}
      </div>
    </div>
  );
}
export function Toast() {
  const toast = useStore((s) => s.toast); const [show, setShow] = useState(false);
  useEffect(() => { if (!toast) return; setShow(true); const t = setTimeout(() => setShow(false), 3200); return () => clearTimeout(t); }, [toast]);
  if (!toast || !show) return null;
  return <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-[60] w-max max-w-[90vw] -translate-x-1/2 animate-fadeUp rounded-lg bg-ink-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-ink-100 dark:text-ink-900 lg:bottom-6">{toast.msg}</div>;
}
/** Renderizador mínimo: **negrito** e quebras de linha. */
export function Rich({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cx('prose-nexo', className)}>
      {text.split(/\n\n+/).map((para, i) => <p key={i}>{para.split('\n').map((line, j) => <span key={j}>{j > 0 && <br />}{line.split(/(\*\*[^*]+\*\*)/).map((part, k) => (part.startsWith('**') ? <strong key={k}>{part.slice(2, -2)}</strong> : part))}</span>)}</p>)}
    </div>
  );
}
export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-ink-300 px-6 py-10 text-center dark:border-ink-700"><div className="font-medium">{title}</div>{text && <p className="muted mx-auto mt-1 max-w-md text-sm">{text}</p>}{action && <div className="mt-4 flex justify-center gap-2">{action}</div>}</div>;
}
/** Identificação obrigatória de conteúdo simulado ou demonstrativo. */
export const DemoTag = ({ children = 'Demonstração', title }: { children?: ReactNode; title?: string }) => <span title={title} className="chip border border-amber-300 text-amber-800 dark:border-amber-500/40 dark:text-amber-300">{children}</span>;
export function Logo({ size = 26 }: { size?: number }) {
  return <span className="flex items-center gap-2"><svg width={size} height={size} viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="8" className="fill-brand-600" /><path d="M9 23V9l14 14V9" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg><span className="text-base font-semibold tracking-tight text-ink-900 dark:text-white">NEXO</span></span>;
}
export function Choice({ active, onClick, children, disabled, role = 'radio' }: { active?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; role?: string }) {
  return <button type="button" role={role} aria-checked={active} disabled={disabled} onClick={onClick} className={cx('rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60', active ? 'border-brand-500 bg-brand-50 text-ink-900 dark:bg-brand-500/15 dark:text-white' : 'border-ink-200 hover:border-ink-300 dark:border-ink-700 dark:hover:border-ink-600')}>{children}</button>;
}
