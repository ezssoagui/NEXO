'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface Toast { id: number; kind: 'success' | 'error' | 'info'; message: string }
const Ctx = createContext<(kind: Toast['kind'], message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, kind, message }]);
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), 6000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-20 right-4 z-50 flex w-[min(24rem,calc(100%-2rem))] flex-col gap-2 md:bottom-4">
        {items.map((t) => (
          <div key={t.id} role="status" className="pointer-events-auto flex items-start gap-2 rounded-lg border border-border bg-surface p-3 shadow-lg">
            {t.kind === 'error' ? <AlertCircle className="mt-0.5 size-5 shrink-0 text-danger" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />}
            <p className="flex-1 text-sm">{t.message}</p>
            <button aria-label="Fechar aviso" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}><X className="size-4 text-muted" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
