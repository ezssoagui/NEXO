'use client';

import { useCallback, useEffect, useState } from 'react';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

/** Cliente HTTP da API própria (mesma origem, cookie httpOnly de sessão). */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  const data = (await res.json().catch(() => ({}))) as { error?: { code: string; message: string; details?: unknown } } & T;
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/api/auth/')) {
      // Recarga completa intencional ao expirar a sessão (limpa estado do cliente).
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`${window.location.origin}/entrar?voltar=${encodeURIComponent(window.location.pathname)}`);
    }
    throw new ApiError(res.status, data.error?.code ?? 'error', data.error?.message ?? 'Não foi possível concluir a operação.', data.error?.details);
  }
  return data;
}

/** Busca com estados de carregamento, erro e recarga (sem dados fictícios). */
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ key: string | null; path: string | null; data: T | null; error: ApiError | null }>({ key: null, path: null, data: null, error: null });
  const key = path ? `${path}#${version}` : null;
  useEffect(() => {
    if (!path || !key) return;
    let cancelled = false;
    api<T>(path).then(
      (d) => { if (!cancelled) setState({ key, path, data: d, error: null }); },
      (e) => { if (!cancelled) setState((s) => ({ key, path, data: s.path === path ? s.data : null, error: e instanceof ApiError ? e : new ApiError(0, 'network', 'Falha de conexão.') })); },
    );
    return () => { cancelled = true; };
  }, [path, key]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback((d: T) => setState((s) => ({ ...s, data: d })), []);
  // Mantém os dados do mesmo caminho durante recargas; nunca exibe dados de outro caminho.
  const samePath = state.path === path;
  return { data: samePath ? state.data : null, error: state.key === key ? state.error : null, loading: Boolean(path) && state.key !== key, reload, setData };
}

export function uuid(): string {
  return crypto.randomUUID();
}

export const AREA_NAMES: Record<string, string> = {
  LC: 'Linguagens', CH: 'Ciências Humanas', CN: 'Ciências da Natureza', MT: 'Matemática',
};
export const DIFFICULTY_NAMES: Record<string, string> = { easy: 'Fácil', medium: 'Média', hard: 'Difícil' };
export const CATEGORY_NAMES: Record<string, string> = { learn: 'Aprender', improve: 'Melhorar', deepen: 'Aprofundar', review: 'Revisar' };
export const STATE_NAMES: Record<string, string> = {
  not_assessed: 'Não avaliado', learning: 'Em aprendizagem', provisional: 'Provisório', consolidated: 'Consolidado',
};

export function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${Math.round(v * 10) / 10}%`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
