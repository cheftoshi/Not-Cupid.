import { test, expect } from '@playwright/test';
const session = process.env.E2E_TEST_SESSION;
test.describe('revamp navigation and decision journeys', () => {
  test.use({ serviceWorkers: 'block' });
  test.skip(!session, 'Requires an isolated test-realm session.');
  test.beforeEach(async ({ context, baseURL, page }) => {
    await context.addCookies([{name:'nc_session',value:session || '',url:baseURL!,httpOnly:true,sameSite:'Lax',secure:true}]);
    await page.route('**/api/**', r => r.request().method() === 'GET' ? r.continue() : r.fulfill({status:503,json:{error:'QA blocks external mutations'}}));
    await page.route('**/api/friend/activities?*', r => r.fulfill({json:{activities:[],areas:['Back Bay'],origin:'Back Bay'}}));
    await page.route('**/api/date-plans?*', r => r.fulfill({json:{activities:[],outcomes:[],preferences:[]}}));
  });
  test('navigation changes from desktop rail to mobile bar and keeps route state', async ({page}) => {
    await page.setViewportSize({width:1440,height:1000});await page.goto('/hub');
    const nav=page.getByRole('navigation',{name:'Main navigation'});
    await expect(nav.getByRole('link',{name:'Home',exact:true})).toHaveAttribute('aria-current','page');
    expect((await page.locator('.appNavigation').boundingBox())!.width).toBe(220);
    await nav.getByRole('link',{name:'You',exact:true}).click();await expect(page.getByRole('heading',{name:'Your settings'})).toBeVisible();
    await page.setViewportSize({width:390,height:844});
    expect((await nav.boundingBox())!.y).toBeGreaterThan(700);
    await nav.getByRole('link',{name:'Dating',exact:true}).click();
    await expect(nav.getByRole('link',{name:'Dating',exact:true})).toHaveAttribute('aria-current','page');
    await page.goBack();await expect(page).toHaveURL(/\/profile/);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  });
  test('staged invitation retains details and does not publish before review', async ({page}) => {
    let publications=0;await page.route('**/api/friend/activities',r=>{publications++;return r.fulfill({status:503,json:{error:'Simulated failure; retry safely'}})});
    await page.goto('/hub');await page.getByRole('button',{name:'＋ Invite someone',exact:true}).click();
    const form=page.getByRole('form',{name:'Create an invitation'});
    await form.getByRole('button',{name:'Continue',exact:true}).click();
    await form.getByRole('button',{name:'Continue',exact:true}).click();
    await expect(form.getByLabel('Your invitation', {exact:true})).toBeVisible();
    await form.getByLabel('Your invitation', {exact:true}).fill('QA shared walk');
    await form.getByRole('button',{name:'Continue',exact:true}).click();
    await form.getByRole('button',{name:'Continue',exact:true}).click();
    await expect(form.getByRole('region',{name:'Review your invitation'})).toContainText('QA shared walk');
    expect(publications).toBe(0);
    await form.getByRole('button',{name:'Back',exact:true}).click();await form.getByRole('button',{name:'Back',exact:true}).click();
    await expect(form.getByLabel('Your invitation',{exact:true})).toHaveValue('QA shared walk');
    await form.getByRole('button',{name:'Continue',exact:true}).click();await form.getByRole('button',{name:'Continue',exact:true}).click();
    await form.getByRole('button',{name:'Create invitation',exact:true}).click();
    await expect(form.getByRole('alert')).toContainText('Simulated failure');
    await expect(form.getByRole('region',{name:'Review your invitation'})).toContainText('QA shared walk');expect(publications).toBe(1);
  });
  test('Home prioritizes a real pending decision over discovery', async ({page}) => {
    await page.route('**/api/date-plans?*',r=>r.fulfill({json:{activities:[{id:'00000000-0000-4000-8000-000000000901',title:'QA date',kind:'event',connectionKind:'date',state:'open',isMine:true,canChat:false,responses:{yes:0,maybe:0,no:0},requests:[{id:'qa-request',profile:{name:'QA Guest',interests:[]}}],created_at:new Date().toISOString()}]}}));
    await page.goto('/hub');const next=page.getByRole('region',{name:'Your next step'});await expect(next).toContainText('1 date request to review');
    await next.getByRole('button',{name:'Review requests'}).click();await expect(page.getByRole('heading',{name:'Your plans',exact:true})).toBeVisible();
  });
  test('Home failures stay distinct from empty inventory',async({page})=>{
    await page.route('**/api/date-plans?*',r=>r.fulfill({status:503,json:{error:'QA unavailable'}}));await page.goto('/hub');
    await expect(page.getByRole('region',{name:'Your next step'})).toContainText('could not be refreshed');
    await expect(page.getByRole('button',{name:'Retry plans'})).toBeVisible();
    await expect(page.getByRole('region',{name:'Your next step'})).not.toContainText('no invitations');
  });
  test('Dating separates connections from discovery and supports anchor return',async({page})=>{
    await page.goto('/dashboard#connections');await expect(page.getByRole('button',{name:'Connections',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.getByRole('button',{name:'Discover people',exact:true}).click();await expect(page).toHaveURL(/#roster$/);
    await page.getByRole('button',{name:'Connections',exact:true}).click();await expect(page.locator('#connections')).toBeVisible();
  });
  test('settings lead to independently controlled notifications and AI memories',async({page})=>{
    await page.goto('/profile');await page.getByRole('link',{name:'Email preferences',exact:true}).click();
    await expect(page.locator('#notifications')).toContainText('Turning this off stops email only');
    await page.goto('/hub?view=coach#ai-controls');await expect(page.getByRole('button',{name:'Close AI controls'})).toBeVisible();
    await expect(page.getByRole('navigation',{name:'Coach navigation'}).getByRole('link',{name:'Back to your plans'})).toBeVisible();
  });
});
