import { test, expect } from '@playwright/test';
// Explicit isolated synthetic catalogue only; never a production smoke test.
test.skip(process.env.E2E_STAGING_ORIGIN !== 'https://127.0.0.1:4443', 'Requires isolated local seeded staging.');
test('real curated catalogue retains forty listings, source links and distant deep links', async ({page,context,baseURL}) => {
 await context.addCookies([{name:'nc_session',value:process.env.E2E_TEST_SESSION!,url:baseURL!,httpOnly:true,sameSite:'Lax',secure:true}]);
 await page.addInitScript(()=>{localStorage.setItem('nc_pwa_push_dismissed',String(Date.now()));localStorage.setItem('nc_pwa_install_dismissed',String(Date.now()));});
 await page.goto('/hub?discover=1&event=live%3Acurated%3Astaging-33&from=friday-digest');
 await expect(page.getByRole('article').first()).toHaveAttribute('data-event-id','live:curated:staging-33');
 await expect(page.getByRole('article').first().getByRole('link',{name:/Current details/})).toHaveAttribute('href','https://example.test/events/33');
 while(await page.getByRole('button',{name:/Show more ideas/}).count())await page.getByRole('button',{name:/Show more ideas/}).click();
 await expect(page.locator('article[data-event-id]')).toHaveCount(40);
 await page.goto('/hub?discover=1&event=live%3Acurated%3Astaging-40');
 await expect(page.getByRole('article').first()).toHaveAttribute('data-event-id','live:curated:staging-40');
 await page.goBack();await expect(page.getByRole('article').first()).toHaveAttribute('data-event-id','live:curated:staging-33');
 await page.setViewportSize({width:320,height:800});await page.evaluate(()=>document.documentElement.style.fontSize='200%');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
