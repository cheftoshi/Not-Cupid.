begin;

alter table public.users add column date_plan_genders text[];
alter table public.users add constraint date_plan_genders_valid check (
  date_plan_genders is null or
  (cardinality(date_plan_genders) between 1 and 3 and date_plan_genders <@ array['m','f','nb']::text[])
);
alter table public.connection_date_requests drop constraint connection_date_requests_status_check;
alter table public.connection_date_requests add constraint connection_date_requests_status_check
  check (status in ('pending','accepted','passed','withdrawn','filled','cancelled'));
alter table public.connection_date_messages add column kind text not null default 'message'
  check (kind in ('message','venue_update'));
create index connection_date_requests_viewer on public.connection_date_requests(user_id,created_at desc);
create index connection_date_requests_pending on public.connection_date_requests(plan_id) where status='pending';

alter table public.notification_jobs drop constraint notification_jobs_entity_type_check;
alter table public.notification_jobs add constraint notification_jobs_entity_type_check
  check (entity_type in ('love_match','friend_dm','friend_circle','friend_club','friend_plan','date_plan'));

-- Explicit plan preferences override Love preferences, without requiring Love onboarding.
create function public.date_viewer_wants(p_user uuid, p_gender text)
returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce(p_gender = any(coalesce(date_plan_genders,
    case when seeking in ('b','both') then array['m','f','nb']::text[]
         when seeking in ('m','f','nb') then array[seeking]::text[]
         else array[]::text[] end)),false)
  from public.users where id=p_user;
$$;
revoke all on function public.date_viewer_wants(uuid,text) from public,anon,authenticated;
grant execute on function public.date_viewer_wants(uuid,text) to service_role;

create function public.guard_date_schedule()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.happens_at is not null and (new.happens_at <= now() or new.happens_at > now()+interval '60 days') then
    raise exception 'Choose a date within the next 60 days';
  end if;
  new.expires_at := least(new.expires_at,now()+interval '14 days',coalesce(new.happens_at,'infinity'::timestamptz));
  return new;
end $$;
create trigger date_schedule_guard before insert or update of happens_at on public.connection_date_plans
  for each row execute function public.guard_date_schedule();

-- Existing open invitations also have a bounded discovery lifetime. Confirmed dates are unchanged.
update public.connection_date_plans set expires_at=least(expires_at,created_at+interval '14 days',coalesce(happens_at,'infinity'::timestamptz))
  where state='open';

-- Queue inside the same transaction as the mutation. No email is sent by this feature.
create function public.queue_date_notice(p_plan uuid,p_recipient uuid,p_actor uuid,p_event text,p_key text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if p_recipient is null or p_recipient=p_actor then return; end if;
  insert into public.notification_jobs(job_type,recipient_id,actor_id,entity_type,entity_id,payload,dedupe_key)
  values('push',p_recipient,p_actor,'date_plan',p_plan::text,
    jsonb_build_object('title',case p_event
      when 'pending' then 'Someone is interested in your date'
      when 'accepted' then 'Your date is confirmed'
      when 'filled' then 'This date invitation has been filled'
      when 'passed' then 'An update on your date request'
      when 'cancelled' then 'This date invitation was cancelled'
      when 'venue_update' then 'Your date meeting place changed' end,
      'body','Open NotCupid to see the update.','url','/hub?date='||p_plan::text,
      'tag','date-plan-'||p_plan::text,'dateEvent',p_event),p_key)
  on conflict(dedupe_key) do nothing;
end $$;
revoke all on function public.queue_date_notice(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.queue_date_notice(uuid,uuid,uuid,text,text) to service_role;

create function public.date_request_transition()
returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.connection_date_plans%rowtype;
begin
  if tg_op='UPDATE' and old.status=new.status then return new; end if;
  select * into p from public.connection_date_plans where id=new.plan_id;
  -- A filled invitation is not a personal rejection. Preserve that distinction.
  if new.status='passed' and p.state='confirmed' then new.status:='filled'; end if;
  if new.status='passed' and p.state='cancelled' then new.status:='cancelled'; end if;
  if new.status='pending' then
    perform public.queue_date_notice(new.plan_id,p.host_id,new.user_id,'pending',
      'date-request:'||new.id::text||':'||gen_random_uuid()::text);
  elsif new.status in ('accepted','passed','filled','cancelled') then
    perform public.queue_date_notice(new.plan_id,new.user_id,p.host_id,new.status,
      'date-outcome:'||new.id::text||':'||new.status);
  end if;
  return new;
end $$;
create trigger date_request_outcome before insert or update of status on public.connection_date_requests
  for each row execute function public.date_request_transition();

-- Keep the already-shipped acceptance/message locks; wrap them with recovery and reciprocal rules.
alter function public.connection_date_action(uuid,uuid,text,uuid,text,uuid) rename to connection_date_action_v1;
create function public.connection_date_action(p_plan uuid,p_user uuid,p_action text,p_request uuid default null,p_body text default null,p_client uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  p public.connection_date_plans%rowtype;
  u public.users%rowtype;
  r public.connection_date_requests%rowtype;
  host_gender text;
  result jsonb;
  changed_count integer;
begin
  select * into p from public.connection_date_plans where id=p_plan for update;
  if not found then raise exception 'plan unavailable'; end if;
  select * into u from public.users where id=p_user and deleted_at is null and is_blocked is not true
    and coalesce(is_test,false)=p.is_test and age>=18;
  if not found then raise exception 'participant unavailable'; end if;
  select gender into host_gender from public.users where id=p.host_id and deleted_at is null
    and is_blocked is not true and coalesce(is_test,false)=p.is_test and age>=18;
  if not found or exists(select 1 from public.user_reports
    where (reporter_id=p_user and reported_id=p.host_id) or (reporter_id=p.host_id and reported_id=p_user)) then
    raise exception 'plan unavailable';
  end if;
  if p_action='request' then
    if p_user=p.host_id or p.state<>'open' or p.expires_at<=now() or p.happens_at<=now()
      or u.gender is null or not(u.gender=any(p.genders))
      or not public.date_viewer_wants(p_user,host_gender) then raise exception 'date not available'; end if;
    select * into r from public.connection_date_requests where plan_id=p_plan and user_id=p_user;
    if found and r.status='pending' then return jsonb_build_object('ok',true,'changed',false); end if;
    if r.id is not null and r.status<>'withdrawn' then raise exception 'request is closed'; end if;
    if (select count(*) from public.connection_date_requests where plan_id=p_plan and status='pending')>=50 then
      raise exception 'date requests full';
    end if;
    if r.id is null then
      insert into public.connection_date_requests(plan_id,user_id) values(p_plan,p_user);
    else
      update public.connection_date_requests set status='pending' where id=r.id;
    end if;
    return jsonb_build_object('ok',true,'changed',true);
  elsif p_action='withdraw' then
    update public.connection_date_requests set status='withdrawn'
      where plan_id=p_plan and user_id=p_user and status='pending';
    get diagnostics changed_count=row_count;
    return jsonb_build_object('ok',true,'changed',changed_count>0);
  elsif p_action='accept' and p.state='open' then
    select * into r from public.connection_date_requests where id=p_request and plan_id=p_plan;
    if not found or not public.date_viewer_wants(r.user_id,host_gender) then raise exception 'preferences changed'; end if;
  end if;
  result:=public.connection_date_action_v1(p_plan,p_user,p_action,p_request,p_body,p_client);
  if p_action='cancel' and (result->>'changed')::boolean and p.guest_id is not null then
    perform public.queue_date_notice(p_plan,case when p_user=p.host_id then p.guest_id else p.host_id end,
      p_user,'cancelled','date-cancel:'||p_plan::text);
  end if;
  return result;
end $$;
revoke all on function public.connection_date_action(uuid,uuid,text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.connection_date_action(uuid,uuid,text,uuid,text,uuid) to service_role;

create function public.set_date_meeting_place(p_plan uuid,p_user uuid,p_area text,p_venue text,p_client uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.connection_date_plans%rowtype; message_id uuid;
begin
  select * into p from public.connection_date_plans where id=p_plan for update;
  if not found or p.host_id<>p_user then raise exception 'not host'; end if;
  if p.state='cancelled' or (p.state='open' and p.expires_at<=now()) then raise exception 'date closed'; end if;
  if exists(select 1 from public.users where id in (p.host_id,p.guest_id) and (deleted_at is not null or is_blocked is true))
    or exists(select 1 from public.user_reports where (reporter_id=p.host_id and reported_id=p.guest_id)
      or (reporter_id=p.guest_id and reported_id=p.host_id)) then raise exception 'date unavailable'; end if;
  if p_client is null or p_area is null or length(trim(p_area)) not between 1 and 100 or length(p_venue)>120 then raise exception 'invalid location'; end if;
  if exists(select 1 from public.connection_date_messages where plan_id=p_plan and user_id=p_user and client_id=p_client)
    or (p.area=p_area and p.venue is not distinct from nullif(trim(p_venue),'')) then
    return jsonb_build_object('ok',true,'changed',false);
  end if;
  update public.connection_date_plans set area=p_area,venue=nullif(trim(p_venue),'') where id=p_plan;
  if p.state='confirmed' then
    insert into public.connection_date_messages(plan_id,user_id,body,client_id,kind)
      values(p_plan,p_user,'Meeting place updated: '||p_area||'. '||coalesce(nullif(trim(p_venue),''),'Decide the venue together.')||' Please confirm the change before travelling.',p_client,'venue_update')
      returning id into message_id;
    perform public.queue_date_notice(p_plan,p.guest_id,p_user,'venue_update','date-venue:'||message_id::text);
  end if;
  return jsonb_build_object('ok',true,'changed',true);
end $$;
revoke all on function public.set_date_meeting_place(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.set_date_meeting_place(uuid,uuid,text,text,uuid) to service_role;
revoke all on function public.guard_date_schedule(),public.date_request_transition() from public,anon,authenticated;
grant execute on function public.guard_date_schedule(),public.date_request_transition() to service_role;

commit;
