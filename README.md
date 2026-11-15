# Portfolio

Personal site: Astro front end, Cloudflare Pages Functions API, D1 database, GitHub Actions pipeline.
To put it online, follow [LAUNCH.md](LAUNCH.md).

## Where things are

| Folder | What it holds |
|---|---|
| `src/content/profile.json` | All the words on the site. Edit this (or use the private editor). |
| `src/pages`, `src/styles`, `src/scripts` | The pages, the design and the browser scripts |
| `src/assets` | `portrait.jpg` and `gallery/` photos, compressed at build time |
| `functions/api` | API routes: contact form, visitor counter, editor sign-in and saving |
| `server`, `shared` | Code the API routes share; `shared/schema.ts` defines what valid content is |
| `tests`, `e2e` | Unit tests and browser tests |
| `.github/workflows` | CI, resume PDF and weekly rebuild |

## Commands

```bash
npm install
npm run dev       # work on the design at localhost:4321 (no API)
npm run build     # build to dist/
npm run preview   # built site + API + local database at localhost:8788
npm test          # unit tests
npm run e2e       # browser tests (first time: npx playwright install chromium)
npm run resume    # regenerate public/resume.pdf from the built site
```

## How the private editor stays private

- Its address is set by the `ADMIN_PATH` build variable and is never linked or listed.
- The address is not the lock. Sign-in goes through GitHub, and the API accepts one GitHub user id only.
- Sessions last one hour in a signed, HttpOnly, SameSite=Strict cookie.
- Every save is validated against `shared/schema.ts` and stored as a git commit, so any change can be undone.
- Secrets live in Cloudflare settings, never in this repo.
