import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/config/env';
import { authProvider } from '@/server/auth';
import { SESSION_COOKIE, cookieOptions, signSession } from '@/server/auth/session';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const r = code ? await authProvider().oauthCallback(code, req.cookies.get('nexo_pkce')?.value) : null;
  if (!r || !r.ok) return NextResponse.redirect(`${env().NEXO_APP_URL}/entrar?erro=google`);
  const res = NextResponse.redirect(`${env().NEXO_APP_URL}/inicio`);
  res.cookies.set(SESSION_COOKIE, signSession(r.session), cookieOptions(env().NEXO_APP_URL));
  res.cookies.delete('nexo_pkce');
  return res;
}
