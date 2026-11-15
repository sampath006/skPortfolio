import { json, clientIp, setCookie, type Ctx } from '../../../server/http';
import { allow } from '../../../server/db';
import { sign, STATE_COOKIE } from '../../../server/session';

// Step 1 of sign-in: send the browser to GitHub.
export const onRequestGet = async ({ request, env }: Ctx): Promise<Response> => {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.SESSION_SECRET || !env.ADMIN_GITHUB_ID) {
    return json({ error: 'Admin sign-in is not set up yet. See LAUNCH.md, part 3.' }, 503);
  }
  if (!(await allow(env.DB, `login:${clientIp(request)}`, 10, 900))) return json({ error: 'Too many sign-in attempts.' }, 429);

  const url = new URL(request.url);
  const back = url.searchParams.get('back') || '/';
  const nonce = crypto.randomUUID();
  const state = await sign({ nonce, back: /^\/[a-z0-9-]{1,40}\/?$/i.test(back) ? back : '/' }, env.SESSION_SECRET, 600);

  const go = new URL('https://github.com/login/oauth/authorize');
  go.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  go.searchParams.set('redirect_uri', `${url.origin}/api/admin/callback`);
  go.searchParams.set('state', nonce);
  // Lax (not Strict) so the cookie comes back when GitHub redirects here.
  return new Response(null, { status: 302, headers: { location: go.toString(), 'set-cookie': setCookie(STATE_COOKIE, state, 600, 'Lax', request) } });
};
