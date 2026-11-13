import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';import {loadTs,nextMock} from './helpers/load-ts.mjs';
const campaign='friend_events_announcement_synthetic_execution',hash='a'.repeat(64);
test('execution endpoint disabled by default and requires distinct expiring credential; cannot accept approvals',async()=>{
 const names=['FRIEND_ANNOUNCEMENT_SEND_ENABLED','FRIEND_ANNOUNCEMENT_EXECUTION_TOKEN','FRIEND_ANNOUNCEMENT_EXECUTION_EXPIRES'],old=names.map(k=>process.env[k]);let calls=0;
 try{const{POST}=await loadTs('app/api/admin/friend-announcement-execute/route.ts',{'next/server':nextMock,'@/lib/request-security':{timingSafeStringEqual:(a,b)=>a===b},'@/lib/friend-announcement-execute':{executePreparedFriendAnnouncement:async()=>{calls++;return {attempted:0,accepted:0};}}});
 const req=body=>({headers:new Headers({authorization:'Bearer '+'s'.repeat(40)}),json:async()=>body});
 delete process.env[names[0]];assert.equal((await POST(req({campaign,manifestHash:hash}))).status,403);
 process.env[names[0]]='true';process.env[names[1]]='s'.repeat(40);process.env[names[2]]=new Date(Date.now()+60000).toISOString();
 assert.equal((await POST(req({campaign,manifestHash:hash,sendApproved:true}))).status,400);assert.equal(calls,0);
 assert.equal((await POST(req({campaign,manifestHash:hash}))).status,200);assert.equal(calls,1);
 process.env[names[2]]=new Date(Date.now()-1).toISOString();assert.equal((await POST(req({campaign,manifestHash:hash}))).status,403);
 }finally{names.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]);}
});
test('execution lock needs actual permission and sequential approval records and cannot be reacquired',async()=>{
 const db=new PGlite();try{await db.exec('create role anon;create role authenticated;create role service_role;create table users(id uuid primary key);create table push_subscriptions(id uuid primary key,user_id uuid);');
 for(const name of ['20261113162841_friend_event_campaign_foundation.sql','20261113163514_friend_event_delivery_reporting.sql','20261113163859_friend_event_reconcile_acceptance_fix.sql','20261113164351_friend_event_frozen_sender_gate.sql','20261113185150_friend_line_announcement_policy.sql','20261113190613_friend_announcement_drafts.sql','20261113191549_friend_announcement_execution_lock.sql'])await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
 const scalar=async(sql,args=[])=>(await db.query(sql,args)).rows[0]?.value;
 const lock=()=>scalar('select start_friend_announcement_execution($1,$2) as value',[campaign,hash]);
 await db.query("insert into friend_event_campaigns(id,content_version,expires_at,audience_policy,manifest_hash,recipient_count)values($1,'test',now()+interval '1hour','friend_line_announcement',$2,1)",[campaign,hash]);
 await db.query("insert into friend_announcement_drafts(id,manifest_hash,audience_hash,recipient_count,manifest,expires_at)values($1,$2,$2,1,'{}',now()+interval '1hour')",[campaign,hash]);assert.equal(await lock(),false);
 await db.exec("update friend_event_campaigns set send_enabled=true,approved_at=now(),content_approved_at=now()-interval '1minute',send_approved_at=now()");assert.equal(await lock(),false,'no provider review');
 await db.exec("update friend_event_campaigns set provider_permission_reviewed_at=now(),provider_permission_basis='Synthetic test-only genuine permission review'");assert.equal(await lock(),true);assert.equal(await lock(),false,'single invocation only');
 await db.query("select finish_friend_announcement_execution($1,$2,'{\"stopped\":\"synthetic\"}')",[campaign,hash]);assert.equal(await lock(),false,'finished attempts cannot auto-retry');
 assert.equal(await scalar('select count(*)::int as value from friend_event_deliveries'),0);assert.equal(await scalar('select count(*)::int as value from friend_event_preferences'),0);
 assert.equal(await scalar("select has_table_privilege('service_role','friend_announcement_executions','delete') as value"),false);
 assert.equal(await scalar("select has_function_privilege('anon','start_friend_announcement_execution(text,text)','execute') as value"),false);
 }finally{await db.close();}
});
test('execution wrapper never creates approval and stops when attempt lock unavailable',async()=>{
 const old=process.env.FRIEND_ANNOUNCEMENT_SEND_ENABLED;process.env.FRIEND_ANNOUNCEMENT_SEND_ENABLED='true';let executions=0;let allow=false;const calls=[];const expires=Date.now()+60000;
 try{const manifest={campaign,purpose:'friend_line_announcement',expires,entries:[{}]};const{executePreparedFriendAnnouncement}=await loadTs('lib/friend-announcement-execute.ts',{'@/lib/supabase':{supabaseAdmin:{from:table=>{assert.equal(table,'friend_announcement_drafts');const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{manifest,manifest_hash:hash,recipient_count:1,expires_at:new Date(expires).toISOString()},error:null})};return q;},rpc:async(name,args)=>{calls.push({name,args});return {data:name.startsWith('start_')?allow:null,error:null};}}},'@/lib/friend-event-sender':{friendCampaignHash:()=>hash,executeFrozenFriendCampaign:async()=>{executions++;return {attempted:1,accepted:1,stopped:'complete'};}},'@/lib/friend-event-sender-adapter':{friendEventSenderDependencies:()=>({approval:async()=>({enabled:true,audiencePolicy:'friend_line_announcement',manifestHash:hash,recipientCount:1,contentApprovedAt:Date.now()-1000,sendApprovedAt:Date.now()-500,expires}),suppression:async()=> 'clear',submit:async()=>({accepted:true})})}});
 assert.equal((await executePreparedFriendAnnouncement(campaign,hash,expires)).stopped,'execution_locked_or_unapproved');assert.equal(executions,0);allow=true;assert.equal((await executePreparedFriendAnnouncement(campaign,hash,expires)).stopped,'complete');assert.equal(executions,1);assert.deepEqual(calls.map(x=>x.name),['start_friend_announcement_execution','start_friend_announcement_execution','finish_friend_announcement_execution']);
 }finally{old===undefined?delete process.env.FRIEND_ANNOUNCEMENT_SEND_ENABLED:process.env.FRIEND_ANNOUNCEMENT_SEND_ENABLED=old;}
});
test('paced submission rechecks revoked approval after claim without provider send',async()=>{
 const old=process.env.FRIEND_ANNOUNCEMENT_SEND_ENABLED;process.env.FRIEND_ANNOUNCEMENT_SEND_ENABLED='true';let approvals=0,sends=0;const expires=Date.now()+60000;
 try{const manifest={campaign,purpose:'friend_line_announcement',expires,entries:[{channel:'email'}]};const{executePreparedFriendAnnouncement}=await loadTs('lib/friend-announcement-execute.ts',{'@/lib/supabase':{supabaseAdmin:{from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{manifest,manifest_hash:hash,recipient_count:1,expires_at:new Date(expires).toISOString()},error:null})};return q;},rpc:async()=>({data:true,error:null})}},'@/lib/friend-event-sender':{friendCampaignHash:()=>hash,executeFrozenFriendCampaign:async(m,deps)=>{await deps.submit(m.entries[0],campaign);return {attempted:1,accepted:1,stopped:'complete'};}},'@/lib/friend-event-sender-adapter':{friendEventSenderDependencies:()=>({approval:async()=>++approvals===1?{enabled:true,audiencePolicy:'friend_line_announcement',manifestHash:hash,recipientCount:1,contentApprovedAt:Date.now()-1000,sendApprovedAt:Date.now()-500,expires}:null,eligible:async()=>true,suppression:async()=> 'clear',submit:async()=>{sends++;return {accepted:true};}})}});
 const result=await executePreparedFriendAnnouncement(campaign,hash,expires);assert.equal(result.stopped,'uncertain_outcome_reconcile_before_retry');assert.equal(sends,0);assert.equal(approvals,2);
 }finally{old===undefined?delete process.env.FRIEND_ANNOUNCEMENT_SEND_ENABLED:process.env.FRIEND_ANNOUNCEMENT_SEND_ENABLED=old;}
});
test('malformed dates, mismatched purpose and invalid deadline fail before execution lock',async()=>{
 const old=process.env.FRIEND_ANNOUNCEMENT_SEND_ENABLED;process.env.FRIEND_ANNOUNCEMENT_SEND_ENABLED='true';let locks=0;const expires=Date.now()+60000;
 let approval={enabled:true,audiencePolicy:'friend_line_announcement',manifestHash:hash,recipientCount:1,contentApprovedAt:Date.now()-1000,sendApprovedAt:Date.now()-500,expires};
 const good={...approval};
 try{const manifest={campaign,purpose:'friend_line_announcement',expires,entries:[{}]};const{executePreparedFriendAnnouncement}=await loadTs('lib/friend-announcement-execute.ts',{'@/lib/supabase':{supabaseAdmin:{from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{manifest,manifest_hash:hash,recipient_count:1,expires_at:new Date(expires).toISOString()},error:null})};return q;},rpc:async()=>{locks++;return {data:true,error:null};}}},'@/lib/friend-event-sender':{friendCampaignHash:()=>hash,executeFrozenFriendCampaign:async()=>{throw Error('must not execute');}},'@/lib/friend-event-sender-adapter':{friendEventSenderDependencies:()=>({approval:async()=>approval})}});
 for(const patch of [{contentApprovedAt:NaN},{sendApprovedAt:NaN},{expires:NaN},{audiencePolicy:'weekly_discovery'}]){approval={...good,...patch};assert.equal((await executePreparedFriendAnnouncement(campaign,hash,expires)).stopped,'exact_approval_required');}
 approval=good;assert.equal((await executePreparedFriendAnnouncement(campaign,hash,NaN)).stopped,'exact_approval_required');assert.equal(locks,0);
 }finally{old===undefined?delete process.env.FRIEND_ANNOUNCEMENT_SEND_ENABLED:process.env.FRIEND_ANNOUNCEMENT_SEND_ENABLED=old;}
});
