import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = ['/', '/login', '/about', '/privacy', '/safety', '/faq', '/dating-experiment'];

test.describe('quiz profile recovery without real accounts or writes', () => {
  test.use({ serviceWorkers: 'block' });
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'QA blocks all other API calls' } }));
  });
  const user = { id: '00000000-0000-4000-8000-000000000321', name: 'QA', age: 30,
    archetype: 'QA baseline', seeking: 'f', age_min: 25, age_max: 40 };

  for (const mode of ['retake=1', 'line=love']) {
    for (const failure of ['network', 'server', 'invalid-data', 'timeout']) {
      test(`${mode} recovers from ${failure} without a crash or login redirect`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        let recovered = false;
        await page.route('**/api/profile', async route => {
          if (recovered) return route.fulfill({ json: { user } });
          if (failure === 'network') return route.abort('internetdisconnected');
          if (failure === 'server') return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
          if (failure === 'invalid-data') return route.fulfill({ status: 200, json: {} });
          // Hold the response beyond the application's 12-second deadline.
          await new Promise(resolve => setTimeout(resolve, 13_000));
          await route.fulfill({ json: { user } }).catch(() => {});
        });
        await page.goto(`/quiz?${mode}`);
        const loadError = page.getByRole('alert').filter({ hasText: "Couldn't load your profile" });
        await expect(loadError).toBeVisible({ timeout: 16_000 });
        await expect(page).toHaveURL(new RegExp(`/quiz\\?${mode}`));
        expect(errors).toEqual([]);
        recovered = true;
        await page.getByRole('button', { name: 'Retry loading quiz' }).click();
        await expect(loadError).toHaveCount(0);
        await expect(page.getByRole('status').filter({ hasText: 'Loading your quiz' })).toHaveCount(0);
        if (mode === 'line=love') {
          await expect(page.getByRole('heading', { name: /what you’re looking for/ })).toBeVisible();
        } else {
          await expect(page.getByText('1/12', { exact: true })).toBeVisible();
        }
        expect(errors).toEqual([]);
      });
    }

    test(`${mode} preserves its destination when sign-in really expires`, async ({ page }) => {
      await page.route('**/api/profile', route => route.fulfill({ status: 401, json: { error: 'Unauthorized' } }));
      await page.goto(`/quiz?${mode}`);
      await expect(page).toHaveURL(/\/login\?next=/);
      expect(new URL(page.url()).searchParams.get('next')).toBe(`/quiz?${mode}`);
    });
  }

  test('signed-out signup stays available, but profile-check failures are retryable', async ({ page }) => {
    let ready = false;
    await page.route('**/api/profile', route => route.fulfill({ status: ready ? 401 : 503, json: {} }));
    await page.goto('/quiz?next=friends');
    await expect(page.getByRole('alert').filter({ hasText: "Couldn't load your profile" })).toBeVisible();
    ready = true;
    await page.getByRole('button', { name: 'Retry loading quiz' }).click();
    await expect(page.getByRole('radiogroup', { name: 'Choose what you want from NotCupid' })).toBeVisible();
    await expect(page).toHaveURL(/next=friends/);
  });
});

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
