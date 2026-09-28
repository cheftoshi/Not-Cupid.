import { test, expect } from '@playwright/test';
test.use({ serviceWorkers: 'block' });

// Opt-in isolated fixture only; this suite never restores a production chat.
test.skip(process.env.E2E_CHAT_FIXTURE !== '1', 'Requires the synthetic local chat fixture');
test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: 'nc_session', value: 'qa-fixture', domain: '127.0.0.1', path: '/', secure: true }]);
});
test('quiet mutual chats remain reachable in Archived on mobile', async ({ page }) => {
  await page.goto('/dashboard');
  const chat = page.locator('#love-connection-10000000-0000-4000-8000-000000000001');
  await expect(chat).toHaveCount(0);
  await page.getByRole('button', { name: /^archived/ }).click();
  await expect(chat).toBeVisible();
  await chat.getByRole('link', { name: 'open chat' }).click();
  await expect(page.getByRole('textbox', { name: /Message/ })).toBeEnabled();
  const width = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2);
  expect(width).toBe(true);
});
test('an expired mutual chat offers a bounded restore with visible failure and retry', async ({ page }) => {
  await page.goto('/match/10000000-0000-4000-8000-000000000002');
  const restore = page.getByRole('button', { name: 'Bring this chat back' });
  await expect(restore).toBeVisible();
  await page.route('**/api/matches/*/restore', route => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'You can restore three expired chats in 30 days.' }) }));
  await restore.click();
  await expect(page.getByRole('alert').filter({ hasText: 'three expired chats' })).toBeVisible();
  await expect(restore).toBeEnabled();
  await expect(page.getByRole('textbox', { name: /Message/ })).toHaveCount(0);
});
