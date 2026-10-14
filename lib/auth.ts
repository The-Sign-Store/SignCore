import 'server-only';
import { cookies, headers } from 'next/headers';
import { COOKIE, readSession } from './session';

/** Name recorded in the change history for the current request. */
export async function currentActor(): Promise<string> {
  if (process.env.AUTH_MODE === 'cloudflare-access') {
    const email = (await headers()).get('cf-access-authenticated-user-email');
    if (email) return email;
  }
  const s = await readSession((await cookies()).get(COOKIE)?.value);
  return s?.name || 'unknown';
}
