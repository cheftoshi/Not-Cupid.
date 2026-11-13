import test from 'node:test';import assert from 'node:assert/strict';import {loadTs,nextMock} from './helpers/load-ts.mjs';
test('curated RSVP rechecks current source/time while preserving withdrawal and retained response',async()=>{
 let existing=null,writes=0,checks=0,response='yes';
 const activity={id:'plan',kind:'event',title:'Synthetic plan',author_id:'host',metro:'boston',is_test:true,happens_at:'2026-11-15T12:00:00-05:00',external_event_id:'live:curated:walk'};
 let catalog={status:'ready',events:[{id:'live:curated:walk',startsAt:'2026-11-15T17:00:00.000Z'}]};
 const db={from:table=>({select:fields=>{if(table==='friend_activities')assert.match(fields,/external_event_id/);const q={eq:()=>q,maybeSingle:async()=>({data:table==='friend_activities'?activity:existing})};return q;},upsert:async()=>({})}),rpc:async()=>{writes++;return {data:[{my_response:response,yes_count:1}],error:null};}};
 const {POST}=await loadTs('app/api/friend/activities/[id]/rsvp/route.ts',{
 '@/lib/friend-event-attribution': { recordFriendEventConversion: async () => {} },
  'next/server':nextMock,'@/lib/auth':{getCurrentUser:async()=>({id:'guest',age:30,is_test:true})},'@/lib/supabase':{supabaseAdmin:db},
  '@/lib/friend-matching':{isLgbtqIdentity:()=>false},'@/lib/push':{sendPushToUser:async()=>{}},'@/lib/rate-limit':{rateLimit:async()=>({ok:true})},
  '@/lib/friend-events':{recordFriendAction:async()=>{}},'@/lib/friend-activity-access':{friendActivityInCurrentMetro:async()=>true,friendActivityAuthorAvailable:async()=>true},
  '@/lib/connection-plans':{planHasEnded:()=>false},'@/lib/realm':{sameRealm:()=>true},
  '@/lib/city-events-server':{cityEvents:async(metro,fresh)=>{checks++;assert.equal(metro,'boston');assert.equal(fresh,true);return catalog;}},
 });
 const invoke=()=>POST(new Request('http://localhost/rsvp',{method:'POST',body:JSON.stringify({mode:'set',response})}),{params:Promise.resolve({id:'plan'})});
 assert.equal((await invoke()).status,200);assert.equal(writes,1); // Equal instants, different formatting.
 catalog={status:'ready',events:[]};assert.equal((await invoke()).status,409);assert.equal(writes,1);
 catalog={status:'ready',events:[{id:'live:curated:walk',startsAt:'2026-11-15T18:00:00Z'}]};assert.equal((await invoke()).status,409);assert.equal(writes,1);
 catalog={status:'unavailable',events:[]};assert.equal((await invoke()).status,503);
 existing={response:'yes'};const before=checks;assert.equal((await invoke()).status,200);assert.equal(checks,before);
 response='no';assert.equal((await invoke()).status,200);assert.equal(checks,before);
 response=null;assert.equal((await invoke()).status,200);assert.equal(checks,before);
});
