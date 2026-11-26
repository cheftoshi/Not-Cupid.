import test from 'node:test';
import assert from 'node:assert/strict';
import {fridayWindow, fridayPreparationWindow, isFridaySendWindow, fridayReadinessPlan} from '../lib/friday-friends-policy.ts';
import {loadTs,nextMock} from './helpers/load-ts.mjs';
const at=s=>Date.parse(s);
test('Friday Eastern window observes DST, closes at 14:15 and never catches up late',()=>{
 for(const [now,day,start] of [['2026-11-26T12:00:00Z','2026-11-27','2026-11-27T19:00:00Z'],['2026-03-09T12:00:00Z','2026-03-13','2026-03-13T18:00:00Z'],['2026-10-31T12:00:00Z','2026-11-06','2026-11-06T19:00:00Z']]){
  const w=fridayWindow(at(now));assert.equal(w.day,day);assert.equal(w.start,at(start));assert.deepEqual(w.attempts,[w.start,w.start+300000,w.start+600000]);
  assert.equal(isFridaySendWindow(day,w.start-1),false);assert.equal(isFridaySendWindow(day,w.start),true);assert.equal(isFridaySendWindow(day,w.end-1),true);assert.equal(isFridaySendWindow(day,w.end),false);
  assert.throws(()=>fridayPreparationWindow(day,w.prepareStart-1));assert.equal(fridayPreparationWindow(day,w.prepareStart).day,day);
  assert.notEqual(fridayWindow(w.end).day,day);
 }
 assert.throws(()=>fridayWindow(NaN));const plan=fridayReadinessPlan(at('2026-11-26T12:00:00Z'));assert.equal(plan.scheduled,false);assert.equal(plan.sendReady,false);assert.equal(plan.authorizedRecipients,0);
});
test('Friday admin entry point is authenticated, Friday-only and refuses send/audience/time overrides',async()=>{
 const saved={token:process.env.FRIEND_DISCOVERY_PREPARE_TOKEN,expires:process.env.FRIEND_DISCOVERY_PREPARE_EXPIRES,now:Date.now};let calls=0;
 try{
 Date.now=()=>at('2026-11-27T18:30:00Z');process.env.FRIEND_DISCOVERY_PREPARE_TOKEN='p'.repeat(40);process.env.FRIEND_DISCOVERY_PREPARE_EXPIRES='2026-11-27T20:00:00Z';
 const policy=await import('../lib/friday-friends-policy.ts');
 const {GET,POST}=await loadTs('app/api/admin/friday-friends-prepare/route.ts',{'next/server':nextMock,'@/lib/request-security':{timingSafeStringEqual:(a,b)=>a===b},'@/lib/friday-friends-policy':policy,'@/lib/friend-discovery-prepare':{prepareFriendDiscovery:async(...args)=>{calls++;assert.deepEqual(args,['weekend',1,Date.now(),'2026-11-27']);return {prepared:true,sendReady:false,authorizedRecipients:0};}}});
 const req=(body,auth=true)=>new Request('https://example.test/api/admin/friday-friends-prepare',{method:'POST',headers:auth?{authorization:'Bearer '+'p'.repeat(40)}:{},body:JSON.stringify(body)});
 assert.equal((await GET(req({},false))).status,403);assert.equal((await GET(req({}))).status,200);assert.equal(calls,0);
 for(const extra of [{edition:'ideas'},{send:true},{audience:'all'},{startHour:15},{action:'execute'}]) assert.equal((await POST(req({deliveryDay:'2026-11-27',...extra}))).status,400);
 assert.equal((await POST(req({deliveryDay:'2026-11-27'}))).status,200);assert.equal(calls,1);
 Date.now=()=>at('2026-11-27T19:15:00Z');assert.equal((await POST(req({deliveryDay:'2026-11-27'}))).status,409);assert.equal(calls,1);
 process.env.FRIEND_DISCOVERY_PREPARE_EXPIRES='2026-11-26T20:00:00Z';assert.equal((await GET(req({}))).status,403);
 }finally{Date.now=saved.now;for(const [key,value] of [['FRIEND_DISCOVERY_PREPARE_TOKEN',saved.token],['FRIEND_DISCOVERY_PREPARE_EXPIRES',saved.expires]])value===undefined?delete process.env[key]:process.env[key]=value;}
});
