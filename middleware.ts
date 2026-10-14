import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, readSession } from './lib/session';

export async function middleware(req: NextRequest) {
  const mode = process.env.AUTH_MODE || 'password';
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/login') || pathname.startsWith('/_next') || pathname === '/favicon.ico') return NextResponse.next();

  if (mode === 'cloudflare-access') {
    if (req.headers.get('cf-access-authenticated-user-email')) return NextResponse.next();
    return new NextResponse('Sign in through Cloudflare Access to use the Spec Manager.', { status: 401 });
  }

  const session = await readSession(req.cookies.get(COOKIE)?.value);
  if (session) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
