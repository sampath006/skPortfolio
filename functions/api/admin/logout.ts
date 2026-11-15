import { json, setCookie, sameOrigin, type Ctx } from '../../../server/http';
import { SESSION_COOKIE } from '../../../server/session';

export const onRequestPost = async ({ request }: Ctx): Promise<Response> => {
  if (!sameOrigin(request)) return json({ error: 'Forbidden.' }, 403);
  return json({ ok: true }, 200, { 'set-cookie': setCookie(SESSION_COOKIE, '', 0, 'Strict', request) });
};
