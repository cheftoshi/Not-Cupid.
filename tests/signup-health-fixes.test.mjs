import test from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import {loadTs, nextMock} from './helpers/load-ts.mjs';
import {personalityPercent} from '../lib/personality-display.ts';

process.env.MATCH_LINK_SECRET = 'local-test-secret-not-a-real-credential';
delete process.env.PROFILE_COMPLETION_EMAIL_APPROVAL_VERSION;
const proofModule = await loadTs('lib/signup-proof.ts', {crypto});
const {issueSignupProof, verifySignupProof, SIGNUP_PROOF_COOKIE} = proofModule;
const email = 'a_b@x.com', codeHash = 'a'.repeat(64);
const future = () => new Date(Date.now() + 600_000).toISOString();

test('signup proof rejects missing, changed, wrong-email and expired credentials', () => {
  const token = issueSignupProof(email, codeHash, future());
  assert.equal(verifySignupProof(token, email).codeHash, codeHash);
  for (const value of [undefined, '', token+'x', 'junk', token+'.extra']) assert.equal(verifySignupProof(value, email), null);
  assert.equal(verifySignupProof(token, 'a.b@x.com'), null);
  assert.equal(verifySignupProof(token, email, Date.now()+900_000), null);
});

// In-memory PostgREST seam. Production handlers execute unchanged. Inserts
// enforce the real users_email_unique constraint; no network or email sends.
function fixture() {
  const tables = {otp_codes:[{email,code:codeHash,verified:false,expires_at:future()}], users:[]};
  const sessions = [], cookies = new Map(), cookieOptions = [];
  let destroyed = 0;
  const db = {from(table) {
    let predicates=[], op='select', value;
    const q = {
      select(){return q;}, order(){return q;}, limit(){return q;},
      eq(k,v){predicates.push(r=>r[k]===v);return q;},
      is(k,v){predicates.push(r=>(r[k]??null)===v);return q;},
      gt(k,v){predicates.push(r=>r[k]>v);return q;},
      update(v){op='update';value=v;return q;}, delete(){op='delete';return q;}, insert(v){op='insert';value=v;return q;},
      async run(single=false){
        const rows=tables[table];
        let data=rows.filter(r=>predicates.every(p=>p(r)));
        if(op==='insert') {
          const item=value[0];
          if(rows.some(r=>r.email===item.email))return {error:{code:'23505',message:'duplicate'}};
          data=[{id:'new-user',...item}];rows.push(...data);
        }
        if(op==='update') data.forEach(r=>Object.assign(r,value));
        if(op==='delete') tables[table]=rows.filter(r=>!data.includes(r));
        return {data:single?(data[0]??null):data,error:null};
      },
      maybeSingle(){return q.run(true);},single(){return q.run(true);},then(resolve,reject){return q.run().then(resolve,reject);},
    };return q;
  }};
  const store={get:k=>cookies.has(k)?{value:cookies.get(k)}:undefined,set:(k,v,o)=>{cookies.set(k,v);cookieOptions.push(o);},delete:k=>cookies.delete(k)};
  const seams={
    'next/server':nextMock,'next/headers':{cookies:async()=>store},'@/lib/supabase':{supabaseAdmin:db},
    '@/lib/auth':{createSession:async id=>sessions.push(id),destroySession:async()=>{destroyed++;cookies.delete('nc_session');}},
    '@/lib/signup-proof':proofModule,'@/lib/rate-limit':{rateLimit:async()=>({ok:true}),getClientIp:()=> 'local'},
    '@/lib/otp':{hashOtp:()=>codeHash},'@/lib/quiz-data':{metroOf:()=> 'nyc'},
    '@/lib/balance':{metroGenderCounts:async()=>({}),shouldHoldForBalance:()=>false},
    '@/lib/email':{renderEmail:()=>{throw Error('No email');},sendEmail:()=>{throw Error('No sends');}},
    '@/lib/push':{sendPushToUser:()=>{throw Error('No pushes');}},
    '@/lib/acquisition':{acquisitionColumns:()=>({}),sanitizeAcquisition:()=>({})},
  };
  return {tables,sessions,cookies,cookieOptions,seams,get destroyed(){return destroyed;}};
}
const request = body => new Request('https://local/api',{method:'POST',body:JSON.stringify(body)});
const signup = {name:'Local test',age:25,gender:'f',seeking:'m',zip:'10001',email,archetype:'The Curious Realist'};

test('new-email verification clears old session and supplies a private, browser-bound proof', async()=>{
  const f=fixture();f.cookies.set('nc_session','old-account');
  const oldUser={id:'old-account',email:'old@x.com',archetype:'Original archetype'};
  f.tables.users.push({...oldUser});
  const route=await loadTs('app/api/verify-otp/route.ts',f.seams);
  const responses=await Promise.all([route.POST(request({email,code:'123456'})),route.POST(request({email,code:'123456'}))]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);
  assert.equal(f.destroyed,1);assert.equal(f.cookies.has('nc_session'),false);
  assert.equal(verifySignupProof(f.cookies.get(SIGNUP_PROOF_COOKIE),email).codeHash,codeHash);
  assert.equal(f.cookieOptions[0].httpOnly,true);assert.equal(f.cookieOptions[0].sameSite,'strict');
  assert.deepEqual(f.tables.users,[oldUser]);assert.equal(f.sessions.length,0);
  const submit=await loadTs('app/api/submit/route.ts',f.seams);
  assert.equal((await submit.POST(request(signup))).status,200);
  assert.deepEqual(f.tables.users[0],oldUser);
  assert.deepEqual(f.sessions,['new-user']);
});

test('a different browser cannot use the global verified email flag to sign up',async()=>{
  const f=fixture();f.tables.otp_codes[0].verified=true;
  const route=await loadTs('app/api/submit/route.ts',f.seams);
  assert.equal((await route.POST(request(signup))).status,403);
  assert.equal(f.tables.users.length,0);assert.deepEqual(f.sessions,[]);
});

test('verified browser signs up once; concurrent requests and replay create no extra session',async()=>{
  const f=fixture();f.tables.otp_codes[0].verified=true;
  const token=issueSignupProof(email,codeHash,future());f.cookies.set(SIGNUP_PROOF_COOKIE,token);
  const route=await loadTs('app/api/submit/route.ts',f.seams);
  const responses=await Promise.all([route.POST(request(signup)),route.POST(request(signup))]);
  assert.equal(responses.filter(r=>r.status===200).length,1);
  assert.ok(responses.every(r=>[200,403,409].includes(r.status)));
  assert.equal(f.tables.users.length,1);assert.deepEqual(f.sessions,['new-user']);
  f.cookies.set(SIGNUP_PROOF_COOKIE,token);
  assert.equal((await route.POST(request(signup))).status,403);
  assert.deepEqual(f.sessions,['new-user']);
});

test('resending OTP invalidates the previous browser signup proof',async()=>{
  const f=fixture();f.cookies.set(SIGNUP_PROOF_COOKIE,issueSignupProof(email,codeHash,future()));
  f.tables.otp_codes[0]={email,code:'b'.repeat(64),verified:true,expires_at:future()};
  const route=await loadTs('app/api/submit/route.ts',f.seams);
  assert.equal((await route.POST(request(signup))).status,403);
  assert.equal(f.tables.users.length,0);
});

test('personality display bounds legacy values without changing stored input',()=>{
  const scores=[-3,0,4,8,11,16,NaN,Infinity];
  assert.deepEqual(scores.map(personalityPercent),[0,0,50,100,100,100,0,0]);
  assert.equal(scores[4],11);
});

test('rendered email footer correctly leaves matching and push unchanged',async()=>{
  const module=await loadTs('lib/email.ts',{crypto,'./email-address.ts':{defaultEmailReplyTo:()=> 'match@notcupid.com'}});
  const html=module.renderEmail({headline:'Test',bodyHtml:'<p>Preview only</p>',recipientId:'test-id'});
  assert.ok(html.includes('Your matching and push notification settings stay unchanged.'));
  assert.ok(!html.includes('pauses your matches'));
});
