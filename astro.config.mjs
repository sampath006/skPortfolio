import { defineConfig } from 'astro/config';

// CF_PAGES_URL is set automatically by Cloudflare Pages during the build.
export default defineConfig({
  site: process.env.SITE_URL || process.env.CF_PAGES_URL || 'http://localhost:4321',
  build: { inlineStylesheets: 'always' },
});
