import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs,nextMock} from './helpers/load-ts.mjs';

test('renewal cancellation cannot target a subscription supplied by the caller',async()=>{
  const calls=[];
  const route=await loadTs('app/api/pro/cancel/route.ts',{'next/server':nextMock,
    '@/lib/auth':{getCurrentUser:async()=>({id:'u',friend_sub_id:'sub_own'})},
    '@/lib/rate-limit':{rateLimit:async()=>({ok:true})},
    '@/lib/subscription-management':{cancelStripeRenewal:async id=>{calls.push(id);return true;}},
  });
  assert.equal((await route.POST({friend_sub_id:'sub_other'})).status,200);assert.deepEqual(calls,['sub_own']);
});

for(const scenario of ['deleted','reported-by-me','reported-by-other','report-query-failure']) test(`match profile denies ${scenario}`,async()=>{
  let rendered=false;
  const db={from(table){let deletedFilter=false;const q={select(){return q},eq(){return q},or(){return q},neq(){return q},is(k,v){if(k==='deleted_at' && v===null)deletedFilter=true;return q},
    limit:async()=>({data:scenario.startsWith('reported')?[{id:'report'}]:[],error:scenario==='report-query-failure'?{}:null}),
    single:async()=>({data:table==='matches'?{id:'m',user_1_id:'u',user_2_id:'other'}:deletedFilter?null:{id:'other',is_test:false}})};return q;}};
  const route=await loadTs('app/match/[id]/page.tsx',{
    'react/jsx-runtime':{jsx:()=>{rendered=true;}},'next/navigation':{redirect:()=>{throw Error('redirect');}},
    '@/lib/auth':{getCurrentUser:async()=>({id:'u'})},'@/lib/supabase':{supabaseAdmin:db},'./chat-room':{default:()=>{}},
    '@/lib/love-deep-dive':{freeLoveProfileView:x=>x},'@/lib/realm':{sameRealm:()=>true},
    '@/lib/private-media':{withPrivateVideoPreview:()=>{throw Error('private_media_exposed');}},'@/lib/quiz-data':{attachStyle:()=>''},
    '@/lib/love-notification-ledger':{markLoveNotificationOpened:()=>{}},'@/lib/pro':{isPro:()=>false},'@/lib/chat-realtime':{chatRealtimeTopic:()=>''},
  });
  await assert.rejects(()=>route.default({params:Promise.resolve({id:'m'}),searchParams:Promise.resolve({})}),/redirect/);
  assert.equal(rendered,false);
});

test('portal only uses the signed-in customer, never a supplied customer',async()=>{
  let args;
  const route=await loadTs('app/api/pro/portal/route.ts',{
    'next/server':nextMock,'@/lib/auth':{getCurrentUser:async()=>({id:'u',stripe_customer_id:'cus_own'})},
    '@/lib/rate-limit':{rateLimit:async()=>({ok:true})},
    '@/lib/subscription-management':{stripePortal:async(...a)=>{args=a;return 'https://billing.stripe.com/session';}},
  });
  assert.equal((await route.POST(new Request('http://test',{method:'POST',body:JSON.stringify({customer:'cus_victim'})}))).status,200);
  assert.equal(args[0],'cus_own');
});
test('two Pro checkouts share the database idempotency key and existing subscriptions are refused',async()=>{
  const user={id:'u',email:'qa@invalid.test'};const keys=[];
  const route=await loadTs('app/api/pro/checkout/route.ts',{
    'next/server':nextMock,'@/lib/auth':{getCurrentUser:async()=>user},
    '@/lib/supabase':{supabaseAdmin:{rpc:async()=>({data:{key:'stable',expires_at:1234567890}})}},
    '@/lib/pro':{PRO_PRICE_CENTS:399,isPro:()=>false},'@/lib/rate-limit':{rateLimit:async()=>({ok:true})},
    '@/lib/monetization':{recordMonetizationEvent:async()=>{}},
    '@/lib/payment-provider':{createStripeCheckoutSession:async input=>{keys.push(input);return {ok:true,url:'https://checkout.stripe.com/qa'};},PAYMENT_TEMPORARILY_UNAVAILABLE_MESSAGE:'Unavailable'},
  });
  const results=await Promise.all([route.POST({}),route.POST({})]);
  assert.ok(results.every(r=>r.status===200));assert.equal(keys[0].idempotencyKey,keys[1].idempotencyKey);
  assert.equal(keys[0].stableIdempotencyKey,true);
  user.friend_sub_id='sub_existing';assert.equal((await route.POST({})).status,409);assert.equal(keys.length,2);
});
test('deletion attempts subscription cancellation and media cleanup even when Stripe fails',async()=>{
  const calls=[];
  const query={select(){return this},eq(){return this},single:async()=>({data:{friend_sub_id:'sub_existing'}})};
  const route=await loadTs('app/api/profile/delete/route.ts',{
    'next/server':nextMock,'@/lib/auth':{getCurrentUser:async()=>({id:'u'}),destroySession:async()=>calls.push('session')},
    '@/lib/supabase':{supabaseAdmin:{rpc:async()=>({data:true}),from:()=>query}},
    '@/lib/subscription-management':{cancelStripeSubscription:async id=>{calls.push(id);return false;}},
    '@/lib/account-media-cleanup':{removeAccountMedia:async id=>calls.push('media:'+id)},
  });
  const result=await route.POST();assert.equal(result.status,200);assert.equal((await result.json()).cleanupPending,true);
  assert.deepEqual(calls,['sub_existing','media:u','session']);
});
test('media deletion walks paginated owner folders and never another user',async()=>{
  const owner='00000000-0000-4000-8000-000000000001',removed=[];
  const module=await loadTs('lib/account-media-cleanup.ts',{
    '@/lib/supabase':{supabaseAdmin:{storage:{from:bucket=>({
      list:async(prefix,{offset})=>({data:bucket==='profile-photos'&&prefix===owner?(offset===0?Array.from({length:100},(_,i)=>({id:String(i),name:`${i}.jpg`})):offset===100?[{id:null,name:'gallery'}]:[]):prefix===owner+'/gallery'?[{id:'last',name:'last.jpg'}]:[]}),
      remove:async paths=>{removed.push(...paths);return {error:null};},
    })}}},'@/lib/request-security':{managedStoragePath:()=>null},
  });
  await module.removeAccountMedia(owner);assert.equal(removed.length,101);assert.ok(removed.every(p=>p.startsWith(owner+'/')));
});
