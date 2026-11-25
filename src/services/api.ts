/**
 * Cliente HTTP autenticado do NEXO V1 (com tratamento explícito de 401, 402 subscription/quota e 503 IA).
 */
const TOKEN_KEY = 'nexo_v1_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore storage errors */
  }
}

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
  message?: string;
}

export async function apiRequest<T = any>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = getAuthToken();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  try {
    const res = await fetch(path, { ...init, headers });
    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!res.ok) {
      const proxyDown = res.status >= 500 && !body;
      return {
        ok: false,
        status: res.status,
        data: body,
        error: proxyDown ? 'backend_offline' : (body?.error ?? 'request_failed'),
        message: proxyDown
          ? 'Backend local (porta 8787) não está rodando. Execute `npm run server` em outro terminal.'
          : (body?.message ?? `Erro HTTP ${res.status}`),
      };
    }
    return { ok: true, status: res.status, data: body as T };
  } catch {
    return {
      ok: false,
      status: 0,
      data: null as any,
      error: 'network_error',
      message: 'Servidor local indisponível. Execute `npm run server` na porta 8787.',
    };
  }
}

export interface OfficialEnemQuestionDTO {
  id: string;
  year: number;
  questionIndex: number;
  bookletColor: string;
  area: 'LC' | 'CH' | 'CN' | 'MT';
  discipline: string;
  language: 'ingles' | 'espanhol' | null;
  skillId: string | null;
  inepItemCode: number | null;
  triA: number | null;
  triB: number | null;
  triC: number | null;
  contextMd: string;
  alternativesIntro: string;
  alternatives: { letter: 'A' | 'B' | 'C' | 'D' | 'E'; text: string; assetUrl?: string | null }[];
  correctAlternative: 'A' | 'B' | 'C' | 'D' | 'E' | 'ANULADA';
  assets: string[];
  hasImages: boolean;
  status: 'active' | 'annulled' | 'under_review';
  source: 'official_enem' | 'ai_generated_fallback';
}

export interface EnemCatalogPageDTO {
  items: OfficialEnemQuestionDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface EnemYearsSummaryDTO {
  years: { year: number; count: number }[];
  total: number;
  withSkillCount?: number;
  withTriCount?: number;
}
