// Renders the built /resume page to public/resume.pdf.
// Run "npm run build" first. Used by .github/workflows/resume.yml.
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve('dist/resume/index.html')).href);
await page.pdf({ path: 'public/resume.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log('Wrote public/resume.pdf');
