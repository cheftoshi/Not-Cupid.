// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite module.
// This isolated synthetic database never connects to production.
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
create table users(id uuid primary key,deleted_at timestamptz,is_blocked boolean default false,is_test boolean default false,matching_disabled_at timestamptz,matching_cooldown_until timestamptz);
create table matches(id uuid primary key,user_1_id uuid,user_2_id uuid,user_1_accepted boolean,user_2_accepted boolean,
 user_1_accepted_at timestamptz,user_2_accepted_at timestamptz,created_at timestamptz default now(),
 status text,ended_at timestamptz,ended_reason text,expires_at timestamptz,chat_expires_at timestamptz);
create table messages(id uuid,match_id uuid,created_at timestamptz default now());
create table user_reports(reporter_id uuid,reported_id uuid);
create function sync_match_rosters(uuid[],integer) returns void language sql as 'select';
insert into users(id) select ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,30)i;`);
const uid = i => `00000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
const mid = i => `10000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
const migration = readFileSync(new URL('../supabase/migrations/20260928020257_persistent_love_chats.sql',import.meta.url),'utf8');
await db.exec(migration);
const seed = async (i,a=1,b=i+1) => db.query(`insert into matches(id,user_1_id,user_2_id,user_1_accepted,user_2_accepted,status,ended_at,ended_reason,chat_expires_at)
values($1,$2,$3,true,true,'ended',now(),'expired',now()-interval '1 day')`,[mid(i),uid(a),uid(b)]);
const restore = async (i,u=1) => (await db.query('select restore_love_chat($1,$2) result',[mid(i),uid(u)])).rows[0].result;
await seed(1);
assert.equal(await restore(1,3),'unavailable');
assert.equal(await restore(1),'restored');
assert.equal(await restore(1),'already');
assert.equal((await db.query('select chat_expires_at from matches where id=$1',[mid(1)])).rows[0].chat_expires_at,null);
await db.query("update matches set chat_last_activity_at=now()-interval '11 days',chat_expires_at=now()-interval '1 hour' where id=$1",[mid(1)]);
await db.query('insert into messages(match_id) values($1)',[mid(1)]);
assert.equal((await db.query("select chat_expires_at is null and chat_last_activity_at>now()-interval '1 minute' ok from matches where id=$1",[mid(1)])).rows[0].ok,true);
for(const reason of ['one_passed','not_vibing','user_deleted','user_requiz']) {
  await seed(2); await db.query('update matches set ended_reason=$1 where id=$2',[reason,mid(2)]);
  assert.equal(await restore(2),'unavailable'); await db.query('delete from matches where id=$1',[mid(2)]);
}
await seed(2); await db.query('update matches set user_2_accepted=false where id=$1',[mid(2)]);
assert.equal(await restore(2),'unavailable');
await db.query('update matches set user_2_accepted=true where id=$1',[mid(2)]);
for(const change of ["is_test=true","is_blocked=true","deleted_at=now()"]){
  await db.query(`update users set ${change} where id=$1`,[uid(3)]);
  assert.equal(await restore(2),'unavailable');
  await db.query('update users set is_test=false,is_blocked=false,deleted_at=null where id=$1',[uid(3)]);
}
await db.query('insert into user_reports values($1,$2)',[uid(3),uid(1)]);
assert.equal(await restore(2),'unavailable'); await db.exec('delete from user_reports');
assert.equal(await restore(2),'restored'); await seed(3); assert.equal(await restore(3),'restored');
await seed(4); assert.equal(await restore(4),'limit');
await db.exec("update matches set chat_restored_at=now()-interval '31 days' where chat_restored_at is not null");
assert.equal(await restore(4),'restored');
await seed(5,3,4);
for(let i=6;i<=15;i++){ await seed(i,4,i); await db.query("update matches set ended_at=null,ended_reason=null,status='both_accepted' where id=$1",[mid(i)]); }
assert.equal(await restore(5,3),'capacity');
assert.equal((await db.query("select has_function_privilege('anon','restore_love_chat(uuid,uuid)','execute') allowed")).rows[0].allowed,false);
console.log('PASS: SQL migration executes; timer clearing, message wake, participant/realm/deletion/block/report protections, idempotence, quota/window and capacity.');
await db.close();

