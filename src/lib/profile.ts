import raw from '../content/profile.json';
import { ProfileSchema, issuesOf, type Profile } from '../../shared/schema';

const parsed = ProfileSchema.safeParse(raw);
if (!parsed.success) {
  throw new Error('src/content/profile.json is not valid:\n' + issuesOf(parsed.error).join('\n'));
}
export const profile: Profile = parsed.data;

export const adminPath = (process.env.ADMIN_PATH || 'studio').replace(/[^a-z0-9-]/gi, '') || 'studio';

export type ProjectCard = { name: string; description: string; url: string; tags: string[]; stars?: number };

// Project cards: hand-written ones from profile.json, plus any featured GitHub
// repos fetched at build time. If GitHub is unreachable the build still works.
export async function loadProjects(): Promise<ProjectCard[]> {
  const cards: ProjectCard[] = profile.projects.map((p) => ({ ...p }));
  const user = profile.githubUsername;
  if (!user) return cards;
  for (const repo of profile.featuredRepos) {
    const full = repo.includes('/') ? repo : `${user}/${repo}`;
    try {
      const res = await fetch(`https://api.github.com/repos/${full}`, {
        headers: { 'user-agent': 'portfolio-build', accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const r: any = await res.json();
      if (cards.some((c) => c.url === r.html_url)) continue;
      cards.push({
        name: r.name,
        description: r.description || '',
        url: r.html_url,
        tags: [r.language, ...(r.topics || [])].filter(Boolean).slice(0, 5),
        stars: r.stargazers_count || undefined,
      });
    } catch {
      // Offline or rate-limited: skip this repo.
    }
  }
  return cards;
}
