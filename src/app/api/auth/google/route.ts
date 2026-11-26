import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/config/env';
import { authProvider } from '@/server/auth';

export async function GET(_req: NextRequest) {
  const start = await authProvider().oauthStart('google', `${env().NEXO_APP_URL}/api/auth/callback`).catch(() => null);
  if (!start) return NextResponse.redirect(`${env().NEXO_APP_URL}/entrar?erro=google_indisponivel`);
  const res = NextResponse.redirect(start.url);
  if (start.verifier) res.cookies.set('nexo_pkce', start.verifier, { httpOnly: true, sameSite: 'lax', secure: !env().NEXO_APP_URL.startsWith('http://localhost'), maxAge: 600, path: '/' });
  return res;
}
