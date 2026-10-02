begin;

-- One safety decision applies across both lines. No message history is deleted.
create or replace function public.guard_love_message_end() returns trigger
language plpgsql set search_path='' as $$
declare m public.matches%rowtype;
begin
  select * into m from public.matches where id=new.match_id for update;
  if not found or m.ended_at is not null or m.status in ('ended','passed','expired')
    or new.sender_id not in (m.user_1_id,m.user_2_id)
    or not (coalesce(m.user_1_accepted,false) and coalesce(m.user_2_accepted,false))
    or exists(select 1 from public.user_reports where
      (reporter_id=m.user_1_id and reported_id=m.user_2_id) or
      (reporter_id=m.user_2_id and reported_id=m.user_1_id))
    or not exists(select 1 from public.users a join public.users b on b.id=m.user_2_id
      where a.id=m.user_1_id and a.deleted_at is null and b.deleted_at is null
      and a.is_blocked is not true and b.is_blocked is not true
      and coalesce(a.is_test,false)=coalesce(b.is_test,false)) then
    raise exception 'conversation unavailable';
  end if;
  return new;
end $$;

create function public.disconnect_reported_pair() returns trigger
language plpgsql set search_path='' as $$
begin
  update public.matches set status='ended', ended_at=coalesce(ended_at,now()),
    ended_reason='reported', chat_expires_at=now(),
    user_1_typing_at=null,user_2_typing_at=null,user_1_read_at=null,user_2_read_at=null
  where (user_1_id=new.reporter_id and user_2_id=new.reported_id)
     or (user_2_id=new.reporter_id and user_1_id=new.reported_id);
  update public.friend_connections set status='declined',circle_id=null,match_expires_at=null
  where user_a_id=least(new.reporter_id,new.reported_id)
    and user_b_id=greatest(new.reporter_id,new.reported_id);
  return new;
end $$;
create trigger disconnect_reported_pair after insert on public.user_reports
for each row execute function public.disconnect_reported_pair();

-- Repair historical cross-line reports without reopening or deleting anything.
update public.matches m set status='ended',ended_at=coalesce(m.ended_at,now()),
  ended_reason='reported',chat_expires_at=now(),
  user_1_typing_at=null,user_2_typing_at=null,user_1_read_at=null,user_2_read_at=null
where exists(select 1 from public.user_reports r where
  (r.reporter_id=m.user_1_id and r.reported_id=m.user_2_id) or
  (r.reporter_id=m.user_2_id and r.reported_id=m.user_1_id));
update public.friend_connections c set status='declined',circle_id=null,match_expires_at=null
where c.status<>'declined' and exists(select 1 from public.user_reports r where
  (r.reporter_id=c.user_a_id and r.reported_id=c.user_b_id) or
  (r.reporter_id=c.user_b_id and r.reported_id=c.user_a_id));

create function public.guard_love_presence() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.ended_at is not null or new.status in ('ended','passed','expired')
    or exists(select 1 from public.user_reports where
      (reporter_id=new.user_1_id and reported_id=new.user_2_id) or
      (reporter_id=new.user_2_id and reported_id=new.user_1_id)) then
    new.user_1_typing_at:=null; new.user_2_typing_at:=null;
    new.user_1_read_at:=null; new.user_2_read_at:=null;
  end if;
  return new;
end $$;
create trigger guard_love_presence before update on public.matches
for each row execute function public.guard_love_presence();

create function public.guard_friend_dm_safety() returns trigger
language plpgsql set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'friend-safety:'||least(new.user_a_id,new.user_b_id)::text||':'||greatest(new.user_a_id,new.user_b_id)::text,0));
  if new.sender_id not in (new.user_a_id,new.user_b_id)
    or not exists(select 1 from public.friend_connections where
      user_a_id=new.user_a_id and user_b_id=new.user_b_id and status='connected')
    or exists(select 1 from public.user_reports where
      (reporter_id=new.user_a_id and reported_id=new.user_b_id) or
      (reporter_id=new.user_b_id and reported_id=new.user_a_id))
    or not exists(select 1 from public.users a join public.users b on b.id=new.user_b_id
      where a.id=new.user_a_id and a.deleted_at is null and b.deleted_at is null
      and a.is_blocked is not true and b.is_blocked is not true
      and coalesce(a.is_test,false)=coalesce(b.is_test,false)) then
    raise exception 'conversation unavailable';
  end if;
  return new;
end $$;
create trigger guard_friend_dm_safety before insert on public.friend_dms
for each row execute function public.guard_friend_dm_safety();

-- Durable outbox writes commit with the message, not in a second HTTP request.
-- Existing application upserts use these same keys and are harmless duplicates.
-- Preserve the existing first-mutual-message notification policy: that action
-- already has its acceptance notification, so it must not gain an extra email.
alter table public.messages add column notify_recipient boolean not null default false;
create function public.queue_chat_notification() returns trigger
language plpgsql set search_path='' as $$
declare
  j jsonb:=to_jsonb(new); actor uuid; recipients uuid[]; recipient uuid;
  entity text; entity_id text; prefix text; url text; payload jsonb;
  job_type text:='push'; m public.matches%rowtype; p public.connection_date_plans%rowtype;
  activity public.friend_activities%rowtype;
begin
  actor:=coalesce((j->>'sender_id')::uuid,(j->>'user_id')::uuid);
  if tg_table_name='messages' then
    if not coalesce((j->>'notify_recipient')::boolean,false) then return new; end if;
    select * into m from public.matches where id=(j->>'match_id')::uuid;
    recipients:=array[case when actor=m.user_1_id then m.user_2_id else m.user_1_id end];
    entity:='love_match'; entity_id:=m.id::text; prefix:='love-chat'; job_type:='love_chat_message';
    payload:=jsonb_build_object('messageId',j->>'id');
  elsif tg_table_name='friend_dms' then
    recipients:=array[(j->>'user_a_id')::uuid,(j->>'user_b_id')::uuid];
    entity:='friend_dm'; entity_id:=(j->>'user_a_id')||':'||(j->>'user_b_id');
    prefix:='friend-dm'; url:='/friends?dm='||actor::text;
  elsif tg_table_name='friend_messages' then
    select array_agg(user_id) into recipients from public.friend_circle_members
      where circle_id=(j->>'circle_id')::uuid and left_at is null;
    entity:='friend_circle'; entity_id:=j->>'circle_id'; prefix:='friend-circle'; url:='/friends?view=crew&chat=pack';
  elsif tg_table_name='friend_club_messages' then
    select array_agg(user_id) into recipients from (
      select creator_id as user_id from public.friend_clubs where id=(j->>'club_id')::uuid
      union select user_id from public.friend_club_members where club_id=(j->>'club_id')::uuid and status='member'
    ) members;
    entity:='friend_club'; entity_id:=j->>'club_id'; prefix:='friend-club'; url:='/friends?view=pulse&club='||entity_id;
  elsif tg_table_name='friend_activity_comments' then
    select * into activity from public.friend_activities where id=(j->>'activity_id')::uuid;
    recipients:=array[activity.author_id]; entity:='friend_plan'; entity_id:=activity.id::text;
    if coalesce(activity.kind,'event')='event' then
      select recipients||coalesce(array_agg(user_id),'{}'::uuid[]) into recipients
        from public.friend_activity_rsvps where activity_id=activity.id and response='yes';
      prefix:='friend-plan'; url:='/hub?plan='||entity_id;
    else
      prefix:='friend-comment'; url:='/friends?view=scene&plan='||entity_id;
    end if;
  elsif tg_table_name='connection_date_messages' then
    if j->>'kind'<>'message' then return new; end if;
    select * into p from public.connection_date_plans where id=(j->>'plan_id')::uuid;
    recipients:=array[p.host_id,p.guest_id]; entity:='date_plan'; entity_id:=p.id::text;
    prefix:='date-chat'; url:='/hub?date='||entity_id;
  end if;
  if job_type='push' then
    payload:=jsonb_build_object('title','New message on NotCupid',
      'body','Open your conversation to read it.','url',url,'tag',prefix||'-'||entity_id);
    if entity='date_plan' then payload:=payload||jsonb_build_object('dateEvent','message'); end if;
  end if;
  for recipient in select distinct x from unnest(recipients) x where x<>actor loop
    if exists(select 1 from public.users a join public.users b on b.id=recipient
      where a.id=actor and a.deleted_at is null and b.deleted_at is null
      and a.is_blocked is not true and b.is_blocked is not true
      and a.is_test is not true and b.is_test is not true)
      and not exists(select 1 from public.user_reports where
        (reporter_id=actor and reported_id=recipient) or (reporter_id=recipient and reported_id=actor)) then
      insert into public.notification_jobs(job_type,recipient_id,actor_id,entity_type,entity_id,payload,dedupe_key)
      values(job_type,recipient,actor,entity,entity_id,payload,prefix||':'||(j->>'id')||':'||recipient::text)
      on conflict(dedupe_key) do nothing;
    end if;
  end loop;
  return new;
end $$;
create trigger queue_chat_notification after insert on public.messages for each row execute function public.queue_chat_notification();
create trigger queue_chat_notification after insert on public.friend_dms for each row execute function public.queue_chat_notification();
create trigger queue_chat_notification after insert on public.friend_messages for each row execute function public.queue_chat_notification();
create trigger queue_chat_notification after insert on public.friend_club_messages for each row execute function public.queue_chat_notification();
create trigger queue_chat_notification after insert on public.friend_activity_comments for each row execute function public.queue_chat_notification();
create trigger queue_chat_notification after insert on public.connection_date_messages for each row execute function public.queue_chat_notification();

create table public.account_cleanup_jobs (
  user_id uuid primary key references public.users(id),
  status text not null default 'queued' check(status in ('queued','processing','retry','completed','dead')),
  attempts integer not null default 0,
  billing_done boolean not null default false,
  media_done boolean not null default false,
  available_at timestamptz not null default now(),
  lease_token uuid, lease_until timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.account_cleanup_jobs enable row level security;
revoke all on public.account_cleanup_jobs from public,anon,authenticated;
grant all on public.account_cleanup_jobs to service_role;
create index account_cleanup_pending on public.account_cleanup_jobs(available_at) where status in ('queued','retry','processing');

create function public.queue_account_cleanup() returns trigger language plpgsql set search_path='' as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    insert into public.account_cleanup_jobs(user_id) values(new.id)
    on conflict(user_id) do update set status='queued',attempts=0,billing_done=false,media_done=false,
      available_at=now(),lease_token=null,lease_until=null,last_error_code=null,updated_at=now();
  end if;
  return new;
end $$;
create trigger queue_account_cleanup after update of deleted_at on public.users
for each row execute function public.queue_account_cleanup();

create function public.claim_account_cleanup(p_limit integer default 2)
returns setof public.account_cleanup_jobs language sql set search_path='' as $$
  update public.account_cleanup_jobs j set status='processing',attempts=j.attempts+1,
    lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now()
  where user_id in (select user_id from public.account_cleanup_jobs
    where (status in ('queued','retry') and available_at<=now())
       or (status='processing' and lease_until<now())
    order by available_at for update skip locked limit greatest(1,least(p_limit,5)))
  returning j.*;
$$;
revoke all on function public.claim_account_cleanup(integer) from public,anon,authenticated;
grant execute on function public.claim_account_cleanup(integer) to service_role;
commit;
