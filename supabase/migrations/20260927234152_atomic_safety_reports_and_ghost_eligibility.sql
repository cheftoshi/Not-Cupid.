begin;
alter table public.matches add column mutual_accepted_at timestamptz;
-- Unknown historical acceptance times must not create immediate penalties.
update public.matches set mutual_accepted_at=now()
where user_1_accepted and user_2_accepted and ended_at is null and status not in ('ended','passed','expired');
create function public.stamp_match_mutual_time() returns trigger language plpgsql set search_path='' as $$
begin
  if new.user_1_accepted and new.user_2_accepted and new.mutual_accepted_at is null then new.mutual_accepted_at:=now(); end if;
  return new;
end $$;
create trigger stamp_match_mutual_time before insert or update of user_1_accepted,user_2_accepted on public.matches
for each row execute function public.stamp_match_mutual_time();

-- Serialize sending with ending: a committed reply must prevent a ghost strike.
create function public.guard_love_message_end() returns trigger language plpgsql set search_path='' as $$
declare m public.matches%rowtype; begin
  select * into m from public.matches where id=new.match_id for update;
  if not found or m.ended_at is not null or m.status in ('ended','passed','expired')
    or new.sender_id not in (m.user_1_id,m.user_2_id)
    or not (coalesce(m.user_1_accepted,false) and coalesce(m.user_2_accepted,false)) then
    raise exception 'conversation unavailable'; end if;
  return new;
end $$;
create trigger guard_love_message_end before insert on public.messages
for each row execute function public.guard_love_message_end();

create function public.end_love_match_safely(p_match uuid,p_user uuid,p_reason text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare m public.matches%rowtype; target uuid; mutual boolean; penalize boolean; begin
  select * into m from public.matches where id=p_match for update;
  if not found or p_user not in (m.user_1_id,m.user_2_id) then return null; end if;
  target:=case when p_user=m.user_1_id then m.user_2_id else m.user_1_id end;
  if not exists(select 1 from public.users a join public.users b on b.id=target where a.id=p_user
    and a.deleted_at is null and a.is_blocked is not true and coalesce(a.is_test,false)=coalesce(b.is_test,false)) then return null; end if;
  mutual:=coalesce(m.user_1_accepted,false) and coalesce(m.user_2_accepted,false);
  if m.ended_at is not null or m.status in ('ended','passed','expired') then
    return jsonb_build_object('changed',false,'was_mutual',mutual); end if;
  if p_reason not in ('ghosted','not_vibing','user_ended') then raise exception 'invalid reason'; end if;
  penalize:=p_reason='ghosted' and mutual and m.mutual_accepted_at<=now()-interval '24 hours'
    and not exists(select 1 from public.messages where match_id=p_match and sender_id=target);
  update public.matches set status='ended',ended_at=now(),ended_reason=p_reason,chat_expires_at=now() where id=p_match;
  insert into public.end_reports(match_id,reporter_id,target_id,reason) values(p_match,p_user,target,p_reason);
  insert into public.match_history(user_a_id,user_b_id,match_id,outcome)
    values(least(m.user_1_id,m.user_2_id),greatest(m.user_1_id,m.user_2_id),p_match,p_reason)
    on conflict(user_a_id,user_b_id) do update set match_id=excluded.match_id,outcome=excluded.outcome;
  perform id from public.users where id in (m.user_1_id,m.user_2_id) order by id for update;
  update public.users set status='waiting' where id in (m.user_1_id,m.user_2_id) and deleted_at is null;
  if penalize then
    update public.users set ghost_strikes=coalesce(ghost_strikes,0)+1,
      ghost_reports_received=coalesce(ghost_reports_received,0)+1,
      matching_disabled_at=case when coalesce(ghost_strikes,0)+1>=3 then now() else matching_disabled_at end,
      matching_cooldown_until=case when coalesce(ghost_strikes,0)+1<3 then now()+interval '7 days' else matching_cooldown_until end
    where id=target and is_test is not true and deleted_at is null;
  end if;
  return jsonb_build_object('changed',true,'was_mutual',mutual);
end $$;
revoke all on function public.end_love_match_safely(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.end_love_match_safely(uuid,uuid,text) to service_role;

create function public.report_friend_context(p_reporter uuid,p_reported uuid,p_kind text,p_context uuid,p_reason text,p_detail text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare a uuid:=least(p_reporter,p_reported); b uuid:=greatest(p_reporter,p_reported); permitted boolean:=false; begin
  if p_reporter=p_reported or p_context is null then return false; end if;
  if not exists(select 1 from public.users u join public.users v on v.id=p_reported
    where u.id=p_reporter and u.deleted_at is null and u.is_blocked is not true
    and coalesce(u.is_test,false)=coalesce(v.is_test,false)) then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('friend-safety:'||a::text||':'||b::text,0));
  if p_kind='dm' then
    permitted:=p_context=p_reported and exists(select 1 from public.friend_connections where user_a_id=a and user_b_id=b);
  elsif p_kind='circle' then
    permitted:=exists(select 1 from public.friend_circle_members where circle_id=p_context and user_id=p_reporter and left_at is null)
      and (exists(select 1 from public.friend_circle_members where circle_id=p_context and user_id=p_reported)
        or exists(select 1 from public.friend_messages where circle_id=p_context and sender_id=p_reported));
  elsif p_kind='club' then
    permitted:=(exists(select 1 from public.friend_clubs where id=p_context and creator_id=p_reporter)
      or exists(select 1 from public.friend_club_members where club_id=p_context and user_id=p_reporter and status='member'))
      and (exists(select 1 from public.friend_clubs where id=p_context and creator_id=p_reported)
        or exists(select 1 from public.friend_club_members where club_id=p_context and user_id=p_reported and status='member')
        or exists(select 1 from public.friend_club_messages where club_id=p_context and sender_id=p_reported));
  elsif p_kind='plan' then
    permitted:=(exists(select 1 from public.friend_activities where id=p_context and author_id=p_reporter)
      or exists(select 1 from public.friend_activity_rsvps where activity_id=p_context and user_id=p_reporter and response='yes'))
      and (exists(select 1 from public.friend_activities where id=p_context and author_id=p_reported)
        or exists(select 1 from public.friend_activity_rsvps where activity_id=p_context and user_id=p_reported and response='yes')
        or exists(select 1 from public.friend_activity_comments where activity_id=p_context and user_id=p_reported));
  end if;
  if not permitted then return false; end if;
  if p_reason not in ('harassment','inappropriate_messages','fake_profile','offensive_photos','made_me_uncomfortable','other') then raise exception 'invalid reason'; end if;
  insert into public.user_reports(reporter_id,reported_id,reason,detail)
    select p_reporter,p_reported,p_reason,left(coalesce(p_detail,''),2000)
    where not exists(select 1 from public.user_reports where reporter_id=p_reporter and reported_id=p_reported);
  update public.friend_connections set status='declined',circle_id=null,match_expires_at=null where user_a_id=a and user_b_id=b;
  insert into public.friend_match_history(user_a_id,user_b_id,outcome) values(a,b,'reported')
    on conflict(user_a_id,user_b_id) do update set outcome='reported';
  return true;
end $$;
revoke all on function public.report_friend_context(uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.report_friend_context(uuid,uuid,text,uuid,text,text) to service_role;

-- Enforce safety at write time too: a report racing a lazy assignment wins.
create function public.guard_friend_safety() returns trigger language plpgsql set search_path='' as $$
declare a uuid:=least(new.user_a_id,new.user_b_id); b uuid:=greatest(new.user_a_id,new.user_b_id); begin
  if new.status='declined' then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('friend-safety:'||a::text||':'||b::text,0));
  if exists(select 1 from public.user_reports where (reporter_id=a and reported_id=b) or (reporter_id=b and reported_id=a))
    or exists(select 1 from public.friend_connections where user_a_id=a and user_b_id=b and status='declined')
    or exists(select 1 from public.users where id in (a,b) and (is_blocked is true or deleted_at is not null))
    or exists(select 1 from public.friend_match_history where user_a_id=a and user_b_id=b and outcome in ('declined','reported')) then
      raise exception 'friend connection unavailable'; end if;
  return new;
end $$;
create trigger guard_friend_safety before insert or update of status on public.friend_connections
for each row execute function public.guard_friend_safety();
commit;
