import {neutralFriendDiscoveryReview} from '../lib/friend-discovery-privacy.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loadTs,nextMock} from './helpers/load-ts.mjs';
import * as policy from '../lib/friday-friends-policy.ts';
import {friendCampaignHash} from '../lib/friend-event-sender.ts';
import {checkFriendEventSuppression} from '../lib/friend-event-suppression.ts';
const {executeFridayFriends,boundedFridayIO}=await loadTs('lib/friday-friends-executor.ts',{'@/lib/friend-event-sender':{friendCampaignHash},'@/lib/friday-friends-policy':policy});
const now=Date.parse('2026-11-27T19:02:00Z');
const entry=()=>({deliveryId:randomUUID(),userId:randomUUID(),channel:'email',email:{to:'synthetic@example.test',from:'NotCupid <match@notcupid.com>',replyTo:'match@notcupid.com',subject:'What’s happening near you this weekend?',html:'synthetic',text:'synthetic',unsubscribeUrl:'https://notcupid.com/unsubscribe?u=synthetic&t=synthetic',unsubscribePostUrl:'https://notcupid.com/api/unsubscribe?u=synthetic&t=synthetic'},recommendations:[{key:'event:synthetic'}]});
const fixture=()=>({purpose:'friend_discovery_review',campaign:'friend_events_announcement_discovery_20261123_weekend_friday_r1',version:policy.FRIDAY_FRIENDS_VERSION,edition:'weekend',cadence:'once-weekly',fridayDay:'2026-11-27',windowStart:Date.parse('2026-11-27T19:00:00Z'),windowEnd:Date.parse('2026-11-27T19:15:00Z'),expires:Date.parse('2026-11-27T19:15:00Z'),preparedAt:'2026-11-27T18:30:00Z',entries:[entry()]});
function deps(){const states=new Map();const d={sent:0,clock:now,approved:async()=>true,validEntry:async()=>true,now:()=>d.clock,state:async e=>states.get(e.deliveryId)||'new',claim:async e=>{if(states.has(e.deliveryId))return false;states.set(e.deliveryId,'uncertain');return true;},submit:async()=>{d.sent++;return 'synthetic-receipt';},receipt:async e=>{states.set(e.deliveryId,'accepted');},pace:async()=>{},states};return d;}
test('Friday worker resumes accepted receipts but never resubmits an unknown provider outcome',async()=>{
 const m=fixture(),d=deps();const h=friendCampaignHash(m);assert.equal((await executeFridayFriends(m,h,d)).accepted,1);assert.equal((await executeFridayFriends(m,h,d)).alreadyAccepted,1);assert.equal(d.sent,1);
 const u=fixture(),bad=deps();bad.submit=async()=>{bad.sent++;throw Error('timeout after possible acceptance');};assert.equal((await executeFridayFriends(u,friendCampaignHash(u),bad)).stopped,'uncertain_outcome_reconcile_before_retry');assert.equal((await executeFridayFriends(u,friendCampaignHash(u),bad)).stopped,'reconcile_claim_before_retry');assert.equal(bad.sent,1);
 const lost=fixture(),r=deps();r.receipt=async()=>{throw Error('receipt failed');};await executeFridayFriends(lost,friendCampaignHash(lost),r);await executeFridayFriends(lost,friendCampaignHash(lost),r);assert.equal(r.sent,1);
});
test('Friday worker fails closed on copy, scope, owner, eligibility, late run and post-claim deadline',async()=>{
 const m=fixture();for(const change of [{edition:'ideas'},{purpose:'friend_line_announcement'},{cadence:'twice-weekly'},{version:'old'},{entries:[m.entries[0],m.entries[0]]}]){const x={...m,...change},d=deps();assert.equal((await executeFridayFriends(x,friendCampaignHash(x),d)).stopped,'invalid_frozen_friday');assert.equal(d.sent,0);}
 assert.equal((await executeFridayFriends(m,'bad',deps())).stopped,'invalid_frozen_friday');
 for(const kind of ['approved','validEntry']){const d=deps();d[kind]=async()=>false;await executeFridayFriends(m,friendCampaignHash(m),d);assert.equal(d.sent,0);assert.equal(d.states.size,0);}
 const late=deps();late.clock=m.expires;assert.equal((await executeFridayFriends(m,friendCampaignHash(m),late)).stopped,'outside_friday_window');
 const race=deps(),claim=race.claim;race.claim=async e=>{const ok=await claim(e);race.clock=m.expires;return ok;};assert.equal((await executeFridayFriends(m,friendCampaignHash(m),race)).stopped,'changed_after_claim_reconcile');assert.equal(race.sent,0);assert.equal(race.states.size,1);
});
test('Friday pilot rejects oversized approvals before dependencies and reserves time before claiming',async()=>{
 assert.equal(policy.FRIDAY_PILOT_MAX_RECIPIENTS,1);
 const m=fixture();m.entries.push(entry());const d=deps();let touched=0;
 d.approved=async()=>{touched++;return true;};
 assert.equal((await executeFridayFriends(m,friendCampaignHash(m),d)).stopped,'pilot_size_exceeded');
 assert.equal(touched,0);assert.equal(d.sent,0);assert.equal(d.states.size,0);
 const one=fixture(),short=deps();short.deadline=now+policy.FRIDAY_CLAIM_RESERVE_MS-1;
 assert.equal((await executeFridayFriends(one,friendCampaignHash(one),short)).stopped,'insufficient_runtime_before_claim');assert.equal(short.states.size,0);
 const consumed=deps();consumed.deadline=now+policy.FRIDAY_CLAIM_RESERVE_MS+1000;consumed.validEntry=async()=>{consumed.clock+=1000;return true;};
 assert.equal((await executeFridayFriends(one,friendCampaignHash(one),consumed)).stopped,'insufficient_runtime_before_claim');assert.equal(consumed.states.size,0);
 const accepted=deps();accepted.deadline=now+1;accepted.states.set(one.entries[0].deliveryId,'accepted');
 assert.equal((await executeFridayFriends(one,friendCampaignHash(one),accepted)).alreadyAccepted,1);assert.equal(accepted.sent,0);
});
test('One-recipient synthetic near-timeout runtime fits route budget including submission checks',async t=>{
 const m=fixture(),d=deps(),start=d.clock,stage=policy.FRIDAY_IO_TIMEOUT_MS-100;
 d.deadline=start+policy.FRIDAY_RUNTIME_BUDGET_MS;
 d.clock+=stage; // Frozen draft fetch before worker entry.
 for(const name of ['approved','validEntry','state','claim','receipt']){const original=d[name];d[name]=async(...args)=>{d.clock+=stage;return original(...args);};}
 const submit=d.submit;d.submit=async(...args)=>{d.clock+=3*stage;return submit(...args);}; // bounded validate, approval, provider send
 const result=await executeFridayFriends(m,friendCampaignHash(m),d);
 assert.equal(result.accepted,1);assert.equal(d.clock-start,128700);
 assert.ok(d.clock-start<policy.FRIDAY_RUNTIME_BUDGET_MS);assert.ok(policy.FRIDAY_RUNTIME_BUDGET_MS<300000);
 t.diagnostic(`Synthetic near-timeout envelope: ${d.clock-start} ms including draft fetch; no real provider latency measured`);
});
test('Hung preflight, claim and receipt time out conservatively without automatic resubmission',async()=>{
 const saved=globalThis.setTimeout;globalThis.setTimeout=(fn,ms)=>saved(fn,ms===policy.FRIDAY_IO_TIMEOUT_MS?1:ms);
 try{
  for(const phase of ['approved','claim','receipt']){
   const m=fixture(),d=deps();
   d[phase]=async e=>{if(phase==='claim')d.states.set(e.deliveryId,'uncertain');return new Promise(()=>{});};
   const result=await executeFridayFriends(m,friendCampaignHash(m),d);
   assert.equal(result.stopped,'uncertain_outcome_reconcile_before_retry');
   assert.equal(d.sent,phase==='receipt'?1:0);
   if(phase!=='approved'){
    const again=await executeFridayFriends(m,friendCampaignHash(m),d);
    assert.equal(again.stopped,'reconcile_claim_before_retry');assert.equal(d.sent,phase==='receipt'?1:0);
   }else assert.equal(d.states.size,0);
  }
 }finally{globalThis.setTimeout=saved;}
});
test('Production-equivalent execute POST runs real adapter/worker with synthetic DB/provider and enforces owner test',async()=>{
 let fastTimeout=false,pacedMs=0;
 const savedNow=Date.now,savedTimeout=globalThis.setTimeout,keys=['FRIDAY_FRIENDS_SEND_VERSION','FRIDAY_FRIENDS_EXECUTION_TOKEN','FRIDAY_FRIENDS_EXECUTION_EXPIRES','RESEND_API_KEY'],saved=keys.map(k=>process.env[k]);
 try{
 Date.now=()=>now;globalThis.setTimeout=(fn,ms)=>{if(ms===700)pacedMs+=ms;return savedTimeout(fn,ms===700?0:fastTimeout&&ms===policy.FRIDAY_IO_TIMEOUT_MS?50:ms);};process.env.FRIDAY_FRIENDS_SEND_VERSION=policy.FRIDAY_FRIENDS_VERSION;process.env.FRIDAY_FRIENDS_EXECUTION_TOKEN='x'.repeat(40);process.env.FRIDAY_FRIENDS_EXECUTION_EXPIRES=new Date(now+600000).toISOString();process.env.RESEND_API_KEY='synthetic-never-network';
 const m=fixture(),hash=friendCampaignHash(m),ownerId=randomUUID(),ownerHash='b'.repeat(64),iso=n=>new Date(now+n).toISOString();let providerSends=0,claimCalls=0,valid=true,unknownSuppression=false,receipt=null,providerTimeout=false,hangAfterClaim=false,lateValidation;
 const campaign={send_enabled:true,audience_policy:'weekly_discovery',content_version:policy.FRIDAY_FRIENDS_VERSION,manifest_hash:hash,recipient_count:1,approved_at:iso(-60000),content_approved_at:iso(-120000),send_approved_at:iso(-60000),expires_at:iso(600000),provider_permission_reviewed_at:iso(-300000),provider_permission_basis:'Synthetic permission review fixture',friday_owner_review_hash:ownerHash,friday_owner_test_verified_at:iso(-180000)};
 const owner={user_id:ownerId,manifest:{userId:ownerId,sourceHash:hash,sourceCampaign:m.campaign,email:{subject:'What’s happening near you this weekend?',text:'Hey there,\nSynthetic owner copy',html:'<div><p>Hey there,</p><p>Synthetic owner copy</p></div>'}},manifest_hash:ownerHash,provider_id:'synthetic-owner-receipt',accepted_at:iso(-240000)};
 const rows={friend_announcement_drafts:{manifest:m,manifest_hash:hash,recipient_count:1,expires_at:new Date(m.expires).toISOString()},friend_event_campaigns:campaign,campaign_owner_reviews:owner,users:{id:ownerId,email:'owner@example.test',friend_opted_in_at:iso(-500000),email_notifications:true},friend_event_preferences:{email_enabled:true},friend_event_suppressions:null};
 const db={from(table){const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='friend_event_deliveries'?receipt:rows[table],error:null})};return q;},rpc:async(name,args)=>{assert.equal(name,'claim_friday_friend_delivery');claimCalls++;receipt={campaign_id:m.campaign,user_id:m.entries[0].userId,channel:'email',status:'claimed'};return {data:args.p_delivery,error:null};}};
 class Provider {suppressions={get:async()=>unknownSuppression?{data:null,error:{name:'rate_limit',statusCode:429}}:{data:null,error:{name:'not_found',statusCode:404}}};emails={get:async id=>({data:{id,last_event:'delivered'},error:null}),send:async(_mail,options)=>{providerSends++;if(providerTimeout)return new Promise(()=>{});assert.equal(options.idempotencyKey,'friend-events:'+m.entries[0].deliveryId);return {data:{id:'synthetic-member-receipt'},error:null};}};}
 const {runFridayFriends}=await loadTs('lib/friday-friends-adapter.ts',{'resend':{Resend:Provider},'@/lib/supabase':{supabaseAdmin:db},'@/lib/admin':{getAdminEmails:()=>['owner@example.test']},'@/lib/friend-event-sender':{friendCampaignHash},'@/lib/friend-event-provider':{recordFriendEventProviderEvent:async()=>{receipt.status='accepted';receipt.provider_id='synthetic-member-receipt';return true;}},'@/lib/friend-event-suppression':{checkFriendEventSuppression},'@/lib/campaign-owner-review':{ownerReviewEmail:()=> 'owner@example.test',ownerReviewHash:()=>ownerHash,validOwnerReview:()=>true},'@/lib/friend-discovery-privacy':{neutralFriendDiscoveryReview},'@/lib/friday-friends-current':{currentFridayEntry:async()=>{if(hangAfterClaim&&receipt?.status==='claimed')return new Promise(resolve=>{lateValidation=resolve;});return valid;}},'@/lib/friday-friends-policy':policy,'@/lib/friday-friends-executor':{executeFridayFriends,boundedFridayIO}});
 const {POST}=await loadTs('app/api/admin/friday-friends-execute/route.ts',{'next/server':nextMock,'@/lib/request-security':{timingSafeStringEqual:(a,b)=>a===b},'@/lib/friday-friends-policy':policy,'@/lib/friday-friends-adapter':{runFridayFriends}});
 const request=(extra={},auth=true)=>new Request('https://example.test/api/admin/friday-friends-execute',{method:'POST',headers:auth?{authorization:'Bearer '+'x'.repeat(40)}:{},body:JSON.stringify({campaign:m.campaign,manifestHash:hash,...extra})});
 assert.equal((await POST(request({},false))).status,403);assert.equal((await POST(request({audience:'all'}))).status,400);
 m.entries.push(entry());const oversizedHash=friendCampaignHash(m);rows.friend_announcement_drafts.manifest_hash=oversizedHash;rows.friend_announcement_drafts.recipient_count=2;
 assert.equal((await(await POST(request({manifestHash:oversizedHash}))).json()).stopped,'pilot_size_exceeded');assert.equal(claimCalls,0);assert.equal(providerSends,0);
 m.entries.pop();rows.friend_announcement_drafts.manifest_hash=hash;rows.friend_announcement_drafts.recipient_count=1;
 campaign.friday_owner_test_verified_at=null;assert.equal((await(await POST(request())).json()).stopped,'approval_or_owner_test_required');assert.equal(providerSends,0);campaign.friday_owner_test_verified_at=iso(-180000);
 unknownSuppression=true;assert.equal((await(await POST(request())).json()).stopped,'approval_or_owner_test_required');assert.equal(claimCalls,0);unknownSuppression=false;
 valid=false;assert.equal((await(await POST(request())).json()).stopped,'audience_or_inventory_changed');valid=true;
 hangAfterClaim=true;fastTimeout=true;
 assert.equal((await(await POST(request())).json()).stopped,'uncertain_outcome_reconcile_before_retry');assert.equal(providerSends,0);assert.equal(claimCalls,1);
 lateValidation(true);await new Promise(resolve=>savedTimeout(resolve,0));assert.equal(providerSends,0);
 assert.equal((await(await POST(request())).json()).stopped,'reconcile_claim_before_retry');assert.equal(claimCalls,1);
 // Reset only synthetic ledger fixture for the independent successful scenario.
 receipt=null;hangAfterClaim=false;fastTimeout=false;const beforeSuccessfulPacing=pacedMs;
 assert.equal((await(await POST(request())).json()).accepted,1);assert.equal(providerSends,1);assert.equal(claimCalls,2);assert.equal(pacedMs-beforeSuccessfulPacing,7700);
 assert.equal((await(await POST(request())).json()).alreadyAccepted,1);assert.equal(providerSends,1);
 receipt=null;providerTimeout=true;fastTimeout=true;
 assert.equal((await(await POST(request())).json()).stopped,'uncertain_outcome_reconcile_before_retry');assert.equal(providerSends,2);assert.equal(claimCalls,3);
 assert.equal((await(await POST(request())).json()).stopped,'reconcile_claim_before_retry');assert.equal(providerSends,2);assert.equal(claimCalls,3);
 delete process.env.FRIDAY_FRIENDS_SEND_VERSION;assert.equal((await POST(request())).status,403);assert.equal(providerSends,2);
 }finally{Date.now=savedNow;globalThis.setTimeout=savedTimeout;keys.forEach((k,i)=>saved[i]===undefined?delete process.env[k]:process.env[k]=saved[i]);}
});
