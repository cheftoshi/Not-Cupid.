import { test, expect } from '@playwright/test';

const session = process.env.E2E_TEST_SESSION;
if (process.env.E2E_REQUIRE_AUTH === '1' && !session) {
  throw new Error('Authenticated release checks require E2E_TEST_SESSION for a seeded non-production test account.');
}

test.describe('authenticated test-realm mobile path', () => {
  // Keep all mocked mutations in Playwright; a service worker can bypass routes.
  // Installed-PWA service-worker behavior needs a separate real-device check.
  test.use({ serviceWorkers: 'block' });
  test.skip(!session, 'Set E2E_TEST_SESSION to a non-production seeded test-realm session.');

  test.beforeEach(async ({ context, baseURL, page }) => {
    await context.addCookies([{
      name: 'nc_session', value: session || '', url: baseURL || 'http://127.0.0.1:3000',
      httpOnly: true, sameSite: 'Lax', secure: (baseURL || '').startsWith('https://'),
    }]);
    // Real component rendering, no outbound AI/messages/posts during QA.
    // Individual recovery tests replace selected routes with in-memory fakes.
    await page.route('**/api/**', route => route.request().method() === 'GET'
      ? route.continue()
      : route.fulfill({ status: 503, json: { error: 'QA blocks outbound mutations' } }));
  });

  for (const route of ['/hub', '/dashboard', '/profile', '/friends']) {
    test(`${route} is viewport-safe for a seeded test account`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).toBeVisible();
      // A page without its stylesheet can accidentally pass a width check.
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Inter');
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.evaluate(() => document.documentElement.style.fontSize = '200%');
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.evaluate(() => document.documentElement.style.fontSize = '');
      await page.setViewportSize({ width: 740, height: 360 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    });
  }

  test('Hub keeps the composer reachable after focus and a short viewport', async ({ page }) => {
    await page.goto('/hub');
    const composer = page.getByPlaceholder('What do you want to do?');
    await composer.fill('A local plan');
    await page.setViewportSize({ width: 390, height: 440 });
    await expect(composer).toBeInViewport();
    await composer.blur();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(composer).toBeInViewport();
    await expect(composer).toHaveValue('A local plan');
    // Do not submit: this check must not call AI or send anything to people.
  });

  test('Hub restores an interrupted request and can retry without an install overlay', async ({ page }) => {
    await page.route('**/api/concierge', route => route.fulfill({ json: route.request().method() === 'GET'
      ? { consented: true, memories: [] }
      : { recommendation: { message: 'Test-only suggestion', actions: [], reasons: [] } } }));
    await page.goto('/hub');
    const input = page.getByPlaceholder('What do you want to do?');
    await input.fill('Find a quiet plan');
    // Abort the request like an interrupted connection, without contacting AI.
    await page.route('**/api/concierge', route => route.abort('internetdisconnected'));
    await page.getByRole('button', { name: 'Send to concierge', exact: true }).click();
    await expect(input).toHaveValue('Find a quiet plan');
    await expect(page.getByRole('alert').filter({ hasText: 'could not connect' })).toBeVisible();
    await page.unroute('**/api/concierge');
    await page.route('**/api/concierge', route => route.fulfill({ json: {
      recommendation: { message: 'Test-only suggestion', actions: [], reasons: [] },
    } }));
    await page.getByRole('button', { name: 'Send to concierge', exact: true }).click();
    await expect(page.getByText('Test-only suggestion', { exact: true })).toBeVisible();
    await expect(input).toHaveValue('');
  });

  test('Friend DM keeps failed text through polling and retries a lost acknowledgement with one ID', async ({ page }) => {
    const otherId = '00000000-0000-4000-8000-000000000111';
    const attempts: string[] = [];
    let saved: any = null;
    await page.route('**/api/friend/roster', route => route.fulfill({ json: {
      matches: [{ otherId, name: 'QA Friend', connected: true, iAccepted: true, theyAccepted: true }], sealedCount: 0,
    } }));
    await page.route('**/api/friend/dm*', async route => {
      if (route.request().method() === 'POST') {
        const request = route.request().postDataJSON();
        attempts.push(request.clientId);
        saved ||= { id: 'qa-server-message', body: request.body, clientId: request.clientId, isMe: true };
        if (attempts.length === 1) return route.abort('connectionfailed');
        return route.fulfill({ json: { message: saved } });
      }
      return route.fulfill({ json: { messages: attempts.length > 1 ? [saved] : [], unread: {} } });
    });
    await page.goto(`/friends?dm=${otherId}`);
    // Exercise the synthetic account's local first-visit gate before the chat.
    await page.getByRole('button', { name: 'I agree — let me in →' }).click();
    const dialog = page.getByRole('dialog', { name: 'private chat with QA' });
    const input = dialog.getByRole('textbox', { name: 'message QA', exact: true });
    await input.fill('Test hello');
    await dialog.getByRole('button', { name: 'send', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Not confirmed · retry' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Reload chat' }).click();
    await expect(dialog.getByText('Test hello', { exact: true })).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Not confirmed · retry' }).click();
    await expect.poll(() => attempts.length).toBe(2);
    expect(attempts[1]).toBe(attempts[0]);
    await expect(dialog.getByRole('button', { name: 'Not confirmed · retry' })).toHaveCount(0);
    await expect(dialog.getByText('Test hello', { exact: true })).toHaveCount(1);
    await input.fill('Keep my draft');
    await dialog.getByRole('button', { name: 'close private chat' }).click();
    // No real user receives any of the test messages above.
  });
});
