import { test, expect } from '@playwright/test';
const session=process.env.E2E_TEST_SESSION;
const clubId='00000000-0000-4000-8000-000000000771';
const club={id:clubId,name:'QA Walking Club',category:'outdoors',memberCount:4,myStatus:'member',joinMode:'request',cadence:'weekly',description:'Synthetic group for preview checks.'};
test.describe('Friend workspace presentation and retained actions',()=>{
 test.use({serviceWorkers:'block'});
 test.skip(!session,'Requires isolated test session');
 test.beforeEach(async({page,context,baseURL})=>{
  await context.addCookies([{name:'nc_session',value:session||'',url:baseURL!,httpOnly:true,secure:true,sameSite:'Lax'}]);
  await page.route('**/api/**',r=>r.request().method()==='GET'?r.continue():r.fulfill({status:503,json:{error:'Synthetic test blocks writes'}}));
  await page.route('**/api/friend/clubs',r=>r.fulfill({json:{clubs:[club]}}));
  await page.route('**/api/friend/community-links',r=>r.fulfill({json:{links:[{id:'qa-community',title:'QA External Community',url:'https://example.invalid/community',description:'An external group',kind:'discord'}]}}));
 });
 test('a selected plan absent from the Scene feed is fetched without opening chat or joining', async ({ page }) => {
  const id = '00000000-0000-4000-8000-000000000901';
  const plan = { id, kind: 'event', title: 'QA selected plan', body: 'Older than the default feed', authorName: 'QA Host',
    authorId: '00000000-0000-4000-8000-000000000911', eligible: true, isMine: false, myResponse: 'yes',
    category: 'hang', responses: { yes: 1, maybe: 0, no: 0 }, happens_at: new Date(Date.now() + 86400000).toISOString() };
  let calls = 0, chatReads = 0, writes = 0;
  await page.route('**/api/friend/activities*', route => {
    const selected = new URL(route.request().url()).searchParams.get('plan');
    if (!selected) return route.fulfill({ json: { activities: [] } });
    expect(selected).toBe(id);
    calls++;
    return route.fulfill(calls === 1 ? { status: 503, json: {} } : { json: { activities: [plan] } });
  });
  await page.route(`**/api/friend/activities/${id}/comments`, route => { chatReads++; return route.fulfill({ json: { comments: [] } }); });
  await page.route(`**/api/friend/activities/${id}/rsvp`, route => { writes++; return route.fulfill({ status: 503, json: {} }); });
  await page.goto('/friends?view=scene&plan=' + id);
  await page.getByRole('button', { name: 'I agree — let me in →' }).click();
  await page.getByRole('button', { name: 'Retry linked plan' }).click();
  await expect(page.getByRole('region', { name: 'Linked plan' }).getByText(plan.title)).toBeVisible();
  expect(calls).toBe(2);
  expect(chatReads).toBe(0);
  expect(writes).toBe(0);
 });
 for (const scenario of ['authorized', 'unavailable', 'digest'] as const) {
  test(`an ordinary Scene post notification is handled safely: ${scenario}`, async ({ page }) => {
    const id = '00000000-0000-4000-8000-000000000902';
    const post = { id, kind: 'post', title: 'QA linked discussion', authorName: 'QA Host', isMine: false,
      category: 'hang', commentCount: 1, body: 'An older discussion outside the default feed' };
    let commentReads = 0;
    await page.route(url => url.pathname === '/api/friend/activities', route => {
      const search = new URL(route.request().url()).searchParams;
      if (!search.has('plan')) return route.fulfill({ json: { activities: [] } });
      expect(search.get('plan')).toBe(id);
      expect(search.get('surface')).toBe(scenario === 'digest' ? 'home' : null);
      return scenario === 'unavailable'
        ? route.fulfill({ json: { activities: [] } })
        : route.fulfill({ json: { activities: [post] } });
    });
    await page.route(`**/api/friend/activities/${id}/comments`, route => {
      expect(route.request().method()).toBe('GET');
      commentReads++;
      return route.fulfill({ json: { comments: [{ id: 'qa-comment', body: 'QA reply', name: 'QA Host' }] } });
    });
    await page.goto('/friends?view=scene&plan=' + id + (scenario === 'digest' ? '&from=daily-activity-drop' : ''));
    await page.getByRole('button', { name: 'I agree — let me in →' }).click();
    if (scenario === 'authorized') {
      const item = page.getByRole('region', { name: 'Linked post' });
      await expect(item.getByText(post.title)).toBeVisible();
      expect(commentReads).toBe(0);
      await item.getByTitle('comments', { exact: true }).click();
      await expect(item.getByText('QA reply', { exact: true })).toBeVisible();
      expect(commentReads).toBe(1);
    } else {
      await expect(page.getByText('This link is not available to you.')).toBeVisible();
      await expect(page.getByText(post.title)).toHaveCount(0);
      expect(commentReads).toBe(0);
    }
  });
 }
 test('clubs remain distinct from external communities and club chat retains its draft',async({page})=>{
  await page.route(`**/api/friend/clubs/${clubId}/messages`,r=>r.fulfill({json:{messages:[]}}));
  await page.goto('/friends?view=pulse');await page.getByRole('button',{name:'I agree — let me in →'}).click();
  await expect(page.getByRole('navigation',{name:'Friendship sections'}).getByRole('button',{name:/clubs & communities/})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByText('Clubs meet and chat here. Community links take you to an external group.')).toBeVisible();
  await expect(page.getByRole('link',{name:/QA External Community/})).toHaveAttribute('target','_blank');
  await page.getByRole('button',{name:'chat →',exact:true}).click();await expect(page).toHaveURL(new RegExp(`club=${clubId}`));
  const dialog=page.getByRole('dialog',{name:'QA Walking Club club chat'});
  await dialog.getByRole('textbox',{name:'message QA Walking Club'}).fill('Keep this club draft');
  await dialog.getByRole('button',{name:'close club chat'}).click();
  await page.getByRole('button',{name:'chat →',exact:true}).click();
  await expect(dialog.getByRole('textbox',{name:'message QA Walking Club'})).toHaveValue('Keep this club draft');
 });
 test('failed club and community loads never look like empty inventory',async({page})=>{
  let failed=true;
  await page.route('**/api/friend/clubs',r=>r.fulfill({status:failed?503:200,json:{clubs:[club]}}));
  await page.route('**/api/friend/community-links',r=>r.fulfill({status:failed?503:200,json:{links:[]}}));
  await page.goto('/friends?view=pulse');await page.getByRole('button',{name:'I agree — let me in →'}).click();
  await expect(page.getByText('Clubs could not be loaded. Use retry above.')).toBeVisible();
  await expect(page.getByText('No clubs in your city yet. Start one around something you enjoy.')).toHaveCount(0);
  failed=false;await page.getByRole('button',{name:'retry',exact:true}).click();
  await expect(page.getByText('QA Walking Club',{exact:true})).toBeVisible();
  await expect(page.getByText('No community links yet. Submit an external group for review.')).toBeVisible();
 });
 test('people controls preserve explicit connection gates and profile tools stay secondary',async({page})=>{
  await page.route('**/api/friend/roster',r=>r.fulfill({json:{matches:[{otherId:'00000000-0000-4000-8000-000000000772',name:'QA Incoming',theyAccepted:true,iAccepted:false,connected:false}],sealedCount:0}}));
  await page.goto('/friends?view=crew');await page.getByRole('button',{name:'I agree — let me in →'}).click();
  await expect(page.getByText('QA wants to connect',{exact:true})).toBeVisible();
  const tools=page.locator('details').filter({has:page.getByText('Your Friend profile & preferences',{exact:true})});
  await expect(tools).not.toHaveAttribute('open','');await tools.locator('summary').click();
  await expect(page.getByRole('link',{name:'retake quiz',exact:true})).toBeVisible();
  await page.getByRole('button',{name:/QA wants to connect/}).click();
  await expect(page.getByRole('button',{name:/connect/}).first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
 test('Friend profile retains unsaved text when an explicit save fails',async({page})=>{
  let saves=0;await page.route('**/api/profile',r=>{if(r.request().method()==='PUT'){saves++;return r.fulfill({status:503,json:{error:'QA save unavailable'}});}return r.continue();});
  await page.goto('/friends/profile');const bio=page.getByPlaceholder("who are you when you're not working? what's your ideal weekend?");
  await bio.fill('Keep my Friend profile draft');expect(saves).toBe(0);
  await page.getByRole('button',{name:'save my card →'}).click();
  await expect(page.getByText('QA save unavailable',{exact:true})).toBeVisible();await expect(bio).toHaveValue('Keep my Friend profile draft');expect(saves).toBe(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
 test('Friend guide explains user choice and keeps included versus optional benefits clear',async({page})=>{
  await page.goto('/friends/how-it-works');await expect(page.getByRole('heading',{name:'Find your next friend.'})).toBeVisible();
  await expect(page.getByText(/you decide what happens next/)).toBeVisible();
  await expect(page.getByRole('heading',{name:'Included and optional'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Explore Friendship →'})).toHaveAttribute('href','/friends');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
 test('pack opens by keyboard without decorative motion and preserves consent before connecting',async({page})=>{
  let opens=0;
  await page.route('**/api/friend/pack',r=>{if(r.request().method()==='POST'){opens++;return r.fulfill({json:{ok:true}});}return r.fulfill({json:{sealed:[{otherId:'qa-pack-person',name:'QA Person',age:30,sharedActivities:['Coffee'],score:75}],openedCount:0}});});
  await page.goto('/friends/pack');const pack=page.getByRole('button',{name:'Open your friendship pack'});await pack.focus();
  expect(await pack.evaluate(e=>getComputedStyle(e).animationName)).toBe('none');await pack.press('Enter');
  await expect(page.getByRole('heading',{name:'meet your people'})).toBeVisible();expect(opens).toBe(1);
  await expect(page.getByRole('button',{name:'🤝 connect'})).toBeDisabled();
  await page.getByRole('checkbox').click();await expect(page.getByRole('button',{name:'🤝 connect'})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
});
