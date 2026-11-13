import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {loadTs,nextMock} from './helpers/load-ts.mjs';
test('preflight uses real runtime permission paths but returns only aggregates, never sends or writes',async()=>{
 const records={users:[{id:'synthetic-1',email:'one@example.test',friend_opted_in_at:'now',email_notifications:true},{id:'synthetic-2',email:'two@example.test',friend_opted_in_at:'now',email_notifications:false}],friend_event_preferences:[],friend_event_preference_audit:[],friend_event_suppressions:[],friend_event_deliveries:[]};
 const reads=[];const db={from:table=>{const q={select:()=>q,order:()=>q,range:async(a,b)=>{reads.push(table);return {data:records[table].slice(a,b+1),error:null};}};return q;}};
 const old=process.env.RESEND_API_KEY;process.env.RESEND_API_KEY='synthetic-fake-only';
 try{
 const {friendAnnouncementPreflight}=await loadTs('lib/friend-announcement-preflight.ts',{
  'node:crypto':{createHash},'@/lib/supabase':{supabaseAdmin:db},'@/lib/admin':{getAdminEmails:()=>['admin@example.test']},
  resend:{Resend:class{domains={list:async()=>({data:{data:[{name:'notcupid.com',status:'verified'}]},error:null})};suppressions={get:async()=>({data:null,error:{name:'not_found',statusCode:404}})};}},
  '@/lib/friend-event-suppression':{checkFriendEventSuppression:async(email,lookup)=>{assert.equal(email,'one@example.test');assert.equal((await lookup(email)).error.statusCode,404);return 'clear';}},
 });
 const result=await friendAnnouncementPreflight();assert.equal(result.complete,true);assert.equal(result.finalTechnicalCount,1);assert.equal(result.sendReady,false);assert.equal(result.counts.friendMembers,2);assert.equal(reads.length,5);assert.doesNotMatch(JSON.stringify(result),/one@example|synthetic-1|synthetic-fake-only/);
 }finally{if(old===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=old;}
});
test('diagnostic requires correct expiring token before accessing production data',async()=>{
 const old=process.env.FRIEND_ANNOUNCEMENT_PREFLIGHT_TOKEN,oldExp=process.env.FRIEND_ANNOUNCEMENT_PREFLIGHT_EXPIRES;let calls=0;
 try{process.env.FRIEND_ANNOUNCEMENT_PREFLIGHT_TOKEN='x'.repeat(40);process.env.FRIEND_ANNOUNCEMENT_PREFLIGHT_EXPIRES=new Date(Date.now()+60000).toISOString();
 const {POST}=await loadTs('app/api/admin/friend-announcement-preflight/route.ts',{'next/server':nextMock,'@/lib/request-security':{timingSafeStringEqual:(a,b)=>a===b},'@/lib/friend-announcement-preflight':{friendAnnouncementPreflight:async()=>{calls++;return {complete:true,sendReady:false};}}});
 assert.equal((await POST({headers:new Headers()})).status,403);assert.equal(calls,0);
 const req={headers:new Headers({authorization:'Bearer '+'x'.repeat(40)})};assert.equal((await POST(req)).status,200);assert.equal(calls,1);
 process.env.FRIEND_ANNOUNCEMENT_PREFLIGHT_EXPIRES=new Date(Date.now()-1000).toISOString();assert.equal((await POST(req)).status,403);assert.equal(calls,1);
 }finally{for(const[k,v]of[['FRIEND_ANNOUNCEMENT_PREFLIGHT_TOKEN',old],['FRIEND_ANNOUNCEMENT_PREFLIGHT_EXPIRES',oldExp]])if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
test('global unsubscribe supports JSON and signed RFC8058 URL without changing matching or push',async()=>{
 const writes=[];const {POST}=await loadTs('app/api/unsubscribe/route.ts',{'next/server':nextMock,'@/lib/email':{verifyUnsubToken:(u,t)=>u==='synthetic-user'&&t==='valid'},'@/lib/supabase':{supabaseAdmin:{from:()=>({update:patch=>({eq:async(field,value)=>{writes.push({patch,field,value});return {error:null};}})})}}});
 const req=(json,url)=>({json:async()=>{if(json instanceof Error)throw json;return json;},nextUrl:new URL(url)});
 assert.equal((await POST(req({u:'synthetic-user',t:'valid'},'https://notcupid.com/api/unsubscribe'))).status,200);
 assert.equal((await POST(req(Error('form payload'),'https://notcupid.com/api/unsubscribe?u=synthetic-user&t=valid'))).status,200);
 assert.equal((await POST(req(Error('form payload'),'https://notcupid.com/api/unsubscribe?u=synthetic-user&t=bad'))).status,403);
 assert.equal(writes.length,2);assert.deepEqual(writes[0].patch,{email_notifications:false});
});
