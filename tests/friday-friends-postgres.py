"""Synthetic PostgreSQL contract/race tests. No production connection support.
Runs only through docker exec into the named existing local staging container;
creates a new isolated database, never modifies the original staging database.
"""
import json, pathlib, subprocess, time, uuid, os
ROOT=pathlib.Path(__file__).resolve().parents[1]
CONTAINER='supabase_db_notcupid-staging'
DB='friday_claim_tests_'+str(int(time.time()))
cmd=['docker','exec','-i',CONTAINER,'psql','-U','postgres','-d',DB,'-v','ON_ERROR_STOP=1','-At']
bind=json.loads(subprocess.check_output(['docker','inspect',CONTAINER,'--format','{{json .HostConfig.PortBindings}}']))
assert bind['5432/tcp']==[{'HostIp':'127.0.0.1','HostPort':'55422'}]
subprocess.run(['docker','exec',CONTAINER,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c','CREATE DATABASE '+DB],check=True,stdout=subprocess.DEVNULL)
def sql(s,ok=True):
 r=subprocess.run(cmd,input=s,text=True,capture_output=True)
 if ok and r.returncode: raise AssertionError(r.stderr)
 return r
sql('''create table users(id uuid primary key,email text,age integer,is_test boolean default false,is_blocked boolean default false,deleted_at timestamptz,friend_opted_in_at timestamptz default now(),email_notifications boolean default true,notifications_paused_at timestamptz,activity_digest_sent_at timestamptz);
create table push_subscriptions(id uuid default gen_random_uuid(),user_id uuid);
create table activity_digest_deliveries(id uuid primary key default gen_random_uuid(),user_id uuid references users(id),created_at timestamptz default now(),status text default 'queued');''')
for name in ['20261113162841_friend_event_campaign_foundation.sql','20261113164351_friend_event_frozen_sender_gate.sql','20261113185150_friend_line_announcement_policy.sql','20261113190613_friend_announcement_drafts.sql','20261114021921_campaign_owner_review.sql','20261126013135_friday_friend_atomic_claim.sql']:
 sql((ROOT/'supabase/migrations'/name).read_text())
checks=[]
def passed(name): checks.append(name)
for stamp,expected in [('2026-11-27 18:59:59+00','f'),('2026-11-27 19:00:00+00','t'),('2026-11-27 19:14:59+00','t'),('2026-11-27 19:15:00+00','f'),('2026-11-28 19:00:00+00','f')]:
 assert sql("select friday_friend_window_open('2026-11-27','"+stamp+"');").stdout.strip()==expected
passed('SQL Eastern Friday boundaries and wrong day')
assert sql("select friday_friend_window_open('2026-07-10','2026-07-10 18:00:00+00');").stdout.strip()=='t'
passed('SQL summer DST boundary')
# Only the isolated test DB replaces the pure clock predicate, after testing its
# real implementation above. This permits positive race tests on any weekday.
sql("create or replace function public.friday_friend_window_open(p_day text,p_now timestamptz) returns boolean language sql immutable as $$select true$$;")
def fixture():
 u,d,o=str(uuid.uuid4()),str(uuid.uuid4()),str(uuid.uuid4());c='friend_events_announcement_race_'+uuid.uuid4().hex[:12];h='a'*64;oh='b'*64
 manifest=json.dumps({'purpose':'friend_discovery_review','cadence':'once-weekly','edition':'weekend','version':'friday-friends-once-weekly-v1-2026-11-26','fridayDay':'2026-11-27','entries':[{'userId':u,'deliveryId':d,'channel':'email'}]})
 owner=json.dumps({'sourceHash':h})
 sql(f"""insert into users(id,email,age) values('{u}','member@example.test',30),('{o}','owner@example.test',30);
 insert into friend_event_preferences(user_id,email_enabled,consent_version) values('{u}',true,'friend-events-v1');
 insert into friend_announcement_drafts(id,manifest_hash,audience_hash,recipient_count,manifest,expires_at) values('{c}','{h}','{h}',1,'{manifest}',now()+interval '1 hour');
 insert into campaign_owner_reviews(source_campaign,user_id,manifest,manifest_hash,expires_at,provider_id,accepted_at) values('{c}','{o}','{owner}','{oh}',now()+interval '1 hour','synthetic-owner-receipt',now()-interval '5 minutes');
 insert into friend_event_campaigns(id,content_version,approved_at,send_enabled,expires_at,manifest_hash,recipient_count,content_approved_at,send_approved_at,provider_permission_reviewed_at,provider_permission_basis,friday_owner_review_hash,friday_owner_test_verified_at)
 values('{c}','friday-friends-once-weekly-v1-2026-11-26',now()-interval '1 minute',true,now()+interval '1 hour','{h}',1,now()-interval '3 minutes',now()-interval '2 minutes',now()-interval '4 minutes','Synthetic local provider permission fixture','{oh}',now()-interval '4 minutes');""")
 return u,c,d

def claim(f):
 u,c,d=f;return f"select claim_friday_friend_delivery('{u}','{c}',array['admin@example.test'],'{d}','{'a'*64}');"
def daily(f): return f"insert into activity_digest_deliveries(user_id) values('{f[0]}');"
def count(f):return int(sql(f"select (select count(*) from friend_event_deliveries where user_id='{f[0]}')+(select count(*) from activity_digest_deliveries where user_id='{f[0]}');").stdout.strip())
f=fixture();assert sql(claim(f)).stdout.strip()==f[2];assert sql(claim(f)).stdout.strip()=='';assert count(f)==1;passed('Exact frozen claim once, duplicate cannot retry')
f=fixture();sql(f"update friend_event_preferences set email_enabled=false where user_id='{f[0]}';");assert sql(claim(f)).stdout.strip()=='';passed('Current opt-out blocks')
f=fixture();sql(f"insert into friend_event_suppressions(user_id,channel,reason) values('{f[0]}','email','complaint');");assert sql(claim(f)).stdout.strip()=='';passed('Current local suppression blocks')
f=fixture();sql(f"update friend_event_campaigns set friday_owner_test_verified_at=null where id='{f[1]}';");assert sql(claim(f)).stdout.strip()=='';passed('Missing exact owner test blocks')
f=fixture();sql('begin;'+claim(f)+'rollback;');assert sql(claim(f)).stdout.strip()==f[2];passed('Rolled-back no-submission claim can retry')
for status in ['claimed','accepted','delivered','failed','suppressed']:
 f=fixture();prior='friend_events_prior_'+uuid.uuid4().hex[:12];sql(f"insert into friend_event_campaigns(id,content_version,expires_at) values('{prior}','prior',now()+interval '1 hour');insert into friend_event_deliveries(campaign_id,user_id,channel,status,claimed_at) values('{prior}','{f[0]}','email','{status}',now()-interval '4 days');")
 assert sql(claim(f)).stdout.strip()==''
passed('All five prior Friend statuses enforce seven days')
for name,first,second in [('Friday then daily',claim,daily),('Daily then Friday',daily,claim),('Two Friday executions',claim,claim)]:
 f=fixture();tag='race_'+uuid.uuid4().hex[:10]
 p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 p.stdin.write(f"set application_name='{tag}';begin;"+first(f)+"select pg_sleep(1.2);commit;");p.stdin.close()
 for _ in range(100):
  if sql(f"select count(*) from pg_stat_activity where application_name='{tag}' and wait_event='PgSleep';").stdout.strip()=='1':break
  time.sleep(.02)
 else:raise AssertionError('First transaction never held lock')
 r=sql(second(f),ok=False);p.wait(timeout=10)
 assert p.returncode==0,(name,p.stderr.read());assert count(f)==1,(name,r.stderr)
 passed(name+' serializes separate connections')
f=fixture();other='friend_events_announcement_other_'+uuid.uuid4().hex[:8]
sql(f"insert into friend_event_campaigns(id,content_version,approved_at,send_enabled,expires_at,manifest_hash,recipient_count,content_approved_at,send_approved_at,audience_policy,provider_permission_reviewed_at,provider_permission_basis) values('{other}','other',now(),true,now()+interval '1 hour','{'c'*64}',1,now()-interval '2 minutes',now()-interval '1 minute','friend_line_announcement',now(),'Synthetic provider permission only');")
p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);p.stdin.write('begin;'+claim(f)+'select pg_sleep(1);commit;');p.stdin.close();time.sleep(.3)
r=sql(f"select claim_friend_line_announcement('{f[0]}','{other}',array['admin@example.test'],'{uuid.uuid4()}','{'c'*64}');");p.wait(timeout=10);assert r.stdout.strip()=='';assert count(f)==1;passed('Concurrent manual announcement shares weekly lock')
assert sql("select has_function_privilege('anon','public.claim_friday_friend_delivery(uuid,text,text[],uuid,text)','execute');").stdout.strip()=='f'
assert sql("select has_function_privilege('service_role','public.claim_friday_friend_delivery(uuid,text,text[],uuid,text)','execute');").stdout.strip()=='t'
passed('Service-only claim privileges')
result={'database':DB,'checks':len(checks),'passed':checks,'failures':0,'isolation':'Existing local loopback PostgreSQL; synthetic example.test fixtures only','clockLimit':'Real SQL clock predicate tested at boundaries; positive races replace only that predicate inside this test database','productionChanges':False}
print(json.dumps(result,indent=2))
