import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { signFriendEventToken, verifyFriendEventToken } from '../lib/friend-event-campaign.ts';
const key='synthetic-local-test-key-not-production-12345';
const user='10000000-0000-0000-0000-000000000001';
const delivery='20000000-0000-0000-0000-000000000001';
const payload={purpose:'attribution',userId:user,channel:'email',deliveryId:delivery,expires:20000};
test('signed tokens are purpose scoped, tamper proof, expiring and fail closed without a key',()=>{
 const token=signFriendEventToken(payload,key);
 assert.deepEqual(verifyFriendEventToken(token,'attribution',10000,key),payload);
 assert.equal(verifyFriendEventToken(token,'unsubscribe',10000,key),null);
 assert.equal(verifyFriendEventToken(token,'attribution',20000,key),null);
 assert.equal(verifyFriendEventToken(token+'x','attribution',10000,key),null);
 assert.equal(verifyFriendEventToken(token,'attribution',10000,'other-key-that-is-longer-than-32-characters'),null);
 assert.equal(verifyFriendEventToken(token,'attribution',10000,''),null);
 assert.throws(()=>signFriendEventToken({...payload,deliveryId:'invalid'},key));
 assert.throws(()=>signFriendEventToken(payload,''));
});
test('local SQL: no opt-in backfill; channel-specific consent; claim approvals, suppressions and dedupe',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create table public.users(id uuid primary key,email text,is_test boolean default false,is_blocked boolean default false,deleted_at timestamptz,friend_opted_in_at timestamptz,email_notifications boolean default true,notifications_paused_at timestamptz);
 create table public.push_subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid);
 insert into users(id,email,friend_opted_in_at) values('${user}','synthetic@example.test',now());`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261113162841_friend_event_campaign_foundation.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../supabase/migrations/20261113163514_friend_event_delivery_reporting.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../supabase/migrations/20261113163859_friend_event_reconcile_acceptance_fix.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../supabase/migrations/20261113164351_friend_event_frozen_sender_gate.sql',import.meta.url),'utf8'));
 const scalar=async(sql,params=[]) => (await db.query(sql,params)).rows[0]?.value;
 const claim=async(campaign='friend_events_test',channel='email',admins=['admin@example.test'])=>scalar('select claim_friend_event_delivery($1,$2,$3,$4) as value',[user,campaign,channel,admins]);
 assert.equal(await scalar('select count(*)::int as value from friend_event_preferences'),0);
 await db.exec("insert into friend_event_campaigns(id,content_version,expires_at) values('friend_events_test','v1',now()+interval '1 day')");
 assert.equal(await claim(),null);
 await db.query("select set_friend_event_preference($1,'email',true,'profile')",[user]);
 assert.equal(await scalar('select push_enabled as value from friend_event_preferences'),false);
 assert.equal(await claim(),null); // approval remains absent
 await db.exec("update friend_event_campaigns set send_enabled=true,approved_at=now()");
 assert.equal(await claim('friend_events_test','email',[]),null);
 assert.equal(await claim('friend_events_test','email',['synthetic@example.test']),null);
 for(const patch of ['is_test=true','is_blocked=true','deleted_at=now()','email_notifications=false','notifications_paused_at=now()','friend_opted_in_at=null']) {
  await db.exec('update users set '+patch);
  assert.equal(await claim(),null,patch);
  await db.exec('update users set is_test=false,is_blocked=false,deleted_at=null,email_notifications=true,notifications_paused_at=null,friend_opted_in_at=now()');
 }
 assert.equal(await claim('friend_events_test','push'),null);
 await db.query("insert into friend_event_suppressions(user_id,channel,reason) values($1,'email','complaint')",[user]);
 assert.equal(await claim(),null);
 await db.exec('delete from friend_event_suppressions');
 const id=await claim(); assert.ok(id);
 assert.equal(await claim(),null);
 await db.exec("insert into friend_event_campaigns(id,content_version,expires_at,send_enabled,approved_at) values('friend_events_second','v1',now()+interval '1 day',true,now())");
 assert.equal(await claim('friend_events_second'),null); // weekly frequency across campaigns
 await db.query("select set_friend_event_preference($1,'push',true,'profile')",[user]);
 assert.equal(await claim('friend_events_test','push'),null); // missing device
 await db.query('insert into push_subscriptions(user_id) values($1)',[user]);
 assert.ok(await claim('friend_events_test','push'));
 await db.query("select set_friend_event_preference($1,'email',false,'signed_unsubscribe')",[user]);
 assert.equal(await scalar('select push_enabled as value from friend_event_preferences'),true);
 assert.equal(await scalar('select email_enabled as value from friend_event_preferences'),false);
 assert.equal(await scalar('select email_notifications as value from users'),true);
 await assert.rejects(db.query("select set_friend_event_preference($1,'email',true,'signed_unsubscribe')",[user]));
 const lifecycle=async(type,eventId,provider='synthetic-provider')=>scalar('select reconcile_friend_event_email($1,$2,$3,$4,$5,now()) as value',[id,'friend_events_test',provider,eventId,type]);
 assert.equal(await lifecycle('email.sent','synthetic-event-1'),true);
 assert.equal(await lifecycle('email.delivered','synthetic-event-2'),true);
 assert.equal(await lifecycle('email.delivered','synthetic-event-2'),true); // replay
 assert.equal(await scalar('select count(*)::int as value from friend_event_provider_events'),2);
 assert.equal(await lifecycle('email.complained','synthetic-event-3'),true);
 assert.equal(await lifecycle('email.delivered','synthetic-event-4'),true); // out of order
 assert.equal(await scalar("select status as value from friend_event_deliveries where channel='email'"),'suppressed');
 assert.equal(await scalar("select reason as value from friend_event_suppressions where channel='email'"),'complaint');
 assert.equal(await lifecycle('email.bounced','synthetic-event-5','wrong-provider'),false);
 assert.equal(await lifecycle('email.bounced','synthetic-event-6'),true);
 assert.equal(await scalar("select reason as value from friend_event_suppressions where channel='email'"),'complaint');
 await db.query("insert into friend_event_attribution(delivery_id,event) values($1,'link_request'),($1,'authenticated_return'),($1,'plan_join'),($1,'plan_create')",[id]);
 const report=(await db.query("select * from friend_event_campaign_report('friend_events_test') where channel='email'")).rows[0];
 for (const field of ['claimed','provider_accepted','delivered','suppressed','bounced','complained','raw_link_requests','authenticated_returns','plan_joiners','plan_creators','meaningful_action_users']) assert.equal(Number(report[field]),1,field);
 assert.equal(await scalar('select email_notifications as value from users'),true); // provider reconciliation never overwrites existing settings
 // Frozen sender gate rejects absent/same-step approval, then claims the reviewed ID.
 await db.query("select set_friend_event_preference($1,'email',true,'profile')",[user]);
 await db.exec("delete from friend_event_suppressions; update friend_event_deliveries set claimed_at=now()-interval '8 days'; insert into friend_event_campaigns(id,content_version,expires_at,send_enabled,approved_at) values('friend_events_frozen','v1',now()+interval '1 day',true,now())");
 const frozenId='30000000-0000-0000-0000-000000000001', hash='a'.repeat(64);
 const frozenClaim=()=>scalar('select claim_frozen_friend_event_delivery($1,$2,$3,$4,$5,$6) as value',[user,'friend_events_frozen','email',['admin@example.test'],frozenId,hash]);
 assert.equal(await frozenClaim(),null);
 await db.query("update friend_event_campaigns set manifest_hash=$1,recipient_count=1,content_approved_at=now(),send_approved_at=now() where id='friend_events_frozen'",[hash]);
 assert.equal(await frozenClaim(),null);
 await db.exec("update friend_event_campaigns set content_approved_at=now()-interval '1 minute' where id='friend_events_frozen'");
 assert.equal(await frozenClaim(),frozenId);
 assert.equal(await frozenClaim(),null);
 const grants=await db.query("select has_function_privilege('anon','public.claim_friend_event_delivery(uuid,text,text,text[])','execute') as allowed");
 assert.equal(grants.rows[0].allowed,false);
 } finally {await db.close();}
});

test('authenticated attribution refuses forwarded links, stale/unknown deliveries and missing cookies',async()=>{
 const {loadTs}=await import('./helpers/load-ts.mjs');
 let owner=user, token='signed', found=true, writes=0, queries=0;
 const q={select:()=>q,eq:()=>q,in:()=>q,gte:()=>q,maybeSingle:async()=>({data:found?{id:delivery}:null,error:null}),upsert:async()=>{writes++;return {error:null};}};
 const {recordFriendEventConversion}=await loadTs('lib/friend-event-attribution.ts',{
  'next/headers':{cookies:async()=>({get:()=>token?{value:token}:undefined})},
  '@/lib/friend-event-campaign':{FRIEND_EVENT_COOKIE:'test',verifyFriendEventToken:t=>t?{...payload,userId:owner}:null},
  '@/lib/supabase':{supabaseAdmin:{from:()=>{queries++;return q;}}},
 });
 token='';await recordFriendEventConversion(user,'authenticated_return');assert.equal(queries,0);
 token='signed';owner='other-user';await recordFriendEventConversion(user,'plan_join');assert.equal(queries,0);
 owner=user;found=false;await recordFriendEventConversion(user,'plan_join');assert.equal(writes,0);
 found=true;await recordFriendEventConversion(user,'plan_join');assert.equal(writes,1);
});

test('preferences require authentication, same origin, exact version and use session owner only',async()=>{
 const {loadTs,nextMock}=await import('./helpers/load-ts.mjs');
 let current=null;const writes=[];
 const {PUT}=await loadTs('app/api/friend-event-preferences/route.ts',{
  'next/server':nextMock,'@/lib/auth':{getCurrentUser:async()=>current},
  '@/lib/friend-event-campaign':{FRIEND_EVENT_CONSENT_VERSION:'friend-events-v1'},
  '@/lib/supabase':{supabaseAdmin:{rpc:async(name,args)=>{writes.push(args);return {error:null};}}},
 });
 const invoke=(body,origin='https://example.test')=>PUT({headers:new Headers({origin}),nextUrl:new URL('https://example.test/api'),json:async()=>body});
 const body={channel:'email',enabled:true,version:'friend-events-v1',userId:'someone-else'};
 assert.equal((await invoke(body)).status,401);
 current={id:user};assert.equal((await invoke(body,'https://attacker.test')).status,403);
 assert.equal((await invoke({...body,version:'old'})).status,400);
 assert.equal((await invoke({...body,enabled:'true'})).status,400);
 assert.equal((await invoke(body)).status,200);assert.equal(writes.length,1);assert.equal(writes[0].p_user,user);
});
