import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';

for (const scenario of ['success','stripe-fails','media-fails','lookup-fails','reactivated','max-retries']) {
  test(`cleanup worker ${scenario} preserves progress and retries safely`, async()=>{
    let saved; const calls=[]; const filters=[];
    const job={user_id:'synthetic',lease_token:'lease',attempts:scenario==='max-retries'?12:1};
    const db={rpc:async()=>({data:[job]}),from(table){return {
      select(){return table==='users'?this:Promise.resolve({data:[{user_id:'synthetic'}]})},
      eq(k,v){filters.push([k,v]);return this;},
      maybeSingle:async()=>scenario==='lookup-fails'?{error:{}}:{data:{deleted_at:scenario==='reactivated'?null:'2026-10-02',friend_sub_id:'sub_test'}},
      update(value){saved=value;return this;},
    }}};
    const worker=await loadTs('lib/account-cleanup.ts',{
      '@/lib/supabase':{supabaseAdmin:db},
      '@/lib/subscription-management':{cancelStripeSubscription:async()=>{calls.push('billing');return !['stripe-fails','max-retries'].includes(scenario);}},
      '@/lib/account-media-cleanup':{removeAccountMedia:async()=>{calls.push('media');if(scenario==='media-fails')throw Error('offline');}},
    });
    await worker.processAccountCleanup();
    assert.equal(saved.status,scenario==='success'?'completed':['reactivated','max-retries'].includes(scenario)?'dead':'retry');
    if(scenario==='stripe-fails')assert.equal(saved.media_done,true);
    if(scenario==='media-fails')assert.equal(saved.billing_done,true);
    if(['lookup-fails','reactivated'].includes(scenario))assert.deepEqual(calls,[]);
    assert.ok(filters.some(([k,v])=>k==='lease_token'&&v==='lease'));
  });
}
