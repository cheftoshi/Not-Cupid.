"""Local-only synthetic migration lock/backfill/old-app compatibility regression.
Uses the same loopback-only Docker bootstrap as friday-friends-postgres.py.
No production connection or credentials are accepted.
"""
import pathlib,subprocess,time,json,uuid,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
source=ROOT/'tests/friday-friends-postgres.py'
prefix=source.read_text().split('checks=[]')[0].replace(",'20261126013135_friday_friend_atomic_claim.sql'",'')
ns={'__file__':str(source)};exec(prefix,ns)
sql,cmd,DB=ns['sql'],ns['cmd'],ns['DB'];migration=(ROOT/'supabase/migrations/20261126013135_friday_friend_atomic_claim.sql').read_text()
checks=[]
# Existing rows model legacy campaigns, not Friday activations.
sql("insert into friend_event_campaigns(id,content_version,expires_at) select 'friend_events_legacy_'||n,'legacy-v1',now()+interval '1 day' from generate_series(1,50000) n;")
def snapshot():
 return sql("select json_build_object('count',count(*),'oldColumnHash',md5(string_agg(id||content_version||expires_at::text,',' order by id)),'heapFile',pg_relation_filenode('friend_event_campaigns'::regclass)) from friend_event_campaigns;").stdout.strip()
before=json.loads(snapshot())
def hold(query,tag,seconds=1.2):
 p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);p.stdin.write(f"set application_name='{tag}';begin;"+query+f"select pg_sleep({seconds});commit;");p.stdin.close()
 for _ in range(100):
  if sql(f"select count(*) from pg_stat_activity where application_name='{tag}' and wait_event='PgSleep';").stdout.strip()=='1':return p
  time.sleep(.02)
 raise AssertionError('Fixture never held transaction')
baseline_user=str(uuid.uuid4())
sql(f"insert into users(id,email,age) values('{baseline_user}','baseline@example.test',30);")
held=hold(f"select id from users where id='{baseline_user}' for no key update;",'friday_preflight_baseline')
baseline=sql(f"begin;set local lock_timeout='200ms';insert into activity_digest_deliveries(user_id) values('{baseline_user}');commit;",ok=False);held.wait(timeout=10)
assert baseline.returncode==0,baseline.stderr
checks.append('Before migration, a non-key user-row update does not block ordinary daily insert')
p=hold("select id from friend_event_campaigns limit 1 for share;",'friday_preflight_blocker',3)
t=time.monotonic();blocked=sql("begin;"+migration+'commit;',ok=False);blocked_seconds=time.monotonic()-t;p.wait(timeout=10)
assert 1.8 < blocked_seconds < 3
assert blocked.returncode and 'lock timeout' in blocked.stderr,blocked.stderr
assert sql("select count(*) from information_schema.columns where table_name='friend_event_campaigns' and column_name='friday_owner_review_hash';").stdout.strip()=='0'
assert sql("select count(*) from pg_proc where proname='claim_friday_friend_delivery';").stdout.strip()=='0'
checks.append('Built-in two-second migration lock timeout aborts blocked DDL; all changes roll back')
# Exercise the migration's own statement deadline, not a test-supplied limit.
t=time.monotonic();timed=sql('begin;'+migration+'select pg_sleep(16);commit;',ok=False)
assert timed.returncode and 'statement timeout' in timed.stderr,timed.stderr
assert 14 < time.monotonic()-t < 17
assert sql("select count(*) from information_schema.columns where table_name='friend_event_campaigns' and column_name='friday_owner_review_hash';").stdout.strip()=='0'
checks.append('Built-in fifteen-second statement timeout rolls back all migration DDL')
# Observe relation locks before commit, then compare heap identity and row content.
p=hold(migration,'friday_preflight_apply')
locks=sql("select json_agg(json_build_object('table',c.relname,'mode',l.mode)) from pg_locks l join pg_class c on c.oid=l.relation join pg_stat_activity a on a.pid=l.pid where a.application_name='friday_preflight_apply' and l.granted and c.relname in ('friend_event_campaigns','friend_event_deliveries','activity_digest_deliveries');").stdout.strip();p.wait(timeout=10);assert p.returncode==0,p.stderr.read()
after=json.loads(snapshot());assert before==after,(before,after)
assert sql("select count(*) from friend_event_campaigns where friday_owner_review_hash is not null or friday_owner_test_verified_at is not null;").stdout.strip()=='0'
checks.append('50,000 existing campaign rows unchanged; heap file unchanged; new columns all NULL')
checks.append('No campaign backfill, approval activation or schedule created')
u=str(uuid.uuid4());c='friend_events_legacy_probe';d=str(uuid.uuid4())
sql(f"insert into users(id,email,age) values('{u}','legacy-probe@example.test',30);insert into friend_event_preferences(user_id,email_enabled,consent_version) values('{u}',true,'friend-events-v1');insert into friend_event_campaigns(id,content_version,approved_at,send_enabled,expires_at,manifest_hash,recipient_count,content_approved_at,send_approved_at) values('{c}','legacy-v1',now(),true,now()+interval '1 hour','{'a'*64}',1,now()-interval '2 minutes',now()-interval '1 minute');")
assert sql(f"select claim_frozen_friend_event_delivery('{u}','{c}','email',array['admin@example.test'],'{d}','{'a'*64}');").stdout.strip()==d
sql(f"insert into activity_digest_deliveries(user_id) values('{u}');")
checks.append('Old weekly sender claim and ordinary daily insert still work with migration landed first')
# Disabled daily trigger must leave ordinary user-row concurrency unchanged.
p=hold(f"select id from users where id='{u}' for no key update;",'friday_preflight_user_lock')
r=sql(f"begin;set local lock_timeout='200ms';insert into activity_digest_deliveries(user_id) values('{u}');commit;",ok=False);p.wait(timeout=10)
assert r.returncode==0,r.stderr
checks.append('After disabled-first migration, non-key user-row update still does not block daily inserts')
# Conservative app rollback leaves additive schema and ledgers intact.
assert sql(f"select count(*) from friend_event_deliveries where id='{d}';").stdout.strip()=='1'
assert sql("select has_function_privilege('anon','public.claim_friday_friend_delivery(uuid,text,text[],uuid,text)','execute');").stdout.strip()=='f'
checks.append('Keeping additive schema during app rollback preserves receipts and service-only access')
result={'baseHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'database':DB,'checks':len(checks),'passed':checks,'blockedMigrationElapsedSeconds':round(blocked_seconds,3),'ddlLocks':json.loads(locks),'before':before,'after':after,'migrationSHA256':hashlib.sha256(migration.encode()).hexdigest(),'productionChanges':False,'zeroLockRisk':False,'limits':['Synthetic size/traffic only; production table size and concurrent transactions not measured','No heap rewrite observed, but CHECK validation/DDL still needs table locks','Run migration in one transaction; built-in lock_timeout 2s and statement_timeout 15s','Daily user-row locking starts only after explicit overlap protection activation; recent/unresolved claims prevent disable']}
print(json.dumps(result,indent=2))
