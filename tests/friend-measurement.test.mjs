import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeFriendMeasurement} from '../scripts/friend-measurement.mjs';
import {collectFriendMeasurement} from '../scripts/collect-friend-measurement.mjs';
const start='2026-11-14T00:00:00Z',end='2026-11-16T12:00:00Z';
const input=()=>({users:[{id:'a'},{id:'b'},{id:'test',is_test:true},{id:'owner',email:'owner@test.test'},{id:'blocked',is_blocked:true}],events:[],deliveries:[],attributions:[],pushReceipts:[],ownerReviews:[],plans:[],comments:[],feedback:[]});
const summary=i=>summarizeFriendMeasurement(i,{start,end,adminEmails:['owner@test.test']});
test('reports unique people separately, Eastern later-day observation, and excludes ineligible accounts',()=>{
 const i=input();i.events=['a','a','b','test','owner','blocked'].map((user_id,n)=>({user_id,event_name:'outside_event_impression',created_at:'2026-11-14T12:00:00Z',session_id:'session'+n,metadata:{event_id:'live:tm:abc',category:'music'}}));
 i.events.push({...i.events[0],created_at:'2026-11-15T12:00:00Z'});
 const s=summary(i);assert.deepEqual(s.intervalFunnel.outside_event_impression,{observations:4,members:2,sessions:3,plans:0});
 assert.equal(s.observedRetention[0].laterDayObservedMembers,1);assert.equal(s.intervalBySource.ticketmaster.outside_event_impression.members,2);
 assert.equal(JSON.stringify(s).includes('owner@test.test'),false);
});
test('campaign email delivery, push devices, authenticated members and owner copies stay distinct',()=>{
 const i=input();i.deliveries=[{id:'d1',user_id:'a',campaign_id:'email',channel:'email',status:'suppressed',claimed_at:start,accepted_at:start,delivered_at:start,complained_at:start},{id:'d2',user_id:'a',campaign_id:'push',channel:'push',status:'accepted',claimed_at:start,accepted_at:start}];
 i.deliveries.push({...i.deliveries[0],id:'excluded',user_id:'owner'});
 i.attributions=[{delivery_id:'d1',event:'link_request',occurred_at:start},{delivery_id:'d2',event:'authenticated_return',occurred_at:start},{delivery_id:'owner-copy',event:'authenticated_return',occurred_at:start}];
 i.pushReceipts=[1,2].map(device_id=>({delivery_id:'d2',device_id,outcome:'accepted',recorded_at:start}));i.ownerReviews=[{accepted_at:start}];
 const s=summary(i);assert.equal(s.deliveryAccounting['email:email'].emailDeliveredRows,2);assert.equal(s.deliveryAccounting['email:email'].excludedFromMemberMetrics,1);assert.equal(s.campaigns['email:email'].emailDeliveredMembers,1);assert.equal(s.campaigns['email:email'].complaintMembers,1);
 assert.equal(s.campaigns['push:push'].providerAcceptedMembers,1);assert.equal(s.campaigns['push:push'].acceptedPushDevices,2);assert.equal(s.campaigns['push:push'].emailDeliveredMembers,0);
 assert.equal(s.campaigns['push:push'].attributedMembers.authenticated_return.members,1);assert.equal(s.ownerReviews.acceptedCopiesExcluded,1);
});
test('outside-plan conversations require two real contributors and feedback remains self-report',()=>{
 const i=input();i.plans=[{id:'p',author_id:'a',external_event_id:'live:curated:abc',created_at:start}];
 i.comments=['a','a','test','owner'].map(user_id=>({activity_id:'p',user_id,created_at:start}));
 i.feedback=[{plan_id:'p',plan_kind:'friend',user_id:'a',met:true,updated_at:start}];
 assert.equal(summary(i).outsidePlans.plansWithTwoRealChatContributors,0);
 i.comments.push({activity_id:'p',user_id:'b',created_at:start});
 assert.equal(summary(i).outsidePlans.plansWithTwoRealChatContributors,1);assert.equal(summary(i).outsidePlans.currentSelfReportedMet.members,1);
});
test('collector uses GET only, strips private columns, paginates and fails closed',async()=>{
 const calls=[];const env={NOTCUPID_REPORT_BASELINE:start,NOTCUPID_REPORT_END:end,ADMIN_EMAILS:'owner@test.test',NEXT_PUBLIC_SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_KEY:'synthetic'};
 const fetcher=async(url,init)=>{calls.push([url,init]);return Response.json(url.pathname.endsWith('/users')&&url.searchParams.get('offset')==='0'?Array.from({length:500},(_,n)=>({id:String(n)})):[]);};
 const s=await collectFriendMeasurement(env,fetcher);assert.deepEqual(s.errors,[]);
 assert.equal(calls.filter(([u])=>u.pathname.endsWith('/users')).length,2);
 assert.ok(calls.every(([u,o])=>o.method==='GET'&&o.redirect==='error'&&!/body|title|manifest|provider_id|endpoint/.test(u.searchParams.get('select'))));
 await assert.rejects(collectFriendMeasurement(env,async()=>new Response('private error',{status:503})),/Aggregate read failed/);
 await assert.rejects(collectFriendMeasurement({...env,ADMIN_EMAILS:''},fetcher),/configuration/);
});
