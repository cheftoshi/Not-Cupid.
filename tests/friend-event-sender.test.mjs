import test from 'node:test';import assert from 'node:assert/strict';
import {executeFrozenFriendCampaign,friendCampaignHash} from '../lib/friend-event-sender.ts';
import {loadTs} from './helpers/load-ts.mjs';
import {signFriendEventToken} from '../lib/friend-event-campaign.ts';
const key='local-synthetic-only-signing-key-12345678';
const user='10000000-0000-0000-0000-000000000001',delivery='20000000-0000-0000-0000-000000000001';
const {renderFriendEventMessage}=await loadTs('lib/friend-event-message.ts',{'./friend-event-campaign':{signFriendEventToken}});
function setup(){
 const now=Date.now();const manifest={campaign:'friend_events_synthetic',version:'review-v1',expires:now+60000,entries:[renderFriendEventMessage({userId:user,deliveryId:delivery,channel:'email',email:'synthetic@example.test',expires:now+60000},key)]};
 const calls=[];let claimed=false;
 const approval={manifestHash:friendCampaignHash(manifest),recipientCount:1,contentApprovedAt:now-2000,sendApprovedAt:now-1000,expires:now+60000,enabled:true};
 const deps={approval:async()=>approval,eligible:async()=>true,suppression:async()=>'clear',claim:async()=>{calls.push('claim');if(claimed)return false;claimed=true;return true;},submit:async()=>{calls.push('FAKE_SUBMIT');return {accepted:true,providerId:'synthetic-provider'};},recordAccepted:async()=>{calls.push('record');}};
 return {manifest,approval,deps,calls};
}
test('frozen worker submits only exact separately approved content/audience/count and stops duplicate retry',async()=>{
 const {manifest,deps,calls}=setup();assert.equal((await executeFrozenFriendCampaign(manifest,deps)).stopped,'complete');assert.deepEqual(calls,['claim','FAKE_SUBMIT','record']);
 assert.equal((await executeFrozenFriendCampaign(manifest,deps)).stopped,'claim_unavailable');assert.equal(calls.filter(x=>x==='FAKE_SUBMIT').length,1);
});
test('copy, signed link, recipient count, missing approval and suppression changes deliver nothing',async()=>{
 for(const change of ['copy','link','address','count','approval','unknown','ineligible']){
  const x=setup();
  if(change==='copy')x.manifest.entries[0].email.subject+='changed';
  if(change==='link')x.manifest.entries[0].email.html+='changed';
  if(change==='address')x.manifest.entries[0].email.to='other@example.test';
  if(change==='count')x.approval.recipientCount=2;
  if(change==='approval')x.approval.sendApprovedAt=NaN;
  if(change==='unknown')x.deps.suppression=async()=>'unknown';
  if(change==='ineligible')x.deps.eligible=async()=>false;
  assert.notEqual((await executeFrozenFriendCampaign(x.manifest,x.deps)).stopped,'complete',change);assert.deepEqual(x.calls,[],change);
 }
});
test('eligibility or approval changes between preflight and submission stop without sending',async()=>{
 const x=setup();let checks=0;x.deps.eligible=async()=>++checks===1;
 assert.equal((await executeFrozenFriendCampaign(x.manifest,x.deps)).stopped,'eligibility_changed');assert.deepEqual(x.calls,[]);
});
test('unknown provider or receipt outcome keeps claim and prohibits retry',async()=>{
 for(const failure of ['provider','receipt']){
  const x=setup();if(failure==='provider')x.deps.submit=async()=>{x.calls.push('FAKE_SUBMIT');throw Error('timeout');};else x.deps.recordAccepted=async()=>{throw Error('db unavailable');};
  assert.equal((await executeFrozenFriendCampaign(x.manifest,x.deps)).stopped,'uncertain_outcome_reconcile_before_retry');
  assert.equal((await executeFrozenFriendCampaign(x.manifest,x.deps)).stopped,'claim_unavailable');assert.equal(x.calls.filter(c=>c==='FAKE_SUBMIT').length,1);
 }
});
test('render freezes tracked CTA, honest admission copy and long-lived channel unsubscribe',()=>{
 const x=setup().manifest.entries[0].email;assert.match(x.html,/does not include tickets or admission/);assert.match(x.html,/109 California Ave/);assert.match(x.unsubscribeUrl,/\/api\/friend-events\/unsubscribe\?token=/);
});
test('real adapter is disabled by default; enabled fake adapter verifies provider idempotency and unsubscribe headers without network',async()=>{
 const old=process.env.FRIEND_EVENT_SEND_ENABLED,oldKey=process.env.RESEND_API_KEY;delete process.env.FRIEND_EVENT_SEND_ENABLED;process.env.RESEND_API_KEY='synthetic-not-real';const calls=[];
 try{
 const {friendEventSenderDependencies}=await loadTs('lib/friend-event-sender-adapter.ts',{
  resend:{Resend:class{emails={send:async(payload,options)=>{calls.push({payload,options});return {data:{id:'synthetic'},error:null};}};}},
  '@/lib/supabase':{supabaseAdmin:{}},'@/lib/admin':{getAdminEmails:()=>['admin@example.test']},'@/lib/friend-location':{friendLocationContext:async()=>({metro:'boston'})},'@/lib/push':{sendPushToUserDetailed:async()=>{throw Error('Unexpected push');}},'@/lib/friend-event-suppression':{checkFriendEventSuppression:async()=>'clear'},'@/lib/friend-event-provider':{recordFriendEventProviderEvent:async()=>true},
 });
 const adapter=friendEventSenderDependencies();const entry=setup().manifest.entries[0];
 await assert.rejects(adapter.submit(entry,'friend_events_synthetic'),/disabled/);assert.equal(calls.length,0);
 process.env.FRIEND_EVENT_SEND_ENABLED='true';assert.equal((await adapter.submit(entry,'friend_events_synthetic')).accepted,true);
 assert.equal(calls.length,1);assert.equal(calls[0].options.idempotencyKey,`friend-events:${delivery}`);assert.equal(calls[0].payload.headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');assert.equal(calls[0].payload.to,'synthetic@example.test');
 }finally{if(old===undefined)delete process.env.FRIEND_EVENT_SEND_ENABLED;else process.env.FRIEND_EVENT_SEND_ENABLED=old;if(oldKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=oldKey;}
});
test('one-time frozen announcement accepts global unsubscribe, rejects weekly topic-only opt-out and push',async()=>{
 const x=setup();x.manifest.purpose='friend_line_announcement';x.manifest.campaign='friend_events_announcement_synthetic';
 x.manifest.entries[0].email.unsubscribeUrl=`https://notcupid.com/unsubscribe?u=${user}&t=synthetic-signed-token`;
 x.manifest.entries[0].email.unsubscribePostUrl=`https://notcupid.com/api/unsubscribe?u=${user}&t=synthetic-signed-token`;
 x.approval.manifestHash=friendCampaignHash(x.manifest);
 assert.equal((await executeFrozenFriendCampaign(x.manifest,x.deps)).stopped,'exact_approval_required');
 x.approval.audiencePolicy='friend_line_announcement';
 assert.equal((await executeFrozenFriendCampaign(x.manifest,x.deps)).stopped,'complete');
 const y=setup();y.manifest.purpose='friend_line_announcement';y.manifest.campaign='friend_events_announcement_synthetic';y.approval.manifestHash=friendCampaignHash(y.manifest);
 assert.equal((await executeFrozenFriendCampaign(y.manifest,y.deps)).stopped,'invalid_or_expired_manifest');assert.deepEqual(y.calls,[]);
});
