import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, nextMock } from './helpers/load-ts.mjs';

for(const denied of ['reported','lookup-failed']) {
  for(const method of ['GET','POST']) test(`authenticated Love ${method} denies ${denied} before history/idempotency access`,async()=>{
    const reads=[];
    const db={from(table){reads.push(table);return {select(){return this},eq(){return this},maybeSingle(){return this.single()},single:async()=>({data:{
      user_1_id:'me',user_2_id:'other',status:'both_accepted',user_1_accepted:true,user_2_accepted:true,
    }})}}};
    const route=await loadTs('app/api/messages/route.ts',{
      'next/server':{...nextMock,after:()=>{}},'@/lib/auth':{getCurrentUser:async()=>({id:'me'})},
      '@/lib/supabase':{supabaseAdmin:db},'@/lib/match-actions':{acceptMatch:()=>{throw Error('not allowed')}},
      '@/lib/rate-limit':{rateLimit:async()=>({ok:true})},
      '@/lib/notification-outbox':{enqueueLoveMessageNotification:()=>{},processNotificationOutbox:()=>{}},
      '@/lib/chat-realtime':{broadcastChatRefresh:()=>{},chatRealtimeTopic:()=>''},
      '@/lib/pair-safety':{pairAllowed:async()=>{if(denied==='lookup-failed')throw Error('offline');return false}},
    });
    const req={nextUrl:new URL('http://test/api/messages?match_id=m'),json:async()=>({match_id:'m',body:'test',client_id:'duplicate1'})};
    assert.equal((await route[method](req)).status,denied==='reported'?403:503);
    assert.deepEqual(reads,['matches']);
  });
}
test('ended chat cannot write typing presence',async()=>{
  let writes=0;
  const route=await loadTs('app/api/matches/[id]/typing/route.ts',{
    'next/server':nextMock,'@/lib/auth':{getCurrentUser:async()=>({id:'me'})},
    '@/lib/supabase':{supabaseAdmin:{from(){return {select(){return this},eq(){return this},
      maybeSingle:async()=>({data:{user_1_id:'me',user_2_id:'other',status:'ended'}}),update(){writes++;return this}}}}},
    '@/lib/pair-safety':{pairAllowed:async()=>true},
  });
  assert.equal((await route.POST({}, {params:Promise.resolve({id:'m'})})).status,409);
  assert.equal(writes,0);
});
test('shared peer eligibility excludes reports and opposite test realms',async()=>{
  const module=await loadTs('lib/pair-safety.ts',{
    '@/lib/friend-report-policy':{reportedFriendIds:async()=>new Set(['reported'])},
    '@/lib/supabase':{supabaseAdmin:{from(){return {select(){return this},in(k,ids){assert.ok(!ids.includes('reported'));return this},
      is(){return this},neq:async()=>({data:[{id:'real',is_test:false},{id:'test',is_test:true}]})}}}},
  });
  assert.deepEqual([...await module.safePeerIds({id:'me',is_test:false},['real','test','reported'])],['real']);
});

test('queued Love notice is skipped after a report without touching either provider',async()=>{
  let deliveries=0;
  const module=await loadTs('lib/love-message-notification.ts',{
    '@/lib/supabase':{supabaseAdmin:{from(){return {select(){return this},eq(){return this},maybeSingle:async()=>({data:{
      user_1_id:'a',user_2_id:'b',user_1_accepted:true,user_2_accepted:true,status:'both_accepted',
    }})}}}},
    '@/lib/pair-safety':{pairAllowed:async()=>false},
    '@/lib/email':{sendEmail:async()=>{deliveries++;},renderEmail:()=>'',button:()=>''},
    '@/lib/push':{sendPushToUserDetailed:async()=>{deliveries++;}},
    '@/lib/daily-activity-email':{dailyActivityEmailActivation:()=>({enabled:false})},
  });
  assert.deepEqual(await module.deliverLoveMessageNotification({matchId:'m',senderId:'a',recipientId:'b',messageId:'msg'}),
    {complete:true,errorCode:'pair_unavailable'});
  assert.equal(deliveries,0);
});

for(const state of ['confirmed','cancelled']) test(`date message notification ${state} rechecks two-person membership`,async()=>{
  const db={from(table){const q={select(){return q},eq(){return q},in(){return q},is(){return q},neq(){return q},or(){return q},
    gte:async()=>({data:[{id:'a',is_test:false},{id:'b',is_test:false}]}),limit:async()=>({data:[]}),
    maybeSingle:async()=>({data:{host_id:'a',guest_id:'b',state,is_test:false}})};return q;}};
  const module=await loadTs('lib/date-plan-notification.ts',{'@/lib/supabase':{supabaseAdmin:db}});
  assert.equal(await module.dateNoticeStillRelevant({entity_id:'plan',actor_id:'a',recipient_id:'b',payload:{dateEvent:'message'}}),state==='confirmed');
  assert.equal(await module.dateNoticeStillRelevant({entity_id:'plan',actor_id:'a',recipient_id:'stranger',payload:{dateEvent:'message'}}),false);
});
