import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, nextMock } from './helpers/load-ts.mjs';
import { metroOf, METRO_ZIP } from '../lib/quiz-data.ts';
import { planWhen, planLocalTime, planTimeMatches, planReturnPath, validateSocialPlan } from '../lib/plan-discovery.ts';

test('all NYC boroughs remain NYC; neighboring pools stay explicit', () => {
  for (const zip of ['10001','11201','10451','11101','11375','11432','10301','11691']) assert.equal(metroOf(zip), 'nyc', zip);
  assert.equal(metroOf('07302'), 'northjersey');
  assert.equal(metroOf('02903'), 'providence');
  assert.equal(metroOf('02108'), 'boston');
  assert.equal(metroOf('99999'), null);
  for (const [metro, zip] of Object.entries(METRO_ZIP)) assert.equal(metroOf(zip), metro);
});
test('city time handles DST and rejects ambiguous/nonexistent local times', () => {
  assert.equal(planLocalTime('2026-07-10T18:30').toISOString(), '2026-07-10T22:30:00.000Z');
  assert.equal(planLocalTime('2026-12-10T18:30').toISOString(), '2026-12-10T23:30:00.000Z');
  assert.throws(() => planLocalTime('2026-03-08T02:30'));
  assert.throws(() => planLocalTime('2026-11-01T01:30'));
  assert.match(planWhen('2026-07-10T22:30:00Z'), /6:30 PM EDT/);
  assert.match(planWhen('2026-12-10T23:30:00Z'), /6:30 PM EST/);
  assert.equal(planTimeMatches('2026-07-11T02:00:00Z', 'today', Date.parse('2026-07-10T23:00:00Z')), true);
});
test('new social plans are small groups with bounded schedule', () => {
  const now = Date.parse('2026-09-27T12:00:00Z');
  assert.equal(validateSocialPlan(null, undefined, now), 4);
  assert.equal(validateSocialPlan(new Date(now+60*86400000), 10, now), 10);
  for (const capacity of [0,1,11,1000,3.5,'invalid']) assert.throws(() => validateSocialPlan(null, capacity, now));
  assert.throws(() => validateSocialPlan(new Date(now+61*86400000), 4, now));
});
test('onboarding return only allows bounded plan or city destinations', () => {
  const path='/hub?plan=00000000-0000-4000-8000-000000000123';
  assert.equal(planReturnPath(path), path);
  assert.equal(planReturnPath('/hub?city=nyc'), '/hub?city=nyc');
  for (const path of ['//evil.example','/admin','/hub?plan=123','/hub?city=nyc&next=//evil','https://evil.example','/hub?city=nyc\\evil']) assert.equal(planReturnPath(path), null);
});
test('discovery changes do not overwrite home ZIP or roster', async () => {
  let update;
  const route = await loadTs('app/api/profile/set-city/route.ts', {
    'next/server': nextMock, '@/lib/auth': { getCurrentUser: async()=>({id:'user'}) },
    '@/lib/supabase': { supabaseAdmin: { from:()=>({update: row => { update=row; return {eq:async()=>({error:null})}; }}) } },
    '@/lib/quiz-data': { METRO_ZIP, METRO_CENTERS:{nyc:{city:'New York',state:'NY'}},metroOf },
  });
  const response=await route.POST(new Request('http://localhost/api/profile/set-city', {method:'POST',body:JSON.stringify({metro:'nyc'})}));
  assert.equal(response.status,200);
  assert.deepEqual(update,{discovery_metro:'nyc'});
});
test('public projection restricts city/audience/realm before limit and hides venue', async () => {
  const calls=[];
  const chain=new Proxy({}, {get:(_,key)=> (...args)=>{calls.push([key,...args]);if(key==='limit') return Promise.resolve({data:[{id:'plan',title:'Coffee',area:'Queens',users:{name:'Host Name'},venue:'PRIVATE'}],error:null});return chain;}});
  const {publicPlans}=await loadTs('lib/public-plans.ts', {'@/lib/supabase':{supabaseAdmin:{from:()=>chain}}});
  const result=await publicPlans({metro:'nyc'});
  assert.ok(calls.findIndex(x=>x[0]==='eq'&&x[1]==='metro')<calls.findIndex(x=>x[0]==='limit'));
  assert.ok(calls.some(x=>x[0]==='is'&&x[1]==='users.deleted_at'));
  assert.ok(calls.some(x=>x[0]==='not'&&x[1]==='users.is_blocked'));
  assert.ok(calls.some(x=>x[0]==='is'&&x[1]==='audience_age_min'));
  assert.equal(result[0].hostFirst,'Host');
  assert.equal('venue' in result[0],false);
});
test('metro metrics paginate past 1000 and separate recent activity from pool eligibility', async () => {
  const rows=Array.from({length:1001},(_,i)=>({id:String(i),zip:'10001',gender:'f',status:'waiting',pool_active:true,last_seen_at:i===0?new Date().toISOString():null}));
  const offsets=[];
  const chain=new Proxy({}, {get:(_,key)=>(...args)=>{if(key==='range'){offsets.push(args[0]);return Promise.resolve({data:rows.slice(args[0],args[1]+1),error:null});}return chain;}});
  const route=await loadTs('app/api/admin/metro-health/route.ts', {
    'next/server':nextMock, '@/lib/admin':{getCurrentAdmin:async()=>({id:'admin'})},
    '@/lib/supabase':{supabaseAdmin:{from:()=>chain,rpc:async()=>({data:[],error:null})}},
    '@/lib/quiz-data':{metroOf,METRO_CENTERS:{nyc:{city:'NYC',state:'NY'}}},
  });
  const response=await route.GET();const data=await response.json();
  assert.equal(data.totals.total,1001);assert.equal(data.metros[0].active,1);assert.equal(data.metros[0].eligible,1001);
  assert.deepEqual(offsets,[0,500,1000]);
});

test('outcome feedback rejects strangers and future dates, accepts only a confirmed participant', async () => {
  let current={id:'user',age:30};
  let plan=null;
  let saved=null;
  const route=await loadTs('app/api/plans/outcome/route.ts', {
    'next/server':nextMock, '@/lib/auth':{getCurrentUser:async()=>current},
    '@/lib/supabase':{supabaseAdmin:{from:()=>({upsert:async row=>{saved=row;return {error:null};}})}},
    '@/lib/date-plan-server':{accessibleDatePlan:async()=>plan},
    '@/lib/date-plan-policy':{dateParticipant:(p,id)=>p.host_id===id||p.guest_id===id},
    '@/lib/friend-activity-access':{friendActivityAuthorAvailable:async()=>true},
    '@/lib/rate-limit':{rateLimit:async()=>({ok:true})},
  });
  const request=()=>new Request('http://localhost/api/plans/outcome',{method:'POST',body:JSON.stringify({planId:'00000000-0000-4000-8000-000000000123',kind:'date',met:true,meetAgain:true})});
  assert.equal((await route.POST(request())).status,403);
  plan={guest_id:'user',host_id:'host',metro:'nyc',state:'confirmed',happens_at:new Date(Date.now()+86400000).toISOString()};
  assert.equal((await route.POST(request())).status,403);
  plan.happens_at=new Date(Date.now()-86400000).toISOString();
  assert.equal((await route.POST(request())).status,200);
  assert.equal(saved.user_id,'user');assert.equal(saved.metro,'nyc');
  current=null;
  assert.equal((await route.POST(request())).status,401);
});
