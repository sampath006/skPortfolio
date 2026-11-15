import { test, expect } from '@playwright/test';
import { sign } from '../server/session';
import profile from '../src/content/profile.json' with { type: 'json' };

test('home page shows every section with no script errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (const name of ['Experience', 'Case studies', 'Projects', 'Achievements', 'Beyond code', 'Contact']) {
    await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('the employer is named only in the Experience section', async ({ page }) => {
  await page.goto('/');
  const outside = await page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelector('#experience')?.remove();
    return /commvault/i.test(clone.textContent || '');
  });
  expect(outside).toBe(false);
});

test('every internal link works', async ({ page, request }) => {
  await page.goto('/');
  const hrefs = await page.$$eval('a[href^="/"]', (as) => [...new Set(as.map((a) => a.getAttribute('href')!))]);
  for (const href of hrefs) expect((await request.get(href)).status(), href).toBe(200);
});

test('scrolling runs the job: nodes power on, cluster scales, job completes', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-node].on')).toHaveCount(0);
  await page.locator('[data-viz="cluster"]').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(page.locator('#experience h2.on')).toBeVisible();
  await expect(page.locator('.slots i[data-s="running"]').first()).toBeVisible();
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator('#job-state')).toHaveText(/complete/);
  await expect(page.locator('#contact h2')).toHaveClass(/(^| )on( |$)/);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.locator('#contact h2')).not.toHaveClass(/(^| )on( |$)/);
});

test('visitor counter counts', async ({ request }) => {
  const a = await (await request.post('/api/visits')).json();
  const b = await (await request.post('/api/visits')).json();
  expect(b.visits).toBe(a.visits + 1);
});

test('contact form stores a message and rejects a bad one', async ({ page, request }) => {
  await page.goto('/');
  await page.getByLabel('Your name').fill('Test Recruiter');
  await page.getByLabel('Your email').fill('recruiter@example.com');
  await page.getByLabel('Message').fill('We have a backend role you may like.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('#contact-note')).toHaveText(/Message sent/);

  const bad = await request.post('/api/contact', { data: { name: 'x', email: 'nope', message: 'short' } });
  expect(bad.status()).toBe(400);
});

test('resume page loads', async ({ page }) => {
  await page.goto('/resume/');
  await expect(page.getByRole('heading', { name: 'Experience' })).toBeVisible();
});

test.describe('admin', () => {
  test('API refuses everyone who is not signed in', async ({ request }) => {
    expect((await request.get('/api/admin/me')).status()).toBe(401);
    expect((await request.get('/api/admin/profile')).status()).toBe(401);
    expect((await request.put('/api/admin/profile', { data: {} })).status()).toBe(401);
    expect((await request.put('/api/admin/photo', { data: {} })).status()).toBe(401);
  });

  test('a session for a different GitHub user is refused', async ({ request }) => {
    const token = await sign({ id: '999', login: 'stranger' }, 'e2e-secret', 600);
    const res = await request.get('/api/admin/me', { headers: { cookie: `pf_session=${token}` } });
    expect(res.status()).toBe(401);
  });

  test('a forged session is refused', async ({ request }) => {
    const token = await sign({ id: '1', login: 'owner' }, 'wrong-secret', 600);
    const res = await request.get('/api/admin/me', { headers: { cookie: `pf_session=${token}` } });
    expect(res.status()).toBe(401);
  });

  test('page shows the sign-in button and is hidden from search engines', async ({ page }) => {
    await page.goto('/studio/');
    await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await page.goto('/');
    expect(await page.locator('a[href*="studio"]').count()).toBe(0);
  });

  test('the owner can edit, and invalid edits are blocked', async ({ page, context }) => {
    const token = await sign({ id: '1', login: 'owner' }, 'e2e-secret', 600);
    await context.addCookies([{ name: 'pf_session', value: token, url: 'http://localhost:8788' }]);
    // GitHub is not reachable in tests, so stand in for it here.
    let saved: any = null;
    await page.route('**/api/admin/profile*', async (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { profile } });
      saved = route.request().postDataJSON();
      return route.fulfill({ json: { ok: true } });
    });

    await page.goto('/studio/');
    await expect(page.getByText('Signed in as owner')).toBeVisible();
    await page.getByText('Basics', { exact: true }).click();
    const headline = page.getByLabel('Headline');
    await headline.fill('');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('#status')).toHaveText(/Fix these fields/);
    expect(saved).toBeNull();

    await headline.fill('Backend engineer who ships.');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('#status')).toHaveText(/Published/);
    expect(saved.pitch).toBe('Backend engineer who ships.');
  });
});
