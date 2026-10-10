import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, nextMock } from './helpers/load-ts.mjs';
import { ROSTER_PHASES, parseRosterTiming } from '../lib/roster-timing.ts';
import { requestLogin } from '../lib/login-request.ts';
import { clientErrorContext } from '../lib/client-error-fingerprint.ts';

async function otpHarness({sent = {ok:true}, limited = false} = {}) {
  const writes=[], sends=[], limits=[];
  const {POST}=await loadTs('app/api/send-otp/route.ts', {
    'next/server':nextMock, crypto:{randomInt:()=>123456},
    '@/lib/supabase':{supabaseAdmin:{from:()=>({upsert:async row=>{writes.push(row);return {error:null}}})}},
    '@/lib/rate-limit':{getClientIp:()=> 'synthetic',rateLimit:async args=>{limits.push(args);return {ok:!limited,retryAfterSec:60}}},
    '@/lib/email':{renderEmail:()=> 'mock html',infoCard:()=> '',sendEmail:async args=>{sends.push(args);return sent}},
    '@/lib/otp':{hashOtp:()=> 'hashed-code'},
  });
  return {POST,writes,sends,limits};
}
test('invalid input and reserved recipients never write an OTP or call email provider',async()=>{
  for(const value of [null,{}, {email:7},{email:[]},{email:'a@example.com'},{email:'a@sub.example.org'},{email:'a@foo.invalid'},{email:'no-address'}]) {
    const h=await otpHarness(); const result=await h.POST({json:async()=>value});
    assert.equal(result.status,400);assert.equal((await result.json()).code,'invalid_email');
    assert.equal(h.writes.length,0);assert.equal(h.sends.length,0);
  }
  const h=await otpHarness();assert.equal((await h.POST({json:async()=>{throw Error('malformed')}})).status,400);
});
test('OTP keeps expiry, hash, rate limits and generic provider rejection',async()=>{
  const h=await otpHarness({sent:{ok:false,error:'private provider error'}});
  const before=Date.now();const result=await h.POST({json:async()=>({email:' Synthetic@notcupid.com '})});
  assert.equal(result.status,503);assert.deepEqual(await result.json(),{error:'We could not deliver a code. Check your email address and try again shortly.',code:'delivery_unavailable'});
  assert.equal(h.writes[0].code,'hashed-code');assert.equal(h.writes[0].verified,false);
  assert.ok(Date.parse(h.writes[0].expires_at)>=before+899000);
  assert.deepEqual(h.limits.map(x=>[x.maxAttempts,x.windowSec]),[[3,600],[40,600]]);
  assert.equal(h.sends.length,1);
  const limited=await otpHarness({limited:true});assert.equal((await limited.POST({json:async()=>({email:'synthetic@notcupid.com'})})).status,429);assert.equal(limited.writes.length,0);
});
test('login shows allowlisted errors without trusting server text or retrying',async()=>{
  for(const [status,code,text] of [[400,'invalid_email','Enter a valid'],[503,'delivery_unavailable','could not deliver']]) {
    let calls=0;const result=await requestLogin('send',{email:'synthetic@notcupid.com'},{request:async()=>{calls++;return Response.json({code,error:'secret'},{status})}});
    assert.equal(result.ok,false);assert.match(result.error,new RegExp(text));assert.doesNotMatch(result.error,/secret/);assert.equal(calls,1);
  }
});
test('source context is coarse and does not infer document errors are app bugs',()=>{
  const o='https://notcupid.com';
  assert.equal(clientErrorContext(o+'/hub?secret=1','',o),'document');
  assert.equal(clientErrorContext(o+'/_next/static/a.js','',o),'app_bundle');
  assert.equal(clientErrorContext(null,'at https://notcupid.com/_next/static/a.js:2',o),'app_stack');
  assert.equal(clientErrorContext(null,'chrome-extension://secret/a.js',o),'extension');
  assert.equal(clientErrorContext('https://external.invalid/a.js','',o),'external');
});
test('diagnostic realm requires a valid server session and never mutates activity',async()=>{
  for(const scenario of ['anonymous','expired','test','member','missing']) {
    let tables=[];
    const {getDiagnosticRealm}=await loadTs('lib/auth.ts',{
      'next/headers':{cookies:async()=>({get:()=>scenario==='anonymous'?undefined:{value:'synthetic-token'}})},
      crypto:{createHash:()=>({update:()=>({digest:()=> 'hash'})})},
      '@/lib/supabase':{supabaseAdmin:{from:table=>{tables.push(table);const q={select:()=>q,eq:()=>q,is:()=>q,neq:()=>q,maybeSingle:async()=>({data:table==='sessions'?{user_id:'synthetic',expires_at:scenario==='expired'?'2000-01-01':'2099-01-01'}:scenario==='missing'?null:{is_test:scenario==='test'}})};return q}}},
    });
    assert.equal(await getDiagnosticRealm(),['test','member'].includes(scenario)?scenario:'unattributed');
    if(scenario==='anonymous')assert.deepEqual(tables,[]);
    if(scenario==='expired')assert.deepEqual(tables,['sessions']);
  }
});
test('client QA flags cannot impersonate a trusted test account',async()=>{
  let captured;
  const {POST}=await loadTs('app/api/performance/route.ts',{
    'next/server':nextMock,
    '@/lib/roster-timing':{ROSTER_PHASES},
    '@/lib/auth':{getDiagnosticRealm:async()=> 'unattributed'},
    '@/lib/app-events':{recordAppEvent:async x=>{captured=x}},
    '@/lib/rate-limit':{getClientIp:()=> 'synthetic',rateLimit:async()=>({ok:true})},
  });
  assert.equal((await POST({json:async()=>null})).status,400);
  await POST({json:async()=>({eventName:'client_error',accountRealm:'test',is_test:true,automationHint:true,sourceContext:'private user text'})});
  assert.equal(captured.metadata.accountRealm,'unattributed');assert.equal(captured.metadata.automationHint,true);assert.equal(captured.metadata.sourceContext,'unknown');assert.equal(captured.userId,undefined);
});

test('roster timings retain only bounded known phases',()=>{
  assert.deepEqual(parseRosterTiming('auth;dur=14.5, secret;dur=12, ranking;dur=600001, total;dur=1200, compose;dur=NaN'),{auth:14.5,total:1200});
});
