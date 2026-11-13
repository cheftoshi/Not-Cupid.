import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs,nextMock} from './helpers/load-ts.mjs';
const id='10000000-0000-0000-0000-000000000001';
test('provider event handler validates tags and only calls atomic ledger RPC for known campaign shape',async()=>{
 const calls=[];
 const {recordFriendEventProviderEvent:record}=await loadTs('lib/friend-event-provider.ts',{'@/lib/supabase':{supabaseAdmin:{rpc:async(name,args)=>{calls.push({name,args});return {data:true,error:null};}}}});
 const event={type:'email.complained',created_at:new Date().toISOString(),data:{email_id:'provider-test',tags:{campaign:'friend_events_test',friend_event_delivery_id:id}}};
 assert.equal(await record({...event,data:{...event.data,tags:{campaign:'other'}}},'event-test'),false);
 assert.equal(await record({...event,type:'email.received'},'event-test'),false);
 assert.equal(await record(event,''),false);assert.equal(calls.length,0);
 assert.equal(await record(event,'event-test'),true);
 assert.equal(calls[0].name,'reconcile_friend_event_email');assert.equal(calls[0].args.p_delivery,id);
 assert.equal(await record({...event,data:{...event.data,tags:Object.entries(event.data.tags).map(([name,value])=>({name,value}))}},'event-array'),true);
});
test('report endpoint denies non-admins and exposes only campaign aggregate RPC',async()=>{
 let admin=null;let queried=0;
 const {GET}=await loadTs('app/api/admin/friend-events/report/route.ts',{'next/server':nextMock,'@/lib/admin':{getCurrentAdmin:async()=>admin},'@/lib/supabase':{supabaseAdmin:{rpc:async()=>{queried++;return {data:[{channel:'email',claimed:1}],error:null};}}}});
 const req={nextUrl:new URL('https://example.test/api?campaign=friend_events_test')};
 assert.equal((await GET(req)).status,403);assert.equal(queried,0);
 admin={id};const res=await GET(req);assert.equal(res.status,200);assert.equal((await res.json()).channels[0].claimed,1);assert.equal(res.headers.get('cache-control'),'no-store');
 assert.equal((await GET({nextUrl:new URL('https://example.test/api?campaign=bad')})).status,400);
});
test('suppression preflight requires explicit provider not-found; errors/mismatches fail closed',async()=>{
 const {checkFriendEventSuppression:check}=await import('../lib/friend-event-suppression.ts');
 const email='synthetic@example.test';
 assert.equal(await check(email,async()=>({data:null,error:{name:'not_found',statusCode:404}})),'clear');
 assert.equal(await check(email,async()=>({data:null,error:{name:'restricted_api_key',statusCode:403}})),'unknown');
 assert.equal(await check(email,async()=>({data:null,error:null})),'unknown');
 assert.equal(await check(email,async()=>{throw Error('offline');}),'unknown');
 assert.equal(await check(email,async()=>({data:{email:'other@example.test',origin:'bounce'},error:null})),'unknown');
 assert.equal(await check(email,async()=>({data:{email,origin:'complaint'},error:null})),'complaint');
});
test('proxy preserves no-referrer for signed campaign redirects and unsubscribe',async()=>{
 const {proxy}=await loadTs('proxy.ts',{'next/server':{NextResponse:{next:()=>new Response(),json:Response.json,redirect:()=>new Response()}},'./lib/realtime-policy':{realtimeCspSource:()=>''}});
 for(const path of ['/go/friend-events','/api/friend-events/unsubscribe']) {
  const res=proxy({cookies:{has:()=>false},method:'GET',nextUrl:new URL('https://example.test'+path),headers:new Headers()});
  assert.equal(res.headers.get('Referrer-Policy'),'no-referrer');assert.equal(res.headers.get('Cache-Control'),'no-store');
 }
});
