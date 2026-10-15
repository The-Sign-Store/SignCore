// Cloudflare Access: verifies the signed JWT Access adds to every request (Cf-Access-Jwt-Assertion).
// Checking the signature, issuer and audience means a request that did not come through Access
// (for example a direct hit on the workers.dev address) is refused, even if it fakes the email header.
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksFor = '';

export type AccessUser = { email: string; name?: string; groups?: string[] };

export function accessConfig() {
  const team = (process.env.ACCESS_TEAM_DOMAIN || '').replace(/\/+$/, '');   // https://<team>.cloudflareaccess.com
  const aud = process.env.ACCESS_AUD || '';                                   // Application Audience (AUD) Tag
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(team) || !aud)
    throw new Error('AUTH_MODE=cloudflare-access needs ACCESS_TEAM_DOMAIN (https://<team>.cloudflareaccess.com) and ACCESS_AUD.');
  return { team, aud };
}

export async function verifyAccess(token: string | null): Promise<AccessUser | null> {
  if (!token) return null;
  const { team, aud } = accessConfig();
  // ACCESS_CERTS_URL only exists for local testing; in production the keys always come from the team domain.
  const certs = process.env.ACCESS_CERTS_URL || `${team}/cdn-cgi/access/certs`;
  if (!jwks || jwksFor !== certs) { jwks = createRemoteJWKSet(new URL(certs)); jwksFor = certs; }
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: team, audience: aud, algorithms: ['RS256'] });
    const p = payload as JWTPayload & { email?: string; custom?: Record<string, unknown> };
    if (!p.email) return null;
    const custom = p.custom || {};
    const groups = Array.isArray(custom.groups) ? custom.groups.map(String) : undefined;
    const name = typeof custom.name === 'string' ? custom.name : undefined;
    return { email: p.email, name, groups };
  } catch {
    return null;
  }
}
