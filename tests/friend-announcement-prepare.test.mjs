import test from 'node:test';import assert from 'node:assert/strict';import {loadTs,nextMock} from './helpers/load-ts.mjs';
const campaign='friend_events_announcement_synthetic_v1',expires=Date.now()+3600000;
test('preparation freezes once and never creates approvals, deliveries or sends',async()=>{
 let stored=null,scans=0,freezes=0;const writes=[];
 const manifest={purpose:'friend_line_announcement',campaign,version:'v1',expires,entries:[{userId:'private-user',deliveryId:'private-delivery',channel:'email',email:{to:'private@example.test',from:'NotCupid <match@notcupid.com>',replyTo:'match@notcupid.com',subject:'Got plans for tonight?',text:'Click https://notcupid.com/go/friend-events?token=PRIVATE_TOKEN\nOptout https://notcupid.com/unsubscribe?u=private-user&t=PRIVATE_UNSUB',html:'<a href="https://notcupid.com/go/friend-events?token=PRIVATE_TOKEN">Find your next plan</a>'}}]};
 const db={from(table){assert.equal(table,'friend_announcement_drafts');const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:stored,error:null}),insert:async row=>{writes.push(row);stored=row;return {error:null};}};return q;}};
 const {prepareFriendAnnouncement}=await loadTs('lib/friend-announcement-prepare.ts',{
  '@/lib/supabase':{supabaseAdmin:db},'@/lib/friend-announcement-preflight':{collectFriendAnnouncementAudience:async()=>{scans++;return {complete:true,recipients:[{userId:'private-user',email:'private@example.test'}],audienceHash:'a'.repeat(64)};}},
  '@/lib/friend-announcement-freeze':{freezeFriendAnnouncement:()=>{freezes++;return manifest;}},'@/lib/friend-event-sender':{friendCampaignHash:()=> 'b'.repeat(64)}
 });
 const result=await prepareFriendAnnouncement(campaign,expires);assert.equal(result.prepared,true);assert.equal(result.sendReady,false);assert.equal(result.recipientCount,1);assert.doesNotMatch(JSON.stringify(result),/private-user|private@example|PRIVATE_TOKEN|PRIVATE_UNSUB/);assert.equal(writes.length,1);assert.equal(writes[0].manifest,manifest);assert.equal(writes[0].send_enabled,undefined);assert.equal(writes[0].approved_at,undefined);
 assert.deepEqual(await prepareFriendAnnouncement(campaign,expires),result);assert.equal(scans,1);assert.equal(freezes,1);await assert.rejects(()=>prepareFriendAnnouncement(campaign,expires+1),/new draft id/);
});
test('prepare route authorizes before JSON/data access, rejects send/approval fields',async()=>{
 const vars=['FRIEND_ANNOUNCEMENT_PREFLIGHT_TOKEN','FRIEND_ANNOUNCEMENT_PREFLIGHT_EXPIRES'];const old=vars.map(k=>process.env[k]);let calls=0;
 try{process.env[vars[0]]='q'.repeat(40);process.env[vars[1]]=new Date(Date.now()+60000).toISOString();const {POST}=await loadTs('app/api/admin/friend-announcement-prepare/route.ts',{'next/server':nextMock,'@/lib/request-security':{timingSafeStringEqual:(a,b)=>a===b},'@/lib/friend-announcement-prepare':{prepareFriendAnnouncement:async()=>{calls++;return {prepared:true,sendReady:false};}}});
 const req=body=>({headers:new Headers({authorization:'Bearer '+'q'.repeat(40)}),json:async()=>body});
 assert.equal((await POST({headers:new Headers(),json:()=>{throw Error('must not read');}})).status,403);
 assert.equal((await POST(req({campaign,expires,send:true}))).status,400);assert.equal(calls,0);
 assert.equal((await POST(req({campaign,expires}))).status,200);assert.equal(calls,1);
 process.env[vars[1]]=new Date(Date.now()-1).toISOString();assert.equal((await POST(req({campaign,expires}))).status,403);assert.equal(calls,1);
 }finally{vars.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]);}
});
test('draft storage revokes inherited default broad grants and keeps read/insert only',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const {readFile}=await import('node:fs/promises');const db=new PGlite();
 try{await db.exec('create role anon; create role authenticated; create role service_role; alter default privileges in schema public grant all on tables to service_role;');await db.exec(await readFile('supabase/migrations/20261113190613_friend_announcement_drafts.sql','utf8'));
 const {rows}=await db.query("select has_table_privilege('service_role','friend_announcement_drafts','select') as read,has_table_privilege('service_role','friend_announcement_drafts','insert') as write,has_table_privilege('service_role','friend_announcement_drafts','update') as update,has_table_privilege('service_role','friend_announcement_drafts','delete') as delete,has_table_privilege('anon','friend_announcement_drafts','select') as anon,has_table_privilege('authenticated','friend_announcement_drafts','select') as auth");assert.deepEqual(rows[0],{read:true,write:true,update:false,delete:false,anon:false,auth:false});
 }finally{await db.close();}
});
