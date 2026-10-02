import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Isolated Postgres engine: synthetic data only; no network, provider, or production DB.
test('audit migration: cross-line safety, atomic outbox, and leased cleanup', async () => {
  const db = new PGlite();
  const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002';
  const m='00000000-0000-4000-8000-000000000003';
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table users(id uuid primary key,deleted_at timestamptz,is_blocked boolean,is_test boolean);
      create table matches(id uuid primary key,user_1_id uuid,user_2_id uuid,user_1_accepted boolean default true,
        user_2_accepted boolean default true,status text default 'both_accepted',ended_at timestamptz,ended_reason text,
        chat_expires_at timestamptz,user_1_typing_at timestamptz,user_2_typing_at timestamptz,user_1_read_at timestamptz,user_2_read_at timestamptz);
      create table user_reports(reporter_id uuid,reported_id uuid);
      create table friend_connections(user_a_id uuid,user_b_id uuid,status text,circle_id uuid,match_expires_at timestamptz);
      create table messages(id uuid default gen_random_uuid(),match_id uuid,sender_id uuid);
      create table friend_dms(id uuid default gen_random_uuid(),user_a_id uuid,user_b_id uuid,sender_id uuid);
      create table friend_messages(id uuid default gen_random_uuid(),circle_id uuid,sender_id uuid);
      create table friend_circle_members(circle_id uuid,user_id uuid,left_at timestamptz);
      create table friend_clubs(id uuid,creator_id uuid);
      create table friend_club_members(club_id uuid,user_id uuid,status text);
      create table friend_club_messages(id uuid default gen_random_uuid(),club_id uuid,sender_id uuid);
      create table friend_activities(id uuid,author_id uuid,kind text);
      create table friend_activity_rsvps(activity_id uuid,user_id uuid,response text);
      create table friend_activity_comments(id uuid default gen_random_uuid(),activity_id uuid,user_id uuid);
      create table connection_date_plans(id uuid,host_id uuid,guest_id uuid);
      create table connection_date_messages(id uuid default gen_random_uuid(),plan_id uuid,user_id uuid,kind text default 'message');
      create table notification_jobs(job_type text,recipient_id uuid,actor_id uuid,entity_type text,entity_id text,payload jsonb,dedupe_key text unique);
      insert into users values('${a}',null,false,false),('${b}',null,false,false);
      insert into matches(id,user_1_id,user_2_id) values('${m}','${a}','${b}');
      insert into friend_connections(user_a_id,user_b_id,status) values('${a}','${b}','connected');
    `);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261002121037_audit_safety_delivery_cleanup.sql',import.meta.url),'utf8'));
    // This trigger exists in the prior production migration, whose function is replaced.
    await db.exec('create trigger guard_love_message_end before insert on messages for each row execute function guard_love_message_end()');
    await db.exec(`insert into messages(match_id,sender_id,notify_recipient) values('${m}','${a}',true)`);
    assert.equal((await db.query('select count(*)::int n from notification_jobs')).rows[0].n,1);
    // A failed outbox insertion must roll back the successful-looking message too.
    await db.exec("alter table notification_jobs add constraint simulate_outage check(job_type<>'love_chat_message') not valid");
    await assert.rejects(db.exec(`insert into messages(match_id,sender_id,notify_recipient) values('${m}','${a}',true)`));
    assert.equal((await db.query('select count(*)::int n from messages')).rows[0].n,1);
    await db.exec('alter table notification_jobs drop constraint simulate_outage');
    await db.exec(`
      insert into friend_dms(user_a_id,user_b_id,sender_id) values('${a}','${b}','${a}');
      insert into friend_circle_members values('${m}','${a}',null),('${m}','${b}',null);
      insert into friend_messages(circle_id,sender_id) values('${m}','${a}');
      insert into friend_clubs values('${m}','${a}');
      insert into friend_club_members values('${m}','${b}','member');
      insert into friend_club_messages(club_id,sender_id) values('${m}','${a}');
      insert into friend_activities values('${m}','${a}','event');
      insert into friend_activity_rsvps values('${m}','${b}','yes');
      insert into friend_activity_comments(activity_id,user_id) values('${m}','${a}');
      insert into connection_date_plans values('${m}','${a}','${b}');
      insert into connection_date_messages(plan_id,user_id) values('${m}','${a}');
    `);
    assert.equal((await db.query('select count(*)::int n from notification_jobs')).rows[0].n,6);
    await db.exec(`insert into connection_date_messages(plan_id,user_id,kind) values('${m}','${a}','venue_update')`);
    assert.equal((await db.query('select count(*)::int n from notification_jobs')).rows[0].n,6);
    // Report in either direction closes both lines and suppresses presence.
    await db.exec(`insert into user_reports values('${b}','${a}'); update matches set user_1_typing_at=now() where id='${m}'`);
    assert.equal((await db.query('select status,user_1_typing_at from matches')).rows[0].status,'ended');
    assert.equal((await db.query('select user_1_typing_at from matches')).rows[0].user_1_typing_at,null);
    assert.equal((await db.query('select status from friend_connections')).rows[0].status,'declined');
    await assert.rejects(db.exec(`insert into messages(match_id,sender_id) values('${m}','${a}')`),/unavailable/);
    await assert.rejects(db.exec(`insert into friend_dms(user_a_id,user_b_id,sender_id) values('${a}','${b}','${a}')`),/unavailable/);
    await db.exec(`insert into friend_messages(circle_id,sender_id) values('${m}','${a}')`);
    assert.equal((await db.query('select count(*)::int n from notification_jobs')).rows[0].n,6);
    await db.exec(`update users set deleted_at=now() where id='${a}'`);
    const first=(await db.query('select * from claim_account_cleanup(2)')).rows;
    assert.equal(first.length,1); assert.equal(first[0].attempts,1);
    assert.equal((await db.query('select * from claim_account_cleanup(2)')).rows.length,0);
    await db.exec("update account_cleanup_jobs set lease_until=now()-interval '1 minute'");
    const retry=(await db.query('select * from claim_account_cleanup(2)')).rows[0];
    assert.equal(retry.attempts,2); assert.notEqual(retry.lease_token,first[0].lease_token);
    const privileges=await db.query("select has_table_privilege('anon','account_cleanup_jobs','SELECT') as readable,has_function_privilege('anon','claim_account_cleanup(integer)','EXECUTE') as executable");
    assert.equal(privileges.rows[0].readable,false); assert.equal(privileges.rows[0].executable,false);
    // Reset synthetic state to exercise eligibility independently of a report.
    await db.exec(`delete from user_reports; update users set deleted_at=null;
      update matches set ended_at=null,status='both_accepted';
      update friend_connections set status='connected';`);
    for (const column of ['is_blocked','is_test']) {
      await db.exec(`update users set ${column}=true where id='${b}'`);
      await assert.rejects(db.exec(`insert into messages(match_id,sender_id) values('${m}','${a}')`),/unavailable/);
      await assert.rejects(db.exec(`insert into friend_dms(user_a_id,user_b_id,sender_id) values('${a}','${b}','${a}')`),/unavailable/);
      await db.exec(`update users set ${column}=false where id='${b}'`);
    }
    await db.exec(`update users set deleted_at=now() where id='${b}'`);
    await assert.rejects(db.exec(`insert into messages(match_id,sender_id) values('${m}','${a}')`),/unavailable/);
  } finally { await db.close(); }
});
