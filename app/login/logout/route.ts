import { NextResponse } from 'next/server';
import { COOKIE } from '@/lib/session';

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL('/login', req.url));
  res.cookies.delete(COOKIE);
  return res;
}
