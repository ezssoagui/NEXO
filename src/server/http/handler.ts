import { NextResponse, type NextRequest } from 'next/server';
import { z, type ZodType } from 'zod';
import { env } from '@/config/env';
import { currentUser, type CurrentUser } from '@/server/auth';
import { asService } from '@/server/db';

import { AppError, badRequest, forbidden } from './errors';

export { AppError, badRequest, conflict, forbidden, notFound } from './errors';

type AuthLevel = 'public' | 'user' | 'student' | 'admin';

interface Ctx<B, Q> {
  req: NextRequest;
  user: CurrentUser | null;
  body: B;
  query: Q;
  params: Record<string, string>;
}

interface Opts<B, Q> {
  auth: AuthLevel;
  body?: ZodType<B>;
  query?: ZodType<Q>;
  rateLimit?: { bucket: string; limit: number; windowSeconds: number; by?: 'user' | 'ip' };
}

function clientIp(req: NextRequest): string {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

/** Mutação somente da própria origem (defesa CSRF além de SameSite=Lax + JSON). */
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // requisições server-to-server (webhooks usam rotas próprias)
  try {
    return new URL(origin).host === new URL(env().NEXO_APP_URL).host || new URL(origin).host === req.nextUrl.host;
  } catch {
    return false;
  }
}

/** Multiplicador de limites SOMENTE em ambiente de teste automatizado (E2E cria muitas contas do mesmo IP). */
function rateFactor(): number {
  if (env().NEXO_ENV !== 'test') return 1;
  const f = Number(process.env.NEXO_RATE_LIMIT_FACTOR ?? '1');
  return Number.isFinite(f) && f >= 1 ? f : 1;
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const ok = await asService(async (tx) => {
    const [r] = await tx.query<{ ok: boolean }>('select public.hit_rate_limit($1, $2, $3) as ok', [key, limit * rateFactor(), windowSeconds]);
    return r!.ok;
  });
  if (!ok) throw new AppError(429, 'rate_limited', 'Muitas requisições. Aguarde alguns instantes.');
}

export function route<B = undefined, Q = undefined>(
  opts: Opts<B, Q>,
  fn: (ctx: Ctx<B, Q>) => Promise<unknown>,
) {
  return async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) throw forbidden('Origem não permitida.');
      let user: CurrentUser | null = null;
      if (opts.auth !== 'public') {
        user = await currentUser();
        if (!user) throw new AppError(401, 'unauthenticated', 'Faça login para continuar.');
        if (user.suspended) throw forbidden('Conta suspensa. Entre em contato com o suporte.');
        if (opts.auth === 'student' && !user.onboarded) throw new AppError(403, 'onboarding_required', 'Conclua o cadastro inicial.');
        if (opts.auth === 'admin') {
          if (!user.isAdmin) throw forbidden();
          if (user.aal !== 'aal2') throw new AppError(403, 'mfa_required', 'Autenticação multifator obrigatória para administração.');
        }
      }
      if (opts.rateLimit) {
        const who = opts.rateLimit.by === 'ip' || !user ? `ip:${clientIp(req)}` : `u:${user.id}`;
        await enforceRateLimit(`${opts.rateLimit.bucket}:${who}`, opts.rateLimit.limit, opts.rateLimit.windowSeconds);
      }
      let body = undefined as B;
      if (opts.body) {
        const json = await req.json().catch(() => {
          throw badRequest('Corpo JSON inválido.');
        });
        const parsed = opts.body.safeParse(json);
        if (!parsed.success) throw badRequest('Dados inválidos.', z.flattenError(parsed.error).fieldErrors);
        body = parsed.data;
      }
      let query = undefined as Q;
      if (opts.query) {
        const parsed = opts.query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
        if (!parsed.success) throw badRequest('Parâmetros inválidos.', z.flattenError(parsed.error).fieldErrors);
        query = parsed.data;
      }
      const params = (await context?.params) ?? {};
      const result = await fn({ req, user, body, query, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status });
      }
      // Log sem PII nem segredos: somente tipo e mensagem curta.
      console.error('[api] erro inesperado', req.method, req.nextUrl.pathname, err instanceof Error ? err.message.slice(0, 200) : 'unknown');
      return NextResponse.json({ error: { code: 'internal', message: 'Erro interno. Tente novamente.' } }, { status: 500 });
    }
  };
}

export const uuid = z.string().uuid();
