-- Preserve the atomic Love pick behavior while avoiding an unused PL/pgSQL
-- row variable. The paid entitlement row is still locked before match insert.
create or replace function public.create_love_pick(
  p_picker_id uuid,
  p_candidate_id uuid,
  p_compatibility_score integer,
  p_expires_at timestamptz,
  p_max_connections integer,
  p_access_type text,
  p_unlock_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_match_id uuid;
  v_user_count integer;
  v_picker_live integer;
  v_candidate_live integer;
  v_cycle timestamptz;
  v_included_used integer;
  v_pro_until timestamptz;
  v_roster_cycle timestamptz;
begin
  if p_picker_id is null or p_candidate_id is null or p_picker_id = p_candidate_id
    or p_max_connections is null or p_max_connections < 1 or p_max_connections > 10
    or p_access_type not in ('included', 'paid', 'pro') then return null; end if;

  perform u.id from public.users u
    where u.id in (p_picker_id, p_candidate_id) order by u.id for update;
  select count(*) into v_user_count from public.users u
    where u.id in (p_picker_id, p_candidate_id) and u.deleted_at is null;
  if v_user_count <> 2 then return null; end if;

  select u.love_pick_cycle_at, u.roster_refreshed_at, u.friend_pro_until
  into v_cycle, v_roster_cycle, v_pro_until
  from public.users u where u.id = p_picker_id;
  if v_roster_cycle is not null and (v_cycle is null or v_roster_cycle > v_cycle) then
    v_cycle := v_roster_cycle;
  end if;
  if v_cycle is null or v_cycle <= pg_catalog.clock_timestamp() - interval '24 hours' then
    v_cycle := pg_catalog.clock_timestamp();
  end if;
  update public.users set love_pick_cycle_at = v_cycle
    where id = p_picker_id and love_pick_cycle_at is distinct from v_cycle;

  select
    count(*) filter (where m.user_1_id = p_picker_id or m.user_2_id = p_picker_id),
    count(*) filter (where m.user_1_id = p_candidate_id or m.user_2_id = p_candidate_id)
  into v_picker_live, v_candidate_live from public.matches m
  where m.ended_at is null and m.status not in ('ended', 'passed', 'expired')
    and ((coalesce(m.user_1_accepted, false) and coalesce(m.user_2_accepted, false))
      or m.expires_at is null or m.expires_at >= pg_catalog.clock_timestamp())
    and (m.user_1_id in (p_picker_id, p_candidate_id) or m.user_2_id in (p_picker_id, p_candidate_id));
  if v_picker_live >= p_max_connections or v_candidate_live >= p_max_connections then return null; end if;

  if exists (
    select 1 from public.matches m
    where m.ended_at is null and m.status not in ('ended', 'passed', 'expired')
      and ((coalesce(m.user_1_accepted, false) and coalesce(m.user_2_accepted, false))
        or m.expires_at is null or m.expires_at >= pg_catalog.clock_timestamp())
      and ((m.user_1_id = p_picker_id and m.user_2_id = p_candidate_id)
        or (m.user_1_id = p_candidate_id and m.user_2_id = p_picker_id))
  ) then return null; end if;
  if exists (
    select 1 from public.match_history h
    where h.user_a_id = least(p_picker_id, p_candidate_id)
      and h.user_b_id = greatest(p_picker_id, p_candidate_id)
  ) then return null; end if;

  if p_access_type = 'included' then
    select count(*) into v_included_used from public.love_pick_ledger l
    where l.user_id = p_picker_id and l.roster_cycle_at = v_cycle
      and l.access_type = 'included' and l.status <> 'returned';
    if v_included_used >= 3 then return null; end if;
  elsif p_access_type = 'pro' then
    if v_pro_until is null or v_pro_until <= pg_catalog.clock_timestamp() then return null; end if;
  else
    if p_unlock_id is null then return null; end if;
    perform u.id from public.love_connection_unlocks u
    where u.id = p_unlock_id and u.user_id = p_picker_id
      and u.status in ('purchased', 'credit')
      and (u.intended_candidate_id is null or u.intended_candidate_id = p_candidate_id)
    for update;
    if not found then return null; end if;
  end if;

  insert into public.matches (user_1_id, user_2_id, compatibility_score, status, expires_at)
  values (p_picker_id, p_candidate_id, greatest(0, least(100, coalesce(p_compatibility_score, 0))), 'pending', p_expires_at)
  returning id into v_match_id;

  insert into public.love_pick_ledger
    (user_id, candidate_id, roster_cycle_at, access_type, match_id, unlock_id)
  values
    (p_picker_id, p_candidate_id, v_cycle, p_access_type, v_match_id,
      case when p_access_type = 'paid' then p_unlock_id else null end);

  if p_access_type = 'paid' then
    update public.love_connection_unlocks
      set intended_candidate_id = p_candidate_id, status = 'consumed', match_id = v_match_id,
          consumed_at = pg_catalog.clock_timestamp()
      where id = p_unlock_id;
  end if;

  update public.users set status = 'matched', last_matched_at = pg_catalog.clock_timestamp()
    where id in (p_picker_id, p_candidate_id);
  return v_match_id;
end;
$function$;

revoke all on function public.create_love_pick(uuid, uuid, integer, timestamptz, integer, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_love_pick(uuid, uuid, integer, timestamptz, integer, text, uuid)
  to service_role;
