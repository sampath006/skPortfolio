import { json, clientIp, type Ctx } from '../../server/http';
import { prepare, allow } from '../../server/db';

// GET reads the visit count, POST adds one and returns the new count.
async function handle({ request, env }: Ctx, add: boolean): Promise<Response> {
  if (!env.DB) return json({ visits: null });
  await prepare(env.DB);
  if (add && (await allow(env.DB, `visit:${clientIp(request)}`, 20, 3600))) {
    const row = await env.DB
      .prepare("INSERT INTO counters (name, value) VALUES ('visits', 1) ON CONFLICT(name) DO UPDATE SET value = value + 1 RETURNING value")
      .first();
    return json({ visits: row?.value ?? null });
  }
  const row = await env.DB.prepare("SELECT value FROM counters WHERE name = 'visits'").first();
  return json({ visits: row?.value ?? 0 });
}

export const onRequestGet = (ctx: Ctx) => handle(ctx, false);
export const onRequestPost = (ctx: Ctx) => handle(ctx, true);
