import { json, sameOrigin, clientIp, toBase64, fromBase64, type Ctx } from '../../../server/http';
import { allow, audit } from '../../../server/db';
import { currentAdmin } from '../../../server/session';
import { configured, readFile, writeFile, resetPreviewBranch, GitHubError, PROFILE_PATH, PREVIEW_BRANCH } from '../../../server/github';
import { ProfileSchema, issuesOf } from '../../../shared/schema';

const fail = (e: unknown) =>
  e instanceof GitHubError ? json({ error: `GitHub: ${e.message}` }, 502) : json({ error: 'Something went wrong while saving.' }, 500);

// Read the profile as it is on GitHub right now (not the deployed copy).
export const onRequestGet = async (ctx: Ctx): Promise<Response> => {
  const me = await currentAdmin(ctx);
  if (!me) return json({ error: 'Sign in first.' }, 401);
  if (!configured(ctx.env)) return json({ error: 'Saving is not set up: add GITHUB_REPO and GITHUB_TOKEN.' }, 503);
  try {
    const file = await readFile(ctx.env, PROFILE_PATH);
    if (!file) return json({ error: `${PROFILE_PATH} was not found in the repo.` }, 404);
    return json({ profile: JSON.parse(fromBase64(file.content)) });
  } catch (e) {
    return fail(e);
  }
};

// Save. ?to=preview commits to the preview branch, anything else publishes to main.
export const onRequestPut = async (ctx: Ctx): Promise<Response> => {
  const { request, env } = ctx;
  if (!sameOrigin(request)) return json({ error: 'Forbidden.' }, 403);
  const me = await currentAdmin(ctx);
  if (!me) return json({ error: 'Sign in first.' }, 401);
  if (!configured(env)) return json({ error: 'Saving is not set up: add GITHUB_REPO and GITHUB_TOKEN.' }, 503);
  if (!(await allow(env.DB, `save:${clientIp(request)}`, 30, 3600))) return json({ error: 'Too many saves this hour.' }, 429);

  const parsed = ProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Some fields need fixing.', issues: issuesOf(parsed.error) }, 400);

  const preview = new URL(request.url).searchParams.get('to') === 'preview';
  const branch = preview ? PREVIEW_BRANCH : 'main';
  try {
    if (preview) await resetPreviewBranch(env);
    const body = JSON.stringify(parsed.data, null, 2) + '\n';
    const sha = await writeFile(env, PROFILE_PATH, toBase64(body), preview ? 'Preview profile edit' : 'Update profile from admin panel', branch);
    await audit(env.DB, me.login, preview ? 'preview' : 'publish', sha);
    return json({ ok: true, branch, commit: sha });
  } catch (e) {
    return fail(e);
  }
};
