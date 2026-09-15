import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = ['/', '/login', '/about', '/privacy', '/safety', '/faq', '/dating-experiment'];

async function horizontalOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll<HTMLElement>('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName.toLowerCase(), className: element.className, left: rect.left, right: rect.right, width: rect.width };
      })
      .filter((rect) => rect.left < -1 || rect.right > viewportWidth + 1)
      .sort((a, b) => b.right - a.right)
      .slice(0, 5);
    return { viewportWidth, scrollWidth: document.documentElement.scrollWidth, offenders };
  });
}

for (const route of routes) {
  test(`${route} renders inside a phone viewport`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'load' });
    await expect(page.locator('body')).toBeVisible();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Inter');
    const overflow = await horizontalOverflow(page);
    expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewportWidth + 1);
    await expect(page.locator('body')).not.toContainText('Application error');
  });
}

test('login remains usable with the software keyboard viewport', async ({ page }) => {
  await page.goto('/login');
  const email = page.locator('input[type="email"]');
  await email.fill('mobile@example.com');
  await email.focus();
  await page.setViewportSize({ width: 390, height: 430 });
  await expect(email).toBeInViewport();
  await expect(page.getByRole('button', { name: /send code/i })).toBeInViewport();
});

test('public trust surfaces have no serious automated accessibility violations', async ({ page }) => {
  await page.goto('/privacy');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact || ''))).toEqual([]);
});
