import { z } from 'zod';
import { json, sameOrigin, clientIp, type Ctx } from '../../../server/http';
import { allow, audit } from '../../../server/db';
import { currentAdmin } from '../../../server/session';
import { configured, writeFile, GitHubError } from '../../../server/github';

const Upload = z.object({
  kind: z.enum(['portrait', 'gallery']),
  name: z.string().max(80).optional(),
  data: z.string().min(100).max(2_800_000), // base64 JPEG, about 2 MB at most
});

// Commits a photo to the repo. The browser has already resized it to a JPEG.
export const onRequestPut = async (ctx: Ctx): Promise<Response> => {
  const { request, env } = ctx;
  if (!sameOrigin(request)) return json({ error: 'Forbidden.' }, 403);
  const me = await currentAdmin(ctx);
  if (!me) return json({ error: 'Sign in first.' }, 401);
  if (!configured(env)) return json({ error: 'Saving is not set up: add GITHUB_REPO and GITHUB_TOKEN.' }, 503);
  if (!(await allow(env.DB, `photo:${clientIp(request)}`, 40, 3600))) return json({ error: 'Too many uploads this hour.' }, 429);

  const parsed = Upload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Photo is missing or larger than 2 MB.' }, 400);
  const { kind, name, data } = parsed.data;
  if (!data.startsWith('/9j/') || !/^[A-Za-z0-9+/]+=*$/.test(data)) return json({ error: 'Photo must be a JPEG.' }, 400);

  const slug = (name || 'photo').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'photo';
  const file = kind === 'portrait' ? 'portrait.jpg' : `${slug}-${Date.now().toString(36)}.jpg`;
  const path = kind === 'portrait' ? `src/assets/${file}` : `src/assets/gallery/${file}`;
  try {
    const sha = await writeFile(env, path, data, kind === 'portrait' ? 'Update portrait photo' : `Add gallery photo ${file}`);
    await audit(env.DB, me.login, `photo-${kind}`, file);
    return json({ ok: true, file, commit: sha });
  } catch (e) {
    return e instanceof GitHubError ? json({ error: `GitHub: ${e.message}` }, 502) : json({ error: 'Upload failed.' }, 500);
  }
};
