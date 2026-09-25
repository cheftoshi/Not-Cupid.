begin;

-- Never store a participant-only venue in the legacy public activity payload.
create table public.friend_plan_locations (
  activity_id uuid primary key references public.friend_activities(id) on delete cascade,
  venue text check (length(venue) <= 120),
  visibility text not null check (visibility in ('public', 'participants')),
  updated_at timestamptz not null default now()
);
alter table public.friend_plan_locations enable row level security;
revoke all on public.friend_plan_locations from public, anon, authenticated;
grant select, insert, update, delete on public.friend_plan_locations to service_role;

create function public.set_connection_plan_location(p_activity_id uuid, p_user_id uuid, p_area text, p_venue text, p_visibility text)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_host uuid;
begin
  if p_visibility not in ('public','participants') or p_area is null or length(trim(p_area)) = 0 or length(p_area) > 100 or length(p_venue) > 120 then raise exception 'invalid location'; end if;
  select author_id into v_host from public.friend_activities where id=p_activity_id and kind='event' for update;
  if v_host is distinct from p_user_id or v_host is null then raise exception 'not plan host'; end if;
  if not exists(select 1 from public.users where id=p_user_id and deleted_at is null and is_blocked is not true) then raise exception 'unavailable host'; end if;
  insert into public.friend_plan_locations(activity_id,venue,visibility) values(p_activity_id,nullif(trim(p_venue),''),p_visibility)
    on conflict(activity_id) do update set venue=excluded.venue,visibility=excluded.visibility,updated_at=now();
  update public.friend_activities set area=p_area, location=case when p_visibility='public' then nullif(trim(p_venue),'') else null end where id=p_activity_id;
end $$;
revoke all on function public.set_connection_plan_location(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.set_connection_plan_location(uuid,uuid,text,text,text) to service_role;

-- Explicit set semantics for the new Home; legacy Scene toggle behavior stays intact.
create function public.set_connection_plan_response(p_activity_id uuid, p_user_id uuid, p_response text)
returns table(my_response text, yes_count integer, maybe_count integer, no_count integer, total_count integer)
language plpgsql security invoker set search_path = '' as $$
declare v_activity public.friend_activities%rowtype; v_existing text;
begin
  if p_response is not null and p_response not in ('yes','maybe','no') then raise exception 'invalid RSVP response'; end if;
  select * into v_activity from public.friend_activities where id=p_activity_id for update;
  if not found then raise exception 'activity not found'; end if;
  if not exists(select 1 from public.users where id=p_user_id and deleted_at is null and is_blocked is not true and coalesce(is_test,false)=v_activity.is_test) then raise exception 'unavailable participant'; end if;
  if p_user_id=v_activity.author_id and p_response is distinct from 'yes' then raise exception 'host must cancel plan'; end if;
  select response into v_existing from public.friend_activity_rsvps where activity_id=p_activity_id and user_id=p_user_id;
  if v_existing is distinct from p_response then
    if p_response='yes' and (v_activity.expires_at<=now() or v_activity.happens_at<=now()) then raise exception 'plan ended'; end if;
    if p_response is null then
      delete from public.friend_activity_rsvps where activity_id=p_activity_id and user_id=p_user_id;
    else
      -- Existing RPC obtains the same row lock and enforces capacity atomically.
      perform * from public.set_friend_activity_rsvp(p_activity_id,p_user_id,p_response);
    end if;
  end if;
  return query select p_response,
    count(*) filter(where r.response='yes')::integer,
    count(*) filter(where r.response='maybe')::integer,
    count(*) filter(where r.response='no')::integer,
    count(*)::integer from public.friend_activity_rsvps r where r.activity_id=p_activity_id;
end $$;
revoke all on function public.set_connection_plan_response(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.set_connection_plan_response(uuid,uuid,text) to service_role;
-- Free, member-created dates are distinct from paid Love roster picks and
-- legacy open-join social plans. No old client can expose blind profiles.
create table public.connection_date_plans (
  id uuid primary key,
  host_id uuid not null references public.users(id) on delete cascade,
  title text not null check(length(title) between 1 and 140),
  body text check(length(body)<=1000),
  metro text not null, area text not null,
  venue text check(length(venue)<=120),
  mode text not null check(mode in ('profile','blind')),
  genders text[] not null check(cardinality(genders)>0 and genders <@ array['m','f','nb']::text[]),
  happens_at timestamptz, expires_at timestamptz not null,
  state text not null default 'open' check(state in ('open','confirmed','cancelled')),
  guest_id uuid references public.users(id) on delete cascade,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  check(guest_id is null or guest_id<>host_id),
  check(state<>'confirmed' or guest_id is not null)
);
create index connection_date_discovery on public.connection_date_plans(is_test,metro,state,created_at desc);
create table public.connection_date_requests (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.connection_date_plans(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','passed','withdrawn')),
  created_at timestamptz not null default now(),
  unique(plan_id,user_id)
);
create table public.connection_date_messages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.connection_date_plans(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null check(length(body) between 1 and 1000),
  client_id uuid not null,
  created_at timestamptz not null default now(),
  unique(plan_id,user_id,client_id)
);
create index connection_date_message_history on public.connection_date_messages(plan_id,created_at desc);
alter table public.connection_date_plans enable row level security;
alter table public.connection_date_requests enable row level security;
alter table public.connection_date_messages enable row level security;
revoke all on public.connection_date_plans,public.connection_date_requests,public.connection_date_messages from public,anon,authenticated;
grant select,insert,update,delete on public.connection_date_plans,public.connection_date_requests,public.connection_date_messages to service_role;

create function public.connection_date_action(p_plan uuid,p_user uuid,p_action text,p_request uuid default null,p_body text default null,p_client uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.connection_date_plans%rowtype; u public.users%rowtype; r public.connection_date_requests%rowtype; m public.connection_date_messages%rowtype; v_reported uuid;
begin
  select * into p from public.connection_date_plans where id=p_plan for update;
  if not found then raise exception 'plan unavailable'; end if;
  select * into u from public.users where id=p_user and deleted_at is null and is_blocked is not true and coalesce(is_test,false)=p.is_test and age>=18;
  if not found then raise exception 'participant unavailable'; end if;
  if not exists(select 1 from public.users where id=p.host_id and deleted_at is null and is_blocked is not true and coalesce(is_test,false)=p.is_test and age>=18) then raise exception 'host unavailable'; end if;
  if exists(select 1 from public.user_reports where (reporter_id=p_user and reported_id=p.host_id) or (reporter_id=p.host_id and reported_id=p_user)) then raise exception 'plan unavailable'; end if;
  if p_action='report' then
    if p_user=p.host_id then
      if p_request is not null then
        select user_id into v_reported from public.connection_date_requests where id=p_request and plan_id=p_plan;
      else v_reported:=p.guest_id; end if;
    else v_reported:=p.host_id; end if;
    if v_reported is null or v_reported=p_user or not exists(select 1 from public.users where id=v_reported and coalesce(is_test,false)=p.is_test) then raise exception 'report unavailable'; end if;
    insert into public.user_reports(reporter_id,reported_id,reason,detail) values(p_user,v_reported,'other','Safety report from date invitation '||p_plan::text);
    update public.connection_date_requests set status='passed' where plan_id=p_plan and user_id=v_reported and status='pending';
    if p.guest_id is not null and (p_user=p.guest_id or v_reported=p.guest_id) then update public.connection_date_plans set state='cancelled' where id=p_plan; end if;
  elsif p_action='request' then
    if p_user=p.host_id or p.state<>'open' or p.expires_at<=now() or p.happens_at<=now() or u.gender is null or not(u.gender=any(p.genders)) then raise exception 'date not available'; end if;
    select * into r from public.connection_date_requests where plan_id=p_plan and user_id=p_user;
    if found then return jsonb_build_object('ok',true,'changed',false); end if;
    if (select count(*) from public.connection_date_requests where plan_id=p_plan and status='pending')>=50 then raise exception 'date requests full'; end if;
    insert into public.connection_date_requests(plan_id,user_id) values(p_plan,p_user);
  elsif p_action='withdraw' then
    update public.connection_date_requests set status='withdrawn' where plan_id=p_plan and user_id=p_user and status='pending';
  elsif p_action in ('accept','pass') then
    if p.host_id<>p_user then raise exception 'not host'; end if;
    select * into r from public.connection_date_requests where id=p_request and plan_id=p_plan;
    if not found then raise exception 'request unavailable'; end if;
    if p_action='accept' and p.state='confirmed' and p.guest_id=r.user_id then return jsonb_build_object('ok',true,'changed',false); end if;
    if p.state<>'open' or p.expires_at<=now() or p.happens_at<=now() or r.status<>'pending' then raise exception 'request no longer available'; end if;
    if p_action='accept' then
      if not exists(select 1 from public.users where id=r.user_id and deleted_at is null and is_blocked is not true and coalesce(is_test,false)=p.is_test and age>=18 and gender=any(p.genders)) then raise exception 'guest unavailable'; end if;
      if exists(select 1 from public.user_reports where (reporter_id=p_user and reported_id=r.user_id) or (reporter_id=r.user_id and reported_id=p_user)) then raise exception 'guest unavailable'; end if;
      update public.connection_date_plans set guest_id=r.user_id,state='confirmed' where id=p_plan;
      update public.connection_date_requests set status=case when id=r.id then 'accepted' else 'passed' end where plan_id=p_plan and status='pending';
    else update public.connection_date_requests set status='passed' where id=r.id; end if;
  elsif p_action='cancel' then
    if p_user<>p.host_id and p_user is distinct from p.guest_id then raise exception 'not participant'; end if;
    if p.state='cancelled' then return jsonb_build_object('ok',true,'changed',false); end if;
    update public.connection_date_plans set state='cancelled' where id=p_plan;
    update public.connection_date_requests set status='passed' where plan_id=p_plan and status='pending';
  elsif p_action='message' then
    if p.state<>'confirmed' or (p_user<>p.host_id and p_user is distinct from p.guest_id) then raise exception 'not confirmed participant'; end if;
    if not exists(select 1 from public.users where id=p.guest_id and deleted_at is null and is_blocked is not true and coalesce(is_test,false)=p.is_test) then raise exception 'guest unavailable'; end if;
    if exists(select 1 from public.user_reports where (reporter_id=p.host_id and reported_id=p.guest_id) or (reporter_id=p.guest_id and reported_id=p.host_id)) then raise exception 'conversation unavailable'; end if;
    if p_client is null or p_body is null or length(trim(p_body)) not between 1 and 1000 then raise exception 'invalid message'; end if;
    select * into m from public.connection_date_messages where plan_id=p_plan and user_id=p_user and client_id=p_client;
    if found then return jsonb_build_object('ok',true,'changed',false,'id',m.id,'body',m.body,'created_at',m.created_at); end if;
    insert into public.connection_date_messages(plan_id,user_id,body,client_id) values(p_plan,p_user,trim(p_body),p_client) returning * into m;
    return jsonb_build_object('ok',true,'changed',true,'id',m.id,'body',m.body,'created_at',m.created_at);
  else raise exception 'invalid action'; end if;
  return jsonb_build_object('ok',true,'changed',true);
end $$;
revoke all on function public.connection_date_action(uuid,uuid,text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.connection_date_action(uuid,uuid,text,uuid,text,uuid) to service_role;
commit;
