-- Discovery never overwrites the member's home ZIP or existing connections.
alter table public.users add column if not exists discovery_metro text;

-- Only repair locations supported by the plan's own named area. A host may
-- have moved since posting; their current ZIP is not historical venue evidence.
update public.friend_activities set metro = 'nyc'
where metro in ('northjersey', 'longisland') and area in ('Staten Island', 'Rockaways');
update public.connection_date_plans set metro = 'nyc'
where metro in ('northjersey', 'longisland') and area in ('Staten Island', 'Rockaways');
update public.friend_trips set destination_metro = 'nyc'
where destination_metro in ('northjersey', 'longisland') and destination_area in ('Staten Island', 'Rockaways');

-- Explicit, private, optional follow-through. No inferred attendance or sends.
create table public.plan_outcome_feedback (
  user_id uuid not null references public.users(id) on delete cascade,
  plan_id uuid not null,
  plan_kind text not null check (plan_kind in ('friend','date')),
  met boolean not null,
  meet_again boolean,
  metro text,
  updated_at timestamptz not null default now(),
  primary key (user_id, plan_id, plan_kind)
);
alter table public.plan_outcome_feedback enable row level security;
revoke all on public.plan_outcome_feedback from public, anon, authenticated;
grant all on public.plan_outcome_feedback to service_role;
create index plan_outcome_feedback_metro on public.plan_outcome_feedback(metro,updated_at);

-- Counts describe the last 30 days, not funnel conversion: joins can belong to
-- older plans, and feedback is optional/self-reported. No message bodies leave SQL.
create function public.city_connection_health()
returns table (metro text, plans_created bigint, hosting_users bigint, joined_users bigint,
  requested_users bigint, confirmed_dates bigint, conversations_started bigint,
  reciprocal_conversations bigint, self_reported_meetups bigint, repeat_participants bigint, home_viewers bigint)
language sql stable security invoker set search_path = '' as $$
with real_users as (
  select id from public.users where deleted_at is null and is_test is not true and is_blocked is not true
), plans as (
  select a.id, a.metro, a.author_id as host, a.created_at, 'friend' as kind
  from public.friend_activities a join real_users u on u.id=a.author_id
  where a.is_test is not true and a.kind='event'
  union all
  select p.id,p.metro,p.host_id,p.created_at,'date'
  from public.connection_date_plans p join real_users u on u.id=p.host_id where p.is_test is not true
), actions as (
  select p.metro, r.user_id, r.activity_id as plan_id, 'joined' as kind
  from public.friend_activity_rsvps r join plans p on p.id=r.activity_id and p.kind='friend'
  join real_users u on u.id=r.user_id
  where r.response='yes' and r.user_id<>p.host and r.created_at>=now()-interval '30 days'
  union all
  select p.metro,r.user_id,r.plan_id,'requested'
  from public.connection_date_requests r join plans p on p.id=r.plan_id and p.kind='date'
  join real_users u on u.id=r.user_id where r.created_at>=now()-interval '30 days'
), messages as (
  select p.metro,p.id,m.user_id from public.friend_activity_comments m
  join plans p on p.id=m.activity_id and p.kind='friend' join real_users u on u.id=m.user_id
  where m.created_at>=now()-interval '30 days'
  union all
  select p.metro,p.id,m.user_id from public.connection_date_messages m
  join plans p on p.id=m.plan_id and p.kind='date' join real_users u on u.id=m.user_id
  where m.created_at>=now()-interval '30 days' and m.kind='message'
), chats as (
  select metro,id,count(distinct user_id) as senders from messages group by metro,id
), metros as (
  select distinct metro from plans where metro is not null
  union select distinct e.metadata->>'metro' from public.app_client_events e join real_users u on u.id=e.user_id
    where e.event_name='connection_home_open' and e.created_at>=now()-interval '30 days' and e.metadata->>'metro' is not null
)
select m.metro,
  (select count(*) from plans p where p.metro=m.metro and p.created_at>=now()-interval '30 days'),
  (select count(distinct host) from plans p where p.metro=m.metro and p.created_at>=now()-interval '30 days'),
  (select count(distinct user_id) from actions a where a.metro=m.metro and a.kind='joined'),
  (select count(distinct user_id) from actions a where a.metro=m.metro and a.kind='requested'),
  (select count(*) from public.connection_date_plans d join plans p on p.id=d.id and p.kind='date'
    join real_users u on u.id=d.guest_id where p.metro=m.metro and d.state='confirmed' and d.created_at>=now()-interval '30 days'),
  (select count(*) from chats c where c.metro=m.metro),
  (select count(*) from chats c where c.metro=m.metro and c.senders>=2),
  (select count(*) from public.plan_outcome_feedback f join real_users u on u.id=f.user_id
    where f.metro=m.metro and f.met and f.updated_at>=now()-interval '30 days'),
  (select count(*) from (select a.user_id from actions a where a.metro=m.metro
    group by a.user_id having count(distinct plan_id)>=2) r),
  (select count(distinct e.user_id) from public.app_client_events e join real_users u on u.id=e.user_id
    where e.event_name='connection_home_open' and e.metadata->>'metro'=m.metro and e.created_at>=now()-interval '30 days')
from metros m;
$$;
revoke all on function public.city_connection_health() from public,anon,authenticated;
grant execute on function public.city_connection_health() to service_role;

create function public.clear_deleted_plan_feedback() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    delete from public.plan_outcome_feedback where user_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.clear_deleted_plan_feedback() from public,anon,authenticated;
create trigger clear_deleted_plan_feedback after update of deleted_at on public.users
for each row execute function public.clear_deleted_plan_feedback();
