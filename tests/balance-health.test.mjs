import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
import {fetchAllSupabaseRows} from '../lib/supabase-pagination.ts';
import {maxOverrep, BALANCE_MIN_POOL, MAX_BALANCE_HOLD_DAYS} from '../lib/pools.ts';

async function balance(rows, beforeWrite=()=>{}) {
  const ranges=[];
  const db={from(){
    let filters=[],orders=[],start=0,end=Infinity,patch;
    const q={
      select(){return q;},
      eq(k,v){filters.push(r=>r[k]===v);return q;},
      is(k,v){filters.push(r=>(r[k]??null)===v);return q;},
      not(k,op,v){assert.equal(op,'is');assert.equal(v,null);filters.push(r=>r[k]!=null);return q;},
      in(k,values){filters.push(r=>values.includes(r[k]));return q;},
      or(expression){
        const clauses=expression.split(',').map(c=>c.match(/^([^.]+)\.([^.]+)\.(.*)$/).slice(1));
        filters.push(r=>clauses.some(([k,op,v])=>op==='is'?r[k]==null:op==='eq'?r[k]===(v==='false'?false:v):r[k]!=null&&r[k]<=v));return q;
      },
      order(k){orders.push(k);return q;},
      range(a,b){start=a;end=b;ranges.push([a,b]);return q;},
      update(v){patch=v;return q;},
      then(resolve,reject){
        if(patch)beforeWrite();
        const selected=rows.filter(r=>filters.every(f=>f(r))).sort((a,b)=>{
          for(const k of orders){const diff=String(a[k]).localeCompare(String(b[k]));if(diff)return diff;}return 0;
        }).slice(start,end+1);
        if(patch)selected.forEach(r=>Object.assign(r,patch));
        return Promise.resolve({data:selected.map(r=>({...r})),error:null}).then(resolve,reject);
      },
    };return q;
  }};
  const module=await loadTs('lib/balance.ts',{
    '@/lib/supabase':{supabaseAdmin:db},'@/lib/quiz-data':{metroOf:zip=>zip==='10001'?'nyc':'boston'},
    '@/lib/pools':{maxOverrep,BALANCE_MIN_POOL,MAX_BALANCE_HOLD_DAYS},
    '@/lib/supabase-pagination':{fetchAllSupabaseRows},
  });
  return {module,ranges};
}
const user=(id,extra={})=>({id:String(id).padStart(5,'0'),gender:'m',zip:'10001',pool_active:true,...extra});

test('city counts paginate beyond 1000 and exclude test, blocked, deleted and penalized accounts',async()=>{
  const rows=Array.from({length:1201},(_,i)=>user(i));
  rows.push(user('test',{is_test:true}),user('blocked',{is_blocked:true}),user('deleted',{deleted_at:'2026-01-01'}),
    user('disabled',{matching_disabled_at:'2026-01-01'}),user('cooldown',{matching_cooldown_until:'2099-01-01'}));
  const {module,ranges}=await balance(rows);
  assert.deepEqual(await module.metroGenderCounts(),{nyc:{m:1201,f:0,other:0}});
  assert.deepEqual(ranges,[[0,499],[500,999],[1000,1499]]);
  assert.equal(module.shouldHoldForBalance({m:1,f:0,other:0},'m'),false);
});

test('release rechecks eligibility at write time and returns only actually released users',async()=>{
  const held={pool_active:false,balance_hold_at:'2026-01-01'};
  const rows=[user(1,held),user(2,held),user(3,{...held,is_test:true}),user(4,{...held,is_blocked:true}),
    user(5,{...held,deleted_at:'2026-01-01'}),user(6,{...held,matching_cooldown_until:'2099-01-01'})];
  const {module}=await balance(rows,()=>{rows[1].is_blocked=true;});
  assert.deepEqual(await module.releaseBalanceHolds(),['00001']);
  assert.equal(rows[0].pool_active,true);
  assert.ok(rows.slice(1).every(r=>r.pool_active===false));
});
