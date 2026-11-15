import { json, cookie, setCookie, type Ctx } from '../../../server/http';
import { audit } from '../../../server/db';
import { sign, verify, SESSION_COOKIE, SESSION_TTL, STATE_COOKIE } from '../../../server/session';

// Step 2 of sign-in: GitHub sends the browser back here with a one-time code.
export const onRequestGet = async ({ request, env }: Ctx): Promise<Response> => {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.SESSION_SECRET || !env.ADMIN_GITHUB_ID) return json({ error: 'Not set up.' }, 503);
  const url = new URL(request.url);
  const state = await verify<{ nonce: string; back: string }>(cookie(request, STATE_COOKIE), env.SESSION_SECRET);
  const code = url.searchParams.get('code');
  if (!state || !code || state.nonce !== url.searchParams.get('state')) return json({ error: 'Sign-in expired. Start again.' }, 400);

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
  });
  const token: any = await tokenRes.json().catch(() => ({}));
  if (!token.access_token) return json({ error: 'GitHub did not confirm the sign-in.' }, 401);

  const userRes = await fetch('https://api.github.com/user', {
    headers: { authorization: `Bearer ${token.access_token}`, 'user-agent': 'portfolio-admin', accept: 'application/vnd.github+json' },
  });
  const user: any = await userRes.json().catch(() => ({}));
  const clearState = setCookie(STATE_COOKIE, '', 0, 'Lax', request);

  // Only one GitHub account may enter. Everyone else is turned away.
  if (!userRes.ok || String(user.id) !== String(env.ADMIN_GITHUB_ID)) {
    await audit(env.DB, String(user.login || 'unknown'), 'login-refused');
    return json({ error: 'This account is not allowed here.' }, 403, { 'set-cookie': clearState });
  }

  await audit(env.DB, user.login, 'login');
  const session = await sign({ id: String(user.id), login: user.login }, env.SESSION_SECRET, SESSION_TTL);
  const headers = new Headers({ location: state.back });
  headers.append('set-cookie', clearState);
  headers.append('set-cookie', setCookie(SESSION_COOKIE, session, SESSION_TTL, 'Strict', request));
  return new Response(null, { status: 302, headers });
};
