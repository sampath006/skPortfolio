# Put the site live for free

Everything here uses free plans. No card is needed.
Menu names in GitHub and Cloudflare change now and then; if a label differs slightly, pick the closest one.

## Part 1. Go live (about 10 minutes)

1. Create a free account at github.com (skip if you have one) and a free account at cloudflare.com.
2. On GitHub, create a new **empty** repository called `portfolio`. Public is fine: no secrets are stored in the code.
3. On your computer, unzip the project, open a terminal in the folder and run:
   ```bash
   git init -b main
   git add .
   git commit -m "Portfolio site"
   git remote add origin https://github.com/sampath006/portfolio.git
   git push -u origin main
   ```
4. In Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**. Pick the `portfolio` repo and set:
   - Production branch: `main`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variables: `NODE_VERSION` = `22` and `ADMIN_PATH` = a word only you know, e.g. `desk-k4m9` (letters, numbers and dashes). This becomes the address of your private editor.
5. Press **Save and Deploy**. In about two minutes the site is live at `https://YOUR-PROJECT.pages.dev`.

From now on every push to `main` redeploys the site automatically, and every other branch gets its own preview link.

## Part 2. Switch on the contact form and visitor counter (5 minutes)

1. Cloudflare: **Storage & Databases → D1 → Create database**. Name it `portfolio`.
2. Open your Pages project: **Settings → Bindings → Add → D1 database**. Variable name must be exactly `DB`. Choose the `portfolio` database.
3. **Deployments → latest → Retry deployment** so the setting takes effect.

Tables are created automatically on first use. To read messages: D1 → `portfolio` → Console → `SELECT * FROM messages ORDER BY id DESC;`

Optional, to also get each message by email: make a free account at resend.com, create an API key, then add two variables to the Pages project (**Settings → Variables and Secrets**): `RESEND_API_KEY` (as a secret) and `CONTACT_TO` (the email address you signed up to Resend with).

Optional, extra spam protection: create a free Turnstile widget in Cloudflare, then add `PUBLIC_TURNSTILE_SITE_KEY` (plain variable) and `TURNSTILE_SECRET` (secret).

## Part 3. Switch on the private editor (10 minutes)

The editor lives at `https://YOUR-SITE/ADMIN_PATH/`. Only your GitHub account can sign in.

1. **GitHub sign-in app.** GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
   - Homepage URL: `https://YOUR-PROJECT.pages.dev`
   - Authorization callback URL: `https://YOUR-PROJECT.pages.dev/api/admin/callback`
   - Copy the **Client ID**, then generate and copy a **Client secret**.
2. **Token that can save edits.** GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token.
   - Repository access: **Only select repositories** → `portfolio`
   - Permissions: **Contents: Read and write** (nothing else)
3. **Your numeric GitHub id.** Open `https://api.github.com/users/YOUR-USERNAME` and copy the number after `"id"`.
4. In the Pages project, **Settings → Variables and Secrets**, add these for Production:

   | Name | Value | Type |
   |---|---|---|
   | `GITHUB_CLIENT_ID` | from step 1 | Text |
   | `GITHUB_CLIENT_SECRET` | from step 1 | Secret |
   | `GITHUB_TOKEN` | from step 2 | Secret |
   | `GITHUB_REPO` | `YOUR-USERNAME/portfolio` | Text |
   | `ADMIN_GITHUB_ID` | from step 3 | Text |
   | `SESSION_SECRET` | 40+ random characters (run `openssl rand -hex 32`) | Secret |

5. Retry the latest deployment, then open `https://YOUR-SITE/ADMIN_PATH/` and sign in.

In the editor: **Publish** commits your change to `main` and the live site updates in about two minutes. **Save to preview** commits to a `preview` branch instead; Cloudflare builds it at a separate preview link (see the Deployments tab) so you can look before publishing.

## Part 4. Finish the automation (5 minutes)

- **Block bad merges.** GitHub repo → Settings → Branches → add a rule for `main` → require the status check `test`. Let the rule be bypassed by GitHub Actions (or by admins) so the resume workflow can still commit the PDF.
- **Resume PDF.** Already automatic: any change to your profile regenerates `resume.pdf`. To print your real site address on it, add a repository **variable** `SITE_URL` (Settings → Secrets and variables → Actions → Variables).
- **Weekly rebuild.** Pages project → Settings → Builds → Deploy hooks → create one, then save its URL as a repository **secret** named `CF_DEPLOY_HOOK`.
- **Uptime alerts.** Add your site to a free uptimerobot.com monitor.
- **Visitor stats.** Pages project → Metrics → enable Web Analytics.

## Before you share the link

Fill these in (through the editor, or by editing `src/content/profile.json`):

- GitHub and LinkedIn links, GitHub username and featured repos
- Your award names under Achievements
- Your photo and gallery photos (Photos section of the editor)
- Links for the two projects once the repos are public
