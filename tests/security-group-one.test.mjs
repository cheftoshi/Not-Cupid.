import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs,nextMock} from './helpers/load-ts.mjs';

for(const email of ['a_b@x.com','a%b@x.com']) test(`OTP identity treats ${email} literally`,async()=>{
  const sessions=[];
  const users=[{id:'wrong',email:'a.b@x.com',archetype:'one'},{id:'right',email,archetype:'two'}];
  const db={from(table){
    let selected=users;
    const q={select(){return q},eq(k,v){if(table==='users')selected=selected.filter(u=>u[k]===v);return q},
      ilike(k,v){selected=selected.filter(u=>new RegExp('^'+v.replaceAll('.', '\\.').replaceAll('_','.').replaceAll('%','.*')+'$').test(u[k]));return q},
      is(){return q},gt(){return q},order(){return q},limit(){return q},update(){return q},delete(){return q},
      maybeSingle:async()=>({data:selected[0]}),then(resolve){return Promise.resolve({data:table==='otp_codes'?[{verified:false,expires_at:'2099-01-01'}]:selected}).then(resolve)}};
    return q;
  }};
  const route=await loadTs('app/api/verify-otp/route.ts',{
    'next/server':nextMock,'@/lib/supabase':{supabaseAdmin:db},'@/lib/auth':{createSession:async id=>sessions.push(id)},
    '@/lib/rate-limit':{rateLimit:async()=>({ok:true}),getClientIp:()=> 'test'},'@/lib/otp':{hashOtp:()=> 'hash'},
    'next/headers':{cookies:async()=>({delete(){}})}, '@/lib/signup-proof':{SIGNUP_PROOF_COOKIE:'nc_signup_proof'},
  });
  const response=await route.POST(new Request('http://test',{method:'POST',body:JSON.stringify({email,code:'123456'})}));
  assert.equal(response.status,200);assert.deepEqual(sessions,['right']);
});

for(const routeName of ['send-friend-blast','send-quiz-blast','send-press-invite']) test(`${routeName} cannot send even with force`,async()=>{
  const route=await loadTs(`app/api/admin/${routeName}/route.ts`,{'next/server':nextMock});
  for(const query of ['', '?force=1','?dry=0&force=1']) {
    const response=await route.POST(new Request('http://test/'+query,{method:'POST'}));
    assert.equal(response.status,410);assert.equal((await response.json()).code,'CAMPAIGN_ARCHIVED');
  }
});
