// Small helpers shared by every API route.

export interface Env {
  DB?: any; // Cloudflare D1 binding (optional: the site works without it)
  SESSION_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  ADMIN_GITHUB_ID?: string; // numeric GitHub user id that may sign in
  GITHUB_REPO?: string; // "owner/repo"
  GITHUB_TOKEN?: string; // fine-grained token, Contents: read and write on that repo only
  RESEND_API_KEY?: string;
  CONTACT_TO?: string;
  TURNSTILE_SECRET?: string;
}

export interface Ctx {
  request: Request;
  env: Env;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export const clientIp = (req: Request) => req.headers.get('cf-connecting-ip') || 'local';

// Browsers send Origin on every POST/PUT. Reject writes that come from another site.
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  return !origin || origin === new URL(req.url).origin;
}

export function cookie(req: Request, name: string): string | undefined {
  const all = req.headers.get('cookie') || '';
  for (const part of all.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

export function setCookie(name: string, value: string, maxAge: number, sameSite: 'Strict' | 'Lax', req: Request): string {
  const secure = new URL(req.url).protocol === 'https:' ? ' Secure;' : '';
  return `${name}=${value}; Path=/; HttpOnly;${secure} SameSite=${sameSite}; Max-Age=${maxAge}`;
}

export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
