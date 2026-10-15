import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, readSession } from './lib/session';
import { verifyAccess } from './lib/access';

// Header the app reads to know who is signed in. Always overwritten here, so a client can never supply it.
const USER_HEADER = 'x-signcore-user';

export async function middleware(req: NextRequest) {
  const mode = process.env.AUTH_MODE || 'password';
  const { pathname } = req.nextUrl;
  const headers = new Headers(req.headers);
  headers.delete(USER_HEADER);

  if (mode === 'cloudflare-access') {
    const user = await verifyAccess(req.headers.get('cf-access-jwt-assertion'));
    if (!user) return new NextResponse('Sign in through your company account to use SignCore.', { status: 401 });
    // Optional extra gate on top of the Access policy: only these Authentik groups get in.
    const allowed = (process.env.ACCESS_ALLOWED_GROUPS || '').split(',').map((g) => g.trim()).filter(Boolean);
    if (allowed.length && !(user.groups || []).some((g) => allowed.includes(g)))
      return new NextResponse(`${user.email} is not in a group that can use SignCore. Ask an admin to add you.`, { status: 403 });
    headers.set(USER_HEADER, user.email);
    return NextResponse.next({ request: { headers } });
  }

  if (pathname.startsWith('/login')) return NextResponse.next({ request: { headers } });
  const session = await readSession(req.cookies.get(COOKIE)?.value);
  if (session) { headers.set(USER_HEADER, session.name); return NextResponse.next({ request: { headers } }); }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'] };
