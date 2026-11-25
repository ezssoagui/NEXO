/**
 * PERSISTÊNCIA NA NUVEM (opcional): conta por apelido + senha no backend da NEXO (SQLite).
 * Sem conta/backend, tudo fica apenas neste navegador — e a interface diz isso.
 * O token de sessão fica só no navegador do aluno e é enviado no cabeçalho Authorization.
 */
import { useStore } from '../store/useStore';

export async function api(path: string, opts: { method?: string; body?: unknown; token?: string; timeoutMs?: number } = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 10000);
  try {
    const res = await fetch(path, { method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'), headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) }, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: ctl.signal });
    const json = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(json?.message ?? (res.status === 404 ? 'Backend da NEXO não encontrado (rode npm run server).' : `Erro ${res.status}`)), { status: res.status });
    return json;
  } catch (e: any) { if (e?.name === 'AbortError') throw new Error('O servidor não respondeu.'); if (e instanceof TypeError) throw new Error('Backend da NEXO não encontrado (rode npm run server).'); throw e; } finally { clearTimeout(t); }
}

const snapshot = () => { const { toast, account, ...rest } = useStore.getState() as any; return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')); };

export async function connect(mode: 'login' | 'register', nickname: string, password: string, adminCode?: string) {
  const r = await api(`/api/auth/${mode}`, { body: { nickname, password, adminCode } });
  const st = useStore.getState();
  st.setAccount({ nickname: r.nickname, token: r.token, role: r.role });
  const remote = await api('/api/learning/state', { token: r.token });
  if (remote?.state && (remote.state.attempts?.length ?? 0) >= st.attempts.length) st.hydrate(remote.state);
  else await push();
  useStore.getState().setAccount({ ...useStore.getState().account!, syncedAt: Date.now() });
  return r;
}
export async function push() {
  const acc = useStore.getState().account; if (!acc) return;
  await api('/api/learning/state', { method: 'PUT', token: acc.token, body: { state: snapshot() } });
}
export async function disconnect() { const acc = useStore.getState().account; if (acc) await api('/api/auth/logout', { token: acc.token, body: {} }).catch(() => undefined); useStore.getState().setAccount(undefined); }
export async function exportServer() { const acc = useStore.getState().account; if (!acc) throw new Error('Sem conta conectada.'); return api('/api/me/export', { token: acc.token }); }
export async function deleteServer() { const acc = useStore.getState().account; if (!acc) return; await api('/api/me', { method: 'DELETE', token: acc.token }); }

let started = false;
/** Sincroniza automaticamente (com atraso) sempre que o estado muda e há conta conectada. */
export function startSync() {
  if (started) return; started = true;
  let timer: ReturnType<typeof setTimeout> | undefined; let last = '';
  useStore.subscribe((s) => {
    if (!s.account) return;
    const sig = [s.attempts.length, s.explanations.length, s.sessions.length, s.pendings.length, s.essayPractice.length, Object.keys(s.cardStates).length, s.essays.reduce((n, e) => n + e.versions.length, 0), s.activities.length].join(':');
    if (sig === last) return;
    last = sig;
    clearTimeout(timer);
    timer = setTimeout(() => push().then(() => { const a = useStore.getState().account; if (a) useStore.getState().setAccount({ ...a, syncedAt: Date.now() }); }).catch((e) => useStore.getState().notify(`Não foi possível sincronizar: ${e.message}`)), 2000);
  });
}
