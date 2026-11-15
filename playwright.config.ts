import { defineConfig } from '@playwright/test';

// Runs the built site with its API and a local database, exactly as Cloudflare serves it.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:8788',
    channel: process.env.PW_CHANNEL || undefined,
  },
  webServer: {
    command:
      'npm run build && npx wrangler pages dev dist --port 8788 --d1 DB --persist-to .wrangler/e2e --binding SESSION_SECRET=e2e-secret --binding ADMIN_GITHUB_ID=1',
    url: 'http://localhost:8788',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { ADMIN_PATH: 'studio' },
  },
});
