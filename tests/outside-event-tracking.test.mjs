import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { parseOutsideInput, OUTSIDE_ID_RE, SESSION_RE } from '../lib/outside-event-tracking.ts';
import {loadTs,nextMock} from './helpers/load-ts.mjs';
const sessionId=randomUUID(), eventId='live:curated:synthetic';
test('outside telemetry accepts only bounded categorical controls and strips private input',()=>{
 assert.deepEqual(parseOutsideInput({action:'panel_open',sessionId,query:'private',userId:'other',lat:12}),{action:'panel_open',sessionId});
 for(const action of ['impression','source_click','plan_start','invitation_open'])assert.deepEqual(parseOutsideInput({action,sessionId,eventId,url:'secret'}),{action,sessionId,eventId});
 for(const b of [null,[],{}, {action:'plan_create',sessionId,eventId},{action:'impression',sessionId,eventId:'https://private.test'}, {action:'panel_open',sessionId:'arbitrary-device'}, {action:'filter',sessionId,filter:'query',value:'private text'}, {action:'filter',sessionId,filter:'category',value:'sensitive inference'}, {action:'filter',sessionId,filter:'__proto__',value:'x'}])assert.equal(parseOutsideInput(b),null);
 assert.equal(parseOutsideInput({action:'filter',sessionId,filter:'category',value:'music'}).value,'music');
});
test('authenticated endpoint validates city catalogue, limits, origin, owner and server metadata',async()=>{
 let user=null, stored=true, allowed=true, catalog={status:'ready',events:[{id:eventId,category:'music'}]}, campaign=null;
 const rows=[];
 const {POST}=await loadTs('app/api/friend/events/track/route.ts',{
  'node:crypto':{createHash},'next/server':nextMock,'@/lib/auth':{getCurrentUser:async()=>user},'@/lib/rate-limit':{rateLimit:async()=>({ok:allowed})},
  '@/lib/friend-location':{friendLocationContext:async()=>({metro:'boston'})},'@/lib/city-events-server':{cityEvents:async()=>catalog},
  '@/lib/app-events':{recordAppEvent:async row=>{rows.push(row);return stored;} },'@/lib/outside-event-tracking':{parseOutsideInput},'@/lib/friend-event-attribution':{friendEventCampaignContext:async()=>campaign},
 });
 const body={action:'impression',sessionId,eventId};
 const req=(b=body,origin='https://example.test')=>new Request('https://example.test/api/friend/events/track',{method:'POST',headers:{origin},body:JSON.stringify(b)});
 assert.equal((await POST(req())).status,401);user={id:randomUUID()};
 assert.equal((await POST(req(body,'https://attacker.test'))).status,403);
 allowed=false;assert.equal((await POST(req())).status,429);allowed=true;
 assert.equal((await POST(req({action:'plan_create',sessionId,eventId}))).status,400);
 assert.equal((await POST(req({...body,eventId:'live:curated:unknown'}))).status,400);
 catalog.status='unavailable';assert.equal((await POST(req())).status,503);catalog.status='ready';
 assert.equal((await POST(req({...body,query:'private',userId:'other',category:'forged',campaign_delivery_id:'fake'}))).status,200);
 assert.equal(rows[0].userId,user.id);assert.equal(rows[0].metadata.category,'music');assert.equal(rows[0].metadata.campaign_delivery_id,null);assert.equal('query' in rows[0].metadata,false);
 await POST(req());assert.equal(rows[0].dedupeKey,rows[1].dedupeKey);
 await POST(req({...body,sessionId:randomUUID()}));assert.notEqual(rows[0].dedupeKey,rows[2].dedupeKey);
 campaign={deliveryId:randomUUID(),channel:'email'};await POST(req());assert.equal(rows[3].metadata.campaign_delivery_id,campaign.deliveryId);assert.notEqual(rows[3].dedupeKey,rows[0].dedupeKey);
 assert.equal((await POST(req({...body,padding:'x'.repeat(3000)}))).status,413);
 stored=false;assert.equal((await POST(req())).status,503);
});
test('server outcomes distinguish catalogue plans, dedupe retry/toggles and do not require campaign',async()=>{
 const rows=[];let claim=null;let attribution=0;
 const q={select:()=>q,eq:()=>q,in:()=>q,gte:()=>q,maybeSingle:async()=>({data:{id:'delivery'},error:null}),upsert:async()=>attribution++};
 const {recordFriendEventConversion}=await loadTs('lib/friend-event-attribution.ts',{
 'node:crypto':{createHash},'next/headers':{cookies:async()=>({get:()=>({value:'token'})})},
 '@/lib/supabase':{supabaseAdmin:{from:()=>q}},'@/lib/app-events':{recordAppEvent:async row=>rows.push(row)},
 '@/lib/outside-event-tracking':{OUTSIDE_ID_RE,SESSION_RE},'@/lib/friend-event-campaign':{FRIEND_EVENT_COOKIE:'test',verifyFriendEventToken:()=>claim},
 });
 const user=randomUUID(),planId=randomUUID();
 await recordFriendEventConversion(user,'plan_create');assert.equal(rows.length,0);
 await recordFriendEventConversion(user,'plan_create',{eventId,planId,sessionId});
 await recordFriendEventConversion(user,'plan_create',{eventId,planId,sessionId:randomUUID()});
 assert.equal(rows.length,2);assert.equal(rows[0].dedupeKey,rows[1].dedupeKey);assert.equal(attribution,0);assert.equal(rows[0].metadata.campaign_delivery_id,null);
 claim={userId:user,deliveryId:randomUUID(),channel:'email'};
 await recordFriendEventConversion(user,'plan_join',{eventId,planId,sessionId:'private-value'});
 assert.equal(rows[2].sessionId,null);assert.equal(rows[2].metadata.campaign_delivery_id,claim.deliveryId);assert.equal(attribution,1);
 await recordFriendEventConversion(user,'plan_join',{eventId:'invalid',planId});assert.equal(rows.length,3);
});
test('app event recorder acknowledges durable inserts or duplicate keys, not storage failure',async()=>{
 let error=null;
 const {recordAppEvent}=await loadTs('lib/app-events.ts',{'@/lib/supabase':{supabaseAdmin:{from:()=>({insert:async()=>({error})})}}});
 assert.equal(await recordAppEvent({eventName:'outside_event_panel_open'}),true);
 error={code:'23505'};assert.equal(await recordAppEvent({eventName:'outside_event_panel_open'}),true);
 error={code:'synthetic',message:'test-only storage failure'};const log=console.error;console.error=()=>{};
 try{assert.equal(await recordAppEvent({eventName:'outside_event_panel_open'}),false);}finally{console.error=log;}
});
