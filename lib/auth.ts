import 'server-only';
import { headers } from 'next/headers';

/** Who is signed in (Access email or password-login name), as set by middleware after it verified the request. */
export async function currentActor(): Promise<string> {
  return (await headers()).get('x-signcore-user') || 'unknown';
}

export const authMode = () => (process.env.AUTH_MODE === 'cloudflare-access' ? 'cloudflare-access' : 'password');
