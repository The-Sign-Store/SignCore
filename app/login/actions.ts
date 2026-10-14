'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE, safeEqual, signSession } from '@/lib/session';
import { fail, type Result } from '@/lib/specs';

export async function login(_: Result | null, fd: FormData): Promise<Result> {
  const name = String(fd.get('name') || '').trim();
  const password = String(fd.get('password') || '');
  const expected = process.env.APP_PASSWORD;
  if (!expected) return fail('APP_PASSWORD is not set on the server, so nobody can sign in yet.');
  if (!name) return fail('Enter your name so changes show who made them.');
  if (!safeEqual(password, expected)) return fail('That password is not right.');
  (await cookies()).set(COOKIE, await signSession(name), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 14 * 86400 });
  const next = String(fd.get('next') || '/');
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
}
