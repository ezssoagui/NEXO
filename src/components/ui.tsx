'use client';

import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { AlertTriangle, Inbox, Loader2, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...c: (string | false | null | undefined)[]) {
  return twMerge(clsx(c));
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-strong',
  secondary: 'bg-surface border border-border text-text hover:bg-surface-2',
  ghost: 'text-text hover:bg-surface-2',
  danger: 'bg-danger text-white hover:opacity-90',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: 'sm' | 'md' }>(
  function Button({ className, variant = 'primary', loading, size = 'md', disabled, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cn('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4', VARIANTS[variant], className)}
        disabled={disabled || loading}
        {...rest}
      >
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  });

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-border bg-surface p-4', className)} {...rest}>{children}</div>;
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'award'; className?: string }) {
  const tones = {
    neutral: 'bg-surface-2 text-muted', primary: 'bg-primary-soft text-primary-strong', success: 'bg-success-soft text-success',
    warning: 'bg-surface-2 text-warning', danger: 'bg-danger-soft text-danger', award: 'bg-surface-2 text-award',
  };
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string }>(
  function Input({ label, hint, error, id, className, ...rest }, ref) {
    const inputId = id ?? rest.name;
    return (
      <label className="block space-y-1" htmlFor={inputId}>
        {label && <span className="text-sm font-medium">{label}</span>}
        <input ref={ref} id={inputId} aria-invalid={Boolean(error)} aria-describedby={hint ? `${inputId}-hint` : undefined}
          className={cn('h-10 w-full rounded-lg border border-border bg-surface px-3 text-text placeholder:text-muted', error && 'border-danger', className)} {...rest} />
        {hint && <span id={`${inputId}-hint`} className="text-xs text-muted">{hint}</span>}
        {error && <span className="text-xs text-danger" role="alert">{error}</span>}
      </label>
    );
  });

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }>(
  function Textarea({ label, id, className, ...rest }, ref) {
    return (
      <label className="block space-y-1" htmlFor={id ?? rest.name}>
        {label && <span className="text-sm font-medium">{label}</span>}
        <textarea ref={ref} id={id ?? rest.name} className={cn('w-full rounded-lg border border-border bg-surface p-3 text-text placeholder:text-muted', className)} {...rest} />
      </label>
    );
  });

export function Select({ label, children, id, className, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block space-y-1" htmlFor={id ?? rest.name}>
      {label && <span className="text-sm font-medium">{label}</span>}
      <select id={id ?? rest.name} className={cn('h-10 w-full rounded-lg border border-border bg-surface px-3 text-text', className)} {...rest}>{children}</select>
    </label>
  );
}

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-muted" role="status" aria-live="polite">
      <Loader2 className="size-5 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-danger-soft/40 p-4" role="alert">
      <div className="flex items-center gap-2 text-danger"><AlertTriangle className="size-5" aria-hidden /> {message}</div>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Tentar novamente</Button>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-8 text-center text-muted">
      <Inbox className="size-6" aria-hidden />
      <p className="font-medium text-text">{title}</p>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-surface-2 p-1">
      {items.map((i) => (
        <button key={i.value} role="tab" aria-selected={value === i.value} onClick={() => onChange(i.value)}
          className={cn('whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium', value === i.value ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text')}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, label, tone = 'primary' }: { value: number; label: string; tone?: 'primary' | 'success' }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={cn('h-full rounded-full', tone === 'success' ? 'bg-success' : 'bg-primary')} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** Diálogo acessível baseado em <dialog> nativo (foco, Esc). */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-label={title}
      className={cn('m-auto w-[calc(100%-2rem)] rounded-xl border border-border bg-surface p-0 text-text backdrop:bg-black/50', wide ? 'max-w-4xl' : 'max-w-lg')}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        <button onClick={onClose} aria-label="Fechar" className="rounded p-1 hover:bg-surface-2"><X className="size-5" /></button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-4">{children}</div>
    </dialog>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function SyntheticBadge({ show }: { show?: boolean }) {
  if (!show) return null;
  return <Badge tone="warning" className="ml-2">Conteúdo sintético de teste</Badge>;
}
