// Edits are saved as commits to the site's own GitHub repo. A commit to "main"
// triggers the normal deploy; a commit to "preview" builds a private preview.
import type { Env } from './http';

export const PROFILE_PATH = 'src/content/profile.json';
export const PREVIEW_BRANCH = 'preview';

export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function gh(env: Env, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'portfolio-admin',
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body: any = await res.json().catch(() => ({}));
    throw new GitHubError(res.status, body.message || `GitHub replied ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export const configured = (env: Env) => Boolean(env.GITHUB_REPO && env.GITHUB_TOKEN);

export async function readFile(env: Env, path: string, branch = 'main'): Promise<{ content: string; sha: string } | null> {
  try {
    const f = await gh(env, `/contents/${path}?ref=${branch}`);
    return { content: f.content as string, sha: f.sha as string };
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}

export async function writeFile(env: Env, path: string, base64: string, message: string, branch = 'main'): Promise<string> {
  const existing = await readFile(env, path, branch);
  const out = await gh(env, `/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: base64, branch, ...(existing ? { sha: existing.sha } : {}) }),
  });
  return out.commit.sha as string;
}

// Point the preview branch at the tip of main (creating it if needed), so a
// preview always shows "the live site plus this one edit".
export async function resetPreviewBranch(env: Env): Promise<void> {
  const main = await gh(env, '/git/ref/heads/main');
  const sha = main.object.sha;
  try {
    await gh(env, `/git/refs/heads/${PREVIEW_BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha, force: true }) });
  } catch (e) {
    if (!(e instanceof GitHubError) || (e.status !== 404 && e.status !== 422)) throw e;
    await gh(env, '/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${PREVIEW_BRANCH}`, sha }) });
  }
}
