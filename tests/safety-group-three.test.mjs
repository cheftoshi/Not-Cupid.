import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs,nextMock} from './helpers/load-ts.mjs';

const uid='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const request=body=>new Request('http://local.test',{method:'POST',body:JSON.stringify(body)});

for(const path of ['app/api/quiz/update/route.ts','app/api/quiz/love-deep/route.ts']) {
  test(path+' rejects oversized/array JSON without writing',async()=>{
    let writes=0;
    const validation=await loadTs('lib/quiz-validation.ts',{});
    const route=await loadTs(path,{'next/server':nextMock,'@/lib/auth':{getCurrentUser:async()=>({id:uid})},
      '@/lib/supabase':{supabaseAdmin:{from(){writes++;throw Error('must not write');}}},
      '@/lib/quiz-validation':validation});
    for(const body of [{values_profile:{text:'x'.repeat(5000)}},{vibes:[]},{vibes:{text:'x'.repeat(5000)}}]) {
      assert.equal((await route.POST(request(body))).status,400);
    }
    assert.equal(writes,0);
  });
}
test('core quiz clamps six scores and caps archetype; deep quiz cannot overwrite them',async()=>{
  const validation=await loadTs('lib/quiz-validation.ts',{});
  for(const path of ['app/api/quiz/update/route.ts','app/api/quiz/love-deep/route.ts']) {
    const writes=[];
    const db={from(table){const q={update(value){if(table==='users')writes.push(value);return q;},eq(){return q;},or(){return q;},then(resolve){return Promise.resolve({error:null}).then(resolve);}};return q;}};
    const route=await loadTs(path,{'next/server':nextMock,'@/lib/auth':{getCurrentUser:async()=>({id:uid})},
      '@/lib/supabase':{supabaseAdmin:db},'@/lib/quiz-validation':validation});
    const body={score_honesty:-9,score_emotionality:90,score_extraversion:'bad',score_agreeableness:4,score_conscientiousness:8,score_openness:0,archetype:'a'.repeat(200),vibes:{ok:true},values_profile:{ok:true},seeking:'b',age_min:18,age_max:99};
    assert.equal((await route.POST(request(body))).status,200);
    if(path.includes('/update/')) {
      assert.equal(writes[0].score_honesty,0);assert.equal(writes[0].score_emotionality,8);
      assert.equal(writes[0].score_extraversion,0);assert.equal(writes[0].archetype.length,80);
    } else {assert.equal(writes[0].score_honesty,undefined);assert.equal(writes[0].archetype,undefined);}
  }
});
for(const kind of ['dm','circle','club','plan']) test('Friend '+kind+' report uses authenticated identity and bounded detail',async()=>{
  let args;
  const route=await loadTs('app/api/friend/report/route.ts',{'next/server':nextMock,
    '@/lib/auth':{getCurrentUser:async()=>({id:uid})},'@/lib/rate-limit':{rateLimit:async()=>({ok:true})},
    '@/lib/supabase':{supabaseAdmin:{rpc:async(name,value)=>{assert.equal(name,'report_friend_context');args=value;return {data:true};}}}});
  assert.equal((await route.POST(request({reportedId:other,contextType:kind,contextId:other,reporterId:other,reason:'harassment',detail:'x'.repeat(3000)}))).status,200);
  assert.equal(args.p_reporter,uid);assert.equal(args.p_detail.length,2000);
});
test('report route refuses invalid and unauthorized contexts and fails closed',async()=>{
  let result={data:false},calls=0;
  const route=await loadTs('app/api/friend/report/route.ts',{'next/server':nextMock,
    '@/lib/auth':{getCurrentUser:async()=>({id:uid})},'@/lib/rate-limit':{rateLimit:async()=>({ok:true})},
    '@/lib/supabase':{supabaseAdmin:{rpc:async()=>{calls++;return result;}}}});
  const body={reportedId:other,contextType:'club',contextId:other,reason:'harassment'};
  assert.equal((await route.POST(request({...body,contextType:'unrestricted'}))).status,400);assert.equal(calls,0);
  assert.equal((await route.POST(request(body))).status,403);
  result={error:{}};assert.equal((await route.POST(request(body))).status,503);
});
test('report exclusions paginate, include both directions and fail closed',async()=>{
  let pages=0,fail=false;
  const q={select(){return q;},or(){return q;},order(){return q;},range:async()=>{pages++;return fail?{error:{}}:{data:pages===1?Array.from({length:500},(_,i)=>({reporter_id:uid,reported_id:'p'+i})):[{reporter_id:other,reported_id:uid}]};}};
  const module=await loadTs('lib/friend-report-policy.ts',{'@/lib/supabase':{supabaseAdmin:{from:()=>q}}});
  const result=await module.reportedFriendIds(uid);assert.equal(result.size,501);assert.ok(result.has(other));assert.equal(pages,2);
  fail=true;await assert.rejects(()=>module.reportedFriendIds(uid),/unavailable/);
});
test('ending a match delegates atomic eligibility to SQL and returns credits only for non-mutual matches',async()=>{
  let state={changed:true,was_mutual:true},refunds=0;
  const route=await loadTs('app/api/matches/[id]/end/route.ts',{'next/server':nextMock,
    '@/lib/auth':{getCurrentUser:async()=>({id:uid})},'@/lib/supabase':{supabaseAdmin:{rpc:async(name,args)=>{assert.equal(name,'end_love_match_safely');assert.equal(args.p_user,uid);return {data:state};}}},
    '@/lib/love-pick-access':{returnLovePickEntitlement:async()=>refunds++}});
  await route.POST(request({reason:'ghosted'}),{params:Promise.resolve({id:other})});assert.equal(refunds,0);
  state={changed:true,was_mutual:false};
  await route.POST(request({}),{params:Promise.resolve({id:other})});assert.equal(refunds,1);
});

test('reported Friend push jobs are skipped without contacting a push provider',async()=>{
  let pushes=0;const calls=[];
  const worker=await loadTs('lib/notification-outbox.ts',{
    '@/lib/supabase':{supabaseAdmin:{rpc:async(name,args)=>{
      calls.push(name);
      return name==='claim_notification_jobs'?{data:[{id:'job',job_type:'push',actor_id:other,recipient_id:uid,entity_type:'friend_club',payload:{}}]}:{data:true};
    }}},
    '@/lib/push':{sendPushToUserDetailed:async()=>{pushes++;return {delivered:true};}},
    '@/lib/love-message-notification':{deliverLoveMessageNotification:async()=>{}},
    '@/lib/date-plan-notification':{dateNoticeStillRelevant:async()=>true},
    '@/lib/friend-report-policy':{reportedFriendIds:async()=>new Set([other])},
  });
  const result=await worker.processNotificationOutbox();assert.equal(result.skipped,1);assert.equal(result.delivered,0);
  assert.equal(pushes,0);assert.ok(calls.includes('skip_notification_job'));
});

test('Friend DM access denies reported pairs before reading any messages',async()=>{
  const queries=[];
  const q={select(){return q;},eq(){return q;},is(){return q;},maybeSingle:async()=>({data:{id:other,is_test:false}})};
  const route=await loadTs('app/api/friend/dm/route.ts',{
    'next/server':nextMock,'@/lib/auth':{getCurrentUser:async()=>({id:uid,is_test:false})},
    '@/lib/supabase':{supabaseAdmin:{from(table){queries.push(table);return q;}}},
    '@/lib/rate-limit':{rateLimit:async()=>({ok:true})},'@/lib/realm':{sameRealm:()=>true},
    '@/lib/notification-outbox':{enqueuePushNotification:async()=>{},processNotificationOutbox:async()=>{}},
    '@/lib/chat-realtime':{broadcastChatRefresh:async()=>{},chatRealtimeTopic:()=>''},
    '@/lib/friend-report-policy':{reportedFriendIds:async()=>new Set([other])},
  });
  const result=await route.GET({nextUrl:new URL('http://test?with='+other)});
  assert.equal(result.status,403);assert.ok(!queries.includes('friend_dms'));
});
