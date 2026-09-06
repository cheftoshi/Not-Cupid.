import { test, expect } from '@playwright/test';

const session = process.env.E2E_TEST_SESSION;

test.describe('authenticated test-realm mobile path', () => {
  test.skip(!session, 'Set E2E_TEST_SESSION to a non-production seeded test-realm session.');

  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{
      name: 'nc_session', value: session || '', url: baseURL || 'http://127.0.0.1:3000',
      httpOnly: true, sameSite: 'Lax', secure: (baseURL || '').startsWith('https://'),
    }]);
  });

  for (const route of ['/hub', '/dashboard', '/profile', '/friends']) {
    test(`${route} is viewport-safe for a seeded test account`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    });
  }
});
