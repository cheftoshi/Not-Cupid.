-- Mutual conversations never time out. Keep the legacy RPC argument for rolling
-- deployment compatibility; a BEFORE trigger neutralizes all old timer writers.
alter table public.matches add column chat_last_activity_at timestamptz;
alter table public.matches add column chat_restored_at timestamptz;
alter table public.matches add column chat_restored_by uuid references public.users(id);
update public.matches m set chat_last_activity_at = greatest(
  m.created_at, m.user_1_accepted_at, m.user_2_accepted_at,
  (select max(created_at) from public.messages where match_id=m.id));

create function public.persistent_love_chat() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.user_1_accepted and new.user_2_accepted then
    new.chat_expires_at := null;
    if tg_op='INSERT' then
      new.chat_last_activity_at := coalesce(new.chat_last_activity_at, now());
    elsif not (coalesce(old.user_1_accepted,false) and coalesce(old.user_2_accepted,false)) then
      new.chat_last_activity_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger persistent_love_chat before insert or update on public.matches
for each row execute function public.persistent_love_chat();
update public.matches set chat_expires_at=null
where user_1_accepted and user_2_accepted and ended_at is null;

create function public.touch_love_chat_activity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.matches set chat_last_activity_at=greatest(chat_last_activity_at,new.created_at)
  where id=new.match_id and ended_at is null;
  return new;
end $$;
create trigger touch_love_chat_activity after insert on public.messages
for each row execute function public.touch_love_chat_activity();

-- Same row, same messages, prior mutual consent only. Never delete pair history.
-- Ordered user locks serialize the three-per-30-day quota and capacity with picks.
create function public.restore_love_chat(p_match uuid,p_user uuid) returns text
language plpgsql security invoker set search_path='' as $$
declare m public.matches%rowtype; a public.users%rowtype; b public.users%rowtype;
begin
  if p_user is null or p_match is null then return 'unavailable'; end if;
  select * into m from public.matches where id=p_match for update;
  if not found or p_user not in (m.user_1_id,m.user_2_id) then return 'unavailable'; end if;
  perform id from public.users where id in(m.user_1_id,m.user_2_id) order by id for update;
  select * into a from public.users where id=m.user_1_id;
  select * into b from public.users where id=m.user_2_id;
  if a.deleted_at is not null or b.deleted_at is not null
    or coalesce(a.is_blocked,false) or coalesce(b.is_blocked,false)
    or a.matching_disabled_at is not null or b.matching_disabled_at is not null
    or a.matching_cooldown_until>now() or b.matching_cooldown_until>now()
    or coalesce(a.is_test,false)<>coalesce(b.is_test,false)
    or exists(select 1 from public.user_reports where
      (reporter_id=a.id and reported_id=b.id) or (reporter_id=b.id and reported_id=a.id))
    then return 'unavailable'; end if;
  if exists(select 1 from public.matches x where x.id<>m.id and x.ended_at is null
    and x.status not in('ended','expired','passed')
    and ((x.user_1_id=a.id and x.user_2_id=b.id) or (x.user_1_id=b.id and x.user_2_id=a.id)))
    then return 'unavailable'; end if;
  if m.chat_restored_at is not null then
    if m.ended_at is null then return 'already'; end if;
    return 'unavailable';
  end if;
  if m.ended_at is null or m.ended_reason is distinct from 'expired'
    or m.status not in('ended','expired')
    or not(coalesce(m.user_1_accepted,false) and coalesce(m.user_2_accepted,false))
    then return 'unavailable'; end if;
  if (select count(*) from public.matches where chat_restored_by=p_user
    and chat_restored_at>now()-interval '30 days')>=3 then return 'limit'; end if;
  if exists(select 1 from public.users u where u.id in(a.id,b.id) and
    (select count(*) from public.matches x where x.id<>m.id and x.ended_at is null
      and x.status not in('ended','expired','passed') and u.id in(x.user_1_id,x.user_2_id)
      and ((x.user_1_accepted and x.user_2_accepted) or x.expires_at is null or x.expires_at>=now()))>=10)
    then return 'capacity'; end if;
  update public.matches set status='both_accepted',ended_at=null,ended_reason=null,
    chat_expires_at=null,chat_last_activity_at=now(),chat_restored_at=now(),chat_restored_by=p_user
    where id=m.id;
  perform public.sync_match_rosters(array[a.id,b.id],10);
  return 'restored';
end $$;
revoke all on function public.restore_love_chat(uuid,uuid) from public,anon,authenticated;
grant execute on function public.restore_love_chat(uuid,uuid) to service_role;
revoke all on function public.touch_love_chat_activity() from public,anon,authenticated;
revoke all on function public.persistent_love_chat() from public,anon,authenticated;
create index matches_restore_quota on public.matches(chat_restored_by,chat_restored_at)
where chat_restored_at is not null;
