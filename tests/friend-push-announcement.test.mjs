import test from 'node:test';import assert from 'node:assert/strict';
import {eligible,execute,hash} from '../scripts/friend-push-policy.mjs';
const user={id:'u',email:'member@example.test',friend_opted_in_at:'2026-01-01'};
const state={admins:['admin@example.test'],subscriptions:[{user_id:'u'}]};
test('one-time push requires subscription, excludes account/admin/pause and actual topic opt-outs without enrollment',()=>{
 assert.equal(eligible(user,state),true);
 for(const flag of ['is_test','is_blocked','deleted_at','notifications_paused_at'])assert.equal(eligible({...user,[flag]:true},state),false);
 assert.equal(eligible(user,{...state,admins:[]}),false);
 assert.equal(eligible(user,{...state,subscriptions:[]}),false);
 assert.equal(eligible(user,{...state,prefs:[{user_id:'u',push_enabled:false}]}),true);
 assert.equal(eligible(user,{...state,prefs:[{user_id:'u',push_enabled:false}],audit:[{user_id:'u',channel:'push',enabled:false}]}),false);
 assert.equal(eligible(user,{...state,suppressions:[{user_id:'u',channel:'push'}]}),false);
});
function setup(){let claimed=false;const calls=[];return {calls,m:{expires:Date.now()+60000,entries:[{devices:['d']}]},d:{approved:async()=>true,eligible:async()=>true,deviceCurrent:async()=>true,claim:async()=>{if(claimed)return false;claimed=true;return true},send:async()=>{calls.push('send');return true},receipt:async()=>{},finish:async()=>{}}};}
test('one-time claim prevents repeated sends',async()=>{const {m,d,calls}=setup();assert.equal((await execute(m,d)).membersAccepted,1);await assert.rejects(execute(m,d));assert.equal(calls.length,1)});
test('approval, opt-out or removed device stop send',async()=>{for(const field of ['approved','eligible','deviceCurrent']){const {m,d,calls}=setup();d[field]=async()=>false;await execute(m,d).catch(()=>{});assert.equal(calls.length,0)}});
test('unknown results remain claimed and cannot retry',async()=>{const {m,d,calls}=setup();d.send=async()=>{calls.push('send');throw Error('timeout')};await assert.rejects(execute(m,d));await assert.rejects(execute(m,d));assert.equal(calls.length,1)});
import {PGlite} from '@electric-sql/pglite';import {readFileSync} from 'node:fs';
test('isolated SQL push claim: no enrollment, channel isolation, approval and duplicate barriers',async()=>{
 const db=new PGlite();const u='10000000-0000-0000-0000-000000000001',d='20000000-0000-0000-0000-000000000001',c='friend_events_push_announcement_test';
 try{await db.exec(`create role anon;create role authenticated;create role service_role;create table users(id uuid primary key,email text,is_test boolean default false,is_blocked boolean default false,deleted_at timestamptz,friend_opted_in_at timestamptz,email_notifications boolean default true,notifications_paused_at timestamptz);create table push_subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid);insert into users(id,email,friend_opted_in_at) values('${u}','member@example.test',now());`);
 for(const file of ['20261113162841_friend_event_campaign_foundation.sql','20261113163514_friend_event_delivery_reporting.sql','20261113163859_friend_event_reconcile_acceptance_fix.sql','20261113164351_friend_event_frozen_sender_gate.sql','20261113185150_friend_line_announcement_policy.sql','20261114011603_friend_push_announcement.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 const claim=async()=> (await db.query('select claim_friend_push_announcement($1,$2,$3,$4,$5) value',[u,c,['admin@example.test'],d,'a'.repeat(64)])).rows[0].value;
 await db.query(`insert into friend_event_campaigns(id,content_version,expires_at,audience_policy,manifest_hash,recipient_count,provider_permission_basis,provider_permission_reviewed_at) values($1,'friend-push-announcement-v1',now()+interval '1 hour','friend_line_announcement',$2,1,'User requested one-time push announcement',now())`,[c,'a'.repeat(64)]);
 assert.equal(await claim(),null);await db.exec('update friend_event_campaigns set send_enabled=true,approved_at=now()');assert.equal(await claim(),null);await db.query('insert into push_subscriptions(user_id) values($1)',[u]);
 await db.query("select set_friend_event_preference($1,'push',false,'profile')",[u]);assert.equal(await claim(),null);await db.query("select set_friend_event_preference($1,'push',true,'profile')",[u]);
 await db.query("insert into friend_event_suppressions(user_id,channel,reason) values($1,'push','operator')",[u]);assert.equal(await claim(),null);await db.exec('delete from friend_event_suppressions');
 assert.equal(await claim(),d);assert.equal(await claim(),null);assert.equal((await db.query("select channel from friend_event_deliveries")).rows[0].channel,'push');
 assert.equal((await db.query("select has_function_privilege('authenticated','claim_friend_push_announcement(uuid,text,text[],uuid,text)','execute') value")).rows[0].value,false);
 }finally{await db.close();}
});
test('first accepted device records member acceptance before a later device timeout',async()=>{const {m,d}=setup();m.entries[0].devices=['a','b'];let n=0,accepted=0;d.send=async()=>{if(++n===2)throw Error('timeout');return true};d.finish=async(e,yes)=>{if(yes)accepted++};await assert.rejects(execute(m,d),e=>e.partial.membersAccepted===1&&e.partial.unknown===1);assert.equal(accepted,1)});

test('manifest hash survives jsonb key ordering',()=>assert.equal(hash({z:1,a:{b:2,a:1}}),hash({a:{a:1,b:2},z:1})));
import {loadTs,nextMock} from './helpers/load-ts.mjs';
test('route fails closed and prepare never executes',async()=>{
 const names=['FRIEND_PUSH_ANNOUNCEMENT_TOKEN','FRIEND_PUSH_ANNOUNCEMENT_EXPIRES','FRIEND_PUSH_ANNOUNCEMENT_SEND_ENABLED'],old=names.map(k=>process.env[k]);let sent=0,prepared=0;
 try{process.env[names[0]]='t'.repeat(40);process.env[names[1]]=new Date(Date.now()+60000).toISOString();process.env[names[2]]='false';
 const {POST}=await loadTs('app/api/admin/friend-push-announcement/route.ts',{'next/server':nextMock,'@/lib/request-security':{timingSafeStringEqual:(a,b)=>a===b},'@/lib/friend-push-announcement':{preparePush:async()=>{prepared++;return{}},executePush:async()=>{sent++;return{}}}});
 const req=(action,token='t'.repeat(40))=>({headers:new Headers({authorization:'Bearer '+token}),json:async()=>({action,manifestHash:'a'.repeat(64)})});
 assert.equal((await POST(req('execute'))).status,403);assert.equal(sent,0);assert.equal((await POST(req('prepare'))).status,200);assert.equal(prepared,1);assert.equal(sent,0);
 process.env[names[2]]='true';assert.equal((await POST(req('execute','bad'))).status,403);assert.equal(sent,0);
 process.env[names[1]]=new Date(Date.now()-1).toISOString();assert.equal((await POST(req('execute'))).status,403);assert.equal(sent,0);
 }finally{names.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]);}
});
