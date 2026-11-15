// Signed tokens for the admin session and the OAuth "state" value.
// Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature)
import { cookie, type Ctx } from './http';

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function key(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function sign(payload: Record<string, unknown>, secret: string, ttlSeconds: number): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function verify<T = Record<string, unknown>>(token: string | undefined, secret: string): Promise<T | null> {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await key(secret), unb64url(sig), enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(unb64url(body)));
    if (typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) return null;
    return payload as T;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = 'pf_session';
export const STATE_COOKIE = 'pf_state';
export const SESSION_TTL = 60 * 60; // 1 hour

export type Session = { id: string; login: string };

// Returns the signed-in admin, or null. Checks the user id again on every request.
export async function currentAdmin({ request, env }: Ctx): Promise<Session | null> {
  if (!env.SESSION_SECRET || !env.ADMIN_GITHUB_ID) return null;
  const s = await verify<Session>(cookie(request, SESSION_COOKIE), env.SESSION_SECRET);
  return s && s.id === String(env.ADMIN_GITHUB_ID) ? s : null;
}
