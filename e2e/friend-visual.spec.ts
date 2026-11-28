import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const session = process.env.E2E_TEST_SESSION;
if (process.env.E2E_REQUIRE_AUTH === '1' && !session) throw Error('Synthetic staging session required');
test.use({ serviceWorkers: 'block' });
test.skip(!session, 'Requires the isolated synthetic staging account');
const event = { id: 'live:curated:visual-music', title: 'An evening of live jazz', venue: 'Synthetic community hall, Boston', startsAt: new Date(Date.now() + 2 * 86400000).toISOString(), url: 'https://www.ticketmaster.com/event/synthetic', category: 'music', price: null, sourceLabel: 'Synthetic organizer' };
const people = [{ otherId: '00000000-0000-4000-8000-000000000911', name: 'Alex Example', age: 30, photo_url: null, archetype: null, metro: 'Boston', sharedActivities: ['Live music', 'Walking'], score: 82 }];

test.beforeEach(async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'nc_session', value: session!, url: baseURL!, httpOnly: true, secure: true, sameSite: 'Lax' }]);
  await page.addInitScript(() => {
    localStorage.setItem('nc-friend-terms', '1');
    localStorage.setItem('nc_pwa_install_dismissed', String(Date.now()));
    localStorage.setItem('nc_pwa_push_dismissed', String(Date.now()));
  });
  // No message, connection, purchase or profile mutation reaches even staging.
  await page.route('**/api/**', r => r.request().method() === 'GET' ? r.continue() : r.fulfill({ status: 503, json: { error: 'Synthetic visual fixture blocks mutations' } }));
  await page.route('**/api/friend/activities?*', r => r.fulfill({ json: { activities: [], areas: ['Back Bay'], origin: 'Back Bay' } }));
  await page.route('**/api/date-plans?*', r => r.fulfill({ json: { activities: [], outcomes: [], preferences: [] } }));
});

for (const [device, width, height] of [['phone', 390, 844], ['tablet', 820, 1180], ['desktop', 1440, 1000]] as const) {
  for (const state of ['ready', 'empty', 'loading', 'error'] as const) {
    test(`${device} discovery ${state} preserves actions and readable states`, async ({ page }, info) => {
      await page.setViewportSize({ width, height });
      let release: () => void = () => {};
      const held = new Promise<void>(resolve => { release = resolve; });
      await page.route('**/api/friend/events', async r => {
        if (state === 'loading') await held;
        await r.fulfill(state === 'error' ? { status: 503, json: { error: 'Synthetic outage' } } : { json: { status: 'ready', metro: 'boston', events: state === 'empty' ? [] : [event] } });
      });
      try {
        await page.goto('/friends');
        const region = page.getByRole('region', { name: 'Find something to do', exact: true });
        const title = state === 'loading' ? 'Loading local events' : state === 'error' ? 'Events are unavailable right now' : state === 'empty' ? 'No events match these filters' : event.title;
        await expect(region.getByRole('heading', { name: title, exact: true })).toBeVisible();
        await expect(page.getByRole('navigation', { name: 'Connection navigation' })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        const violations = (await new AxeBuilder({ page }).include('main').analyze()).violations.filter(v => ['critical', 'serious'].includes(v.impact || ''));
        expect(violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
        await page.screenshot({ path: info.outputPath(`${device}-${state}.png`), fullPage: true });
        if (state === 'ready') {
          await expect(region.getByRole('link', { name: /Current details/ })).toHaveAttribute('target', '_blank');
          await region.getByRole('button', { name: 'Find people to go with', exact: true }).click();
          await expect(page.getByRole('form', { name: 'Create an invitation' })).toContainText('not a ticket or reservation');
        }
        if (state === 'error') await expect(region.getByRole('button', { name: 'Retry events' })).toBeEnabled();
      } finally { release(); }
    });
  }
  test(`${device} pack reveal stays keyboard-operable with synthetic people`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.route('**/api/friend/pack', r => r.fulfill({ json: r.request().method() === 'POST' ? { friends: people } : { sealed: people, openedCount: 0 } }));
    await page.goto('/friends/pack');
    const pack = page.getByRole('button', { name: 'Open your friendship pack' });
    await pack.focus(); await page.keyboard.press('Enter');
    await expect(page.getByText('Alex, 30', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`${device}-pack.png`), fullPage: true });
  });
}

test('profile controls have names and preserve an unsaved local draft', async ({ page }) => {
  await page.goto('/friends/profile');
  await expect(page.getByRole('heading', { name: 'Your Friend card' })).toBeVisible();
  await expect(page.getByLabel('Main photo', { exact: true })).toHaveAttribute('type', 'file');
  await page.getByLabel('About you', { exact: true }).fill('Synthetic draft, never submitted');
  await page.getByLabel('Occupation', { exact: true }).fill('Synthetic occupation');
  await page.getByLabel('add a hobby…', { exact: true }).fill('Walking');
  await page.getByLabel('add a hobby…', { exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Remove Walking', exact: true })).toBeVisible();
  await expect(page.getByLabel('About you', { exact: true })).toHaveValue('Synthetic draft, never submitted');
  const violations = (await new AxeBuilder({ page }).include('[class*=profileEditor]').analyze()).violations.filter(v => ['critical', 'serious'].includes(v.impact || ''));
  expect(violations.map(v => v.id)).toEqual([]);
});
