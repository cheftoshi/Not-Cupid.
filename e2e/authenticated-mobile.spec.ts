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

  test('Home read APIs work against the migrated database in the isolated test realm', async ({ page }) => {
    for(const path of ['/api/friend/activities?surface=home','/api/friend/activities?surface=home&scope=conversations','/api/date-plans?surface=home']) {
      const response=await page.request.get(path);
      expect(response.status(),path).toBe(200);
      expect(Array.isArray((await response.json()).activities)).toBe(true);
    }
  });

  test('Home creates a free blind date with a participant-only public venue', async ({ page }) => {
    let posted: any;
    await page.route('**/api/friend/activities?*', route => route.fulfill({ json: {activities:[],areas:['Back Bay','Cambridge'],origin:'Back Bay'} }));
    await page.route('**/api/date-plans*', route => {
      if(route.request().method()==='POST') {posted=route.request().postDataJSON();return route.fulfill({json:{ok:true,id:posted.client_id}});}
      return route.fulfill({json:{activities:[]}});
    });
    await page.goto('/hub');
    await page.getByRole('button',{name:'＋ Invite someone',exact:true}).click();
    const form=page.getByRole('form',{name:'Create an invitation'});
    await form.getByLabel('Your invitation').fill('A coffee and a walk?');
    await form.getByLabel('What kind of connection?').selectOption('date');
    await form.getByLabel('Date style').selectOption('blind');
    await form.getByLabel('Women',{exact:true}).check();
    await form.getByRole('button',{name:'Add a public place'}).click();
    await form.getByLabel('Public meeting place',{exact:true}).fill('QA café');
    await form.getByLabel('This is a public place, not a home address.').check();
    await form.getByRole('button',{name:'Create invitation',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Your invitation is published.'})).toBeVisible();
    expect(posted).toMatchObject({capacity:2,date_mode:'blind',genders:['f'],visibility:'participants',area:'Back Bay',location:'QA café'});
    expect(posted.client_id).toMatch(/^[a-f0-9-]{36}$/);
  });

  test('Home accepts one free date request and opens a recoverable mobile conversation', async ({ page }) => {
    const id='00000000-0000-4000-8000-000000000901';let accepted=false;const attempts:string[]=[];
    const person={name:'QA Guest',age:30,gender:'f',photo:null,bio:'Coffee and walks',interests:['Walking']};
    await page.route('**/api/friend/activities?*', route=>route.fulfill({json:{activities:[],areas:['Back Bay'],origin:'Back Bay'}}));
    await page.route('**/api/date-plans?*',route=>route.fulfill({json:{activities:[{id,title:'QA coffee date',kind:'event',connectionKind:'date',dateMode:'blind',state:accepted?'confirmed':'open',area:'Back Bay',location:accepted?'QA café':null,locationVisibility:'participants',locationHidden:!accepted,capacity:2,isMine:true,eligible:false,canChat:accepted,myResponse:accepted?'yes':null,authorName:'You',authorProfile:person,audienceGender:['f'],responses:{yes:accepted?2:1,maybe:0,no:0},expires_at:'2099-01-01T00:00:00Z',partner:accepted?person:null,requests:accepted?[]:[{id:'00000000-0000-4000-8000-000000000902',profile:{...person,name:'A little mystery',bio:null}}]}]}}));
    await page.route(`**/api/date-plans/${id}`,route=>{expect(route.request().postDataJSON().action).toBe('accept');accepted=true;return route.fulfill({json:{ok:true}});});
    await page.route(`**/api/date-plans/${id}/messages`,route=>{
      if(route.request().method()==='GET')return route.fulfill({json:{comments:[]}});
      const body=route.request().postDataJSON();attempts.push(body.client_id);
      return attempts.length===1?route.abort('connectionfailed'):route.fulfill({json:{comment:{id:'qa-date-message',body:body.body,isMe:true,name:'You',clientId:body.client_id}}});
    });
    await page.goto('/hub');
    await page.getByRole('button',{name:'Dates',exact:true}).click();
    await page.getByRole('button',{name:'Accept request',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Your conversations'});
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('QA café',{exact:true})).toBeVisible();
    const input=dialog.getByLabel('Message the plan');await input.fill('See you soon');
    await dialog.getByRole('button',{name:'Send message',exact:true}).click();
    await expect(input).toHaveValue('See you soon');
    await expect(dialog.getByRole('alert')).toContainText('Send not confirmed');
    await dialog.getByRole('button',{name:'Send message',exact:true}).click();
    await expect(input).toHaveValue('');expect(attempts[1]).toBe(attempts[0]);
    await expect(dialog.getByText('See you soon',{exact:true})).toHaveCount(1);
    await page.setViewportSize({width:390,height:440});
    await input.fill('Draft stays here');await input.scrollIntoViewIfNeeded();await expect(input).toBeInViewport();
    await dialog.getByRole('button',{name:'Close conversations'}).click();
    await page.getByRole('button',{name:/^Conversations ·/}).click();await expect(input).toHaveValue('Draft stays here');
  });

  test('Hub keeps the composer reachable after focus and a short viewport', async ({ page }) => {
    await page.goto('/hub?view=coach');
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
    await page.goto('/hub?view=coach');
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

  test('blocked realtime does not crash Friend chat and HTTP polling still receives replies', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.WebSocket = class extends WebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          // Throw before any connection can leave the browser.
          throw new DOMException('QA blocks realtime', 'SecurityError');
          super(url, protocols);
        }
      };
    });
    const otherId = '00000000-0000-4000-8000-000000000112';
    let reads = 0;
    let replyReady = false;
    await page.route('**/api/friend/roster', route => route.fulfill({ json: {
      matches: [{ otherId, name: 'QA Friend', connected: true, iAccepted: true, theyAccepted: true }], sealedCount: 0,
    } }));
    await page.route('**/api/friend/dm*', route => {
      reads++;
      return route.fulfill({ json: {
        realtimeTopic: 'qa-blocked-channel', unread: {},
        messages: replyReady ? [{ id: 'qa-reply', body: 'Reply through polling', isMe: false }] : [],
      } });
    });
    await page.goto(`/friends?dm=${otherId}`);
    await page.getByRole('button', { name: 'I agree — let me in →' }).click();
    const dialog = page.getByRole('dialog', { name: 'private chat with QA' });
    await expect(dialog).toBeVisible();
    replyReady = true;
    await expect(dialog.getByText('Reply through polling', { exact: true })).toBeVisible({ timeout: 12_000 });
    expect(reads).toBeGreaterThan(1);
    expect(errors).toEqual([]);
  });

  test('confirmed plan interest opens chat, retries loading, and keeps starter text unsent', async ({ page }) => {
    const id = '00000000-0000-4000-8000-000000000141';
    const plan = { id, title: 'QA walk', kind: 'event', authorName: 'QA Host', eligible: true,
      created_at: new Date().toISOString(), happens_at: new Date(Date.now() + 86400000).toISOString(),
      isMine: false, myResponse: null, responses: { yes: 0, maybe: 0, no: 0 } };
    let joined = false, recovered = false, sends = 0;
    await page.route('**/api/friend/activities', route => route.fulfill({ json: { activities: [{ ...plan, myResponse: joined ? 'yes' : null }] } }));
    await page.route(`**/api/friend/activities/${id}/rsvp`, route => {
      const response = route.request().postDataJSON().response;
      joined = response === 'yes';
      return route.fulfill({ json: { joined: true, count: 1, myResponse: response, responses: { yes: joined ? 1 : 0, maybe: joined ? 0 : 1, no: 0 } } });
    });
    await page.route(`**/api/friend/activities/${id}/comments`, route => {
      if (route.request().method() === 'POST') { sends++; return route.fulfill({ status: 503, json: {} }); }
      return route.fulfill({ status: recovered ? 200 : 503, json: recovered ? { comments: [] } : {} });
    });
    await page.goto('/friends?view=scene');
    await page.getByRole('button', { name: 'I agree — let me in →' }).click();
    const card = page.locator(`#scene-plan-${id}`);
    await card.getByRole('button', { name: /save/ }).click();
    await expect(card.getByPlaceholder('message the plan…')).toHaveCount(0);
    await card.getByRole('button', { name: /i’m interested/ }).click();
    await expect(card.getByRole('alert')).toBeVisible();
    await expect(card.getByText('no messages yet — ask the organizer anything.')).toHaveCount(0);
    recovered = true;
    await card.getByRole('button', { name: 'Retry conversation' }).click();
    await expect(card.getByText('no messages yet — ask the organizer anything.')).toBeVisible();
    await card.getByRole('button', { name: 'Add a conversation starter' }).click();
    const input = card.getByPlaceholder('message the plan…');
    await expect(input).toHaveValue('Hi! Is this plan still happening, and where should we meet?');
    expect(sends).toBe(0);
    await card.getByRole('button', { name: 'send', exact: true }).click();
    await expect(input).toHaveValue('Hi! Is this plan still happening, and where should we meet?');
    expect(sends).toBe(1);
  });

  test('Love feedback is optional, explicit, and does not change preferences', async ({ page }) => {
    // WebKit's intercepted Blob beacon may omit postData; exercise the real
    // fetch fallback so this assertion can inspect the structured payload.
    await page.addInitScript(() => { navigator.sendBeacon = () => false; });
    const events: any[] = [];
    await page.route('**/api/match/roster', route => route.fulfill({ json: { roster: [
      { id: '00000000-0000-4000-8000-000000000151', name: 'QA Option', age: 30, score: 70 },
    ], includedPicksRemaining: 3 } }));
    await page.route('**/api/love/events', route => { events.push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); });
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'none of these feel right today' }).click();
    const feedback = page.getByRole('region', { name: 'Roster feedback' });
    await feedback.getByRole('button', { name: 'More shared interests' }).click();
    await expect(feedback.getByRole('status')).toContainText('unchanged');
    await expect.poll(() => events.filter(e => e.eventName === 'no_suitable_choice').length).toBe(1);
    await expect.poll(() => events.filter(e => e.eventName === 'roster_feedback').length).toBe(1);
    expect(events.find(e => e.eventName === 'roster_feedback').metadata.reason).toBe('interests');
    await expect(feedback.getByRole('button', { name: 'More shared interests' })).toBeDisabled();
    await expect(feedback.getByRole('link', { name: 'Review my preferences' })).toHaveAttribute('href', '/profile');
  });

  test('a stale Love choice closes its preview and another included choice remains usable', async ({ page }) => {
    const candidates = [
      { id: '00000000-0000-4000-8000-000000000121', name: 'QAFirst', age: 30, score: 75 },
      { id: '00000000-0000-4000-8000-000000000122', name: 'QASecond', age: 31, score: 72 },
    ];
    let rejected = false;
    const picks: string[] = [];
    await page.route('**/api/match/roster', route => route.fulfill({ json: {
      roster: rejected ? [candidates[1]] : candidates, includedPicksRemaining: 3,
      atCapacity: false, pro: false, ghosted: false,
    } }));
    await page.route('**/api/match/pick', route => {
      const id = route.request().postDataJSON().candidateId;
      picks.push(id);
      if (id === candidates[0].id) {
        rejected = true;
        return route.fulfill({ status: 403, json: { code: 'stale_roster', error: 'That roster changed. We refreshed your current options.' } });
      }
      return route.fulfill({ json: { ok: true, accessType: 'included' } });
    });
    await page.goto('/dashboard');
    await page.getByRole('button', { name: "View QAFirst's profile", exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /choose QAFirst · included/ }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('That roster changed. We refreshed your current options.')).toBeVisible();
    await page.getByRole('button', { name: /choose QASecond · included/ }).click();
    await expect.poll(() => picks.length).toBe(2);
    expect(picks).toEqual(candidates.map(candidate => candidate.id));
    // Both selection responses are mocked; no real invitation is created.
  });
});
