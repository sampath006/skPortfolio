import { json, type Ctx } from '../../../server/http';
import { currentAdmin } from '../../../server/session';
import { configured } from '../../../server/github';

export const onRequestGet = async (ctx: Ctx): Promise<Response> => {
  const me = await currentAdmin(ctx);
  if (!me) return json({ error: 'Sign in first.' }, 401);
  return json({ login: me.login, canSave: configured(ctx.env) });
};
