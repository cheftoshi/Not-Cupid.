import { test, expect } from '@playwright/test';

const session = process.env.E2E_TEST_SESSION;
if (process.env.E2E_REQUIRE_AUTH === '1' && !session) {
  throw new Error('Authenticated release checks require E2E_TEST_SESSION for a seeded non-production test account.');
}

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
});
