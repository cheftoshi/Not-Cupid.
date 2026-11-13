import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const user='10000000-0000-0000-0000-000000000001',delivery='20000000-0000-0000-0000-000000000001';
test('one-time announcement membership policy does not enroll or require weekly opt-in and preserves actual opt-outs',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create table users(id uuid primary key,email text,is_test boolean default false,is_blocked boolean default false,deleted_at timestamptz,friend_opted_in_at timestamptz,email_notifications boolean default true,notifications_paused_at timestamptz);create table push_subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid);insert into users(id,email,friend_opted_in_at) values('${user}','synthetic@example.test',now());`);
 for(const name of ['20261113162841_friend_event_campaign_foundation.sql','20261113163514_friend_event_delivery_reporting.sql','20261113163859_friend_event_reconcile_acceptance_fix.sql','20261113164351_friend_event_frozen_sender_gate.sql','20261113185150_friend_line_announcement_policy.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 const scalar=async(sql,args=[]) =>(await db.query(sql,args)).rows[0]?.value;
 const hash='a'.repeat(64),campaign='friend_events_announcement_test';
 const claim=()=>scalar('select claim_friend_line_announcement($1,$2,$3,$4,$5) as value',[user,campaign,['admin@example.test'],delivery,hash]);
 await db.query("insert into friend_event_campaigns(id,content_version,expires_at,audience_policy,manifest_hash,recipient_count,approved_at,content_approved_at,send_approved_at,send_enabled) values($1,'v1',now()+interval '1 hour','friend_line_announcement',$2,1,now(),now()-interval '1 minute',now(),true)",[campaign,hash]);
 assert.equal(await claim(),null,'provider permission review is required');
 await db.query("update friend_event_campaigns set provider_permission_reviewed_at=now(),provider_permission_basis='Synthetic test only: reviewed existing product communication scope' where id=$1",[campaign]);
 for(const patch of ['email_notifications=false','notifications_paused_at=now()','is_test=true','is_blocked=true','deleted_at=now()','friend_opted_in_at=null']){
 await db.exec('update users set '+patch);assert.equal(await claim(),null,patch);await db.exec('update users set email_notifications=true,notifications_paused_at=null,is_test=false,is_blocked=false,deleted_at=null,friend_opted_in_at=now()');
 }
 await db.query("insert into friend_event_suppressions(user_id,channel,reason) values($1,'email','complaint')",[user]);assert.equal(await claim(),null);await db.exec('delete from friend_event_suppressions');
 await db.query("select set_friend_event_preference($1,'email',false,'profile')",[user]);assert.equal(await claim(),null,'actual topic opt-out is honored');
 await db.exec('delete from friend_event_preference_audit;delete from friend_event_preferences');
 assert.equal(await scalar('select count(*)::int as value from friend_event_preferences'),0);
 assert.equal(await claim(),delivery,'membership announcement works without weekly enrollment');
 assert.equal(await claim(),null,'duplicate blocked');
 assert.equal(await scalar('select count(*)::int as value from friend_event_preferences'),0,'no preferences were created');
 assert.equal(await scalar("select has_function_privilege('anon','public.claim_friend_line_announcement(uuid,text,text[],uuid,text)','execute') as value"),false);
 }finally{await db.close();}
});
