-- Love Line capacity: up to three live/pending connections plus five roster
-- options. Claims lock both users so concurrent requests cannot overfill either
-- side, and the same pair can never receive two live match rows.

create or replace function public.create_capacity_pending_match(
  p_picker_id uuid,
  p_candidate_id uuid,
  p_compatibility_score integer,
  p_expires_at timestamptz,
  p_max_connections integer
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
begin
  if p_picker_id is null
    or p_candidate_id is null
    or p_picker_id = p_candidate_id
    or p_max_connections is null
    or p_max_connections < 1
    or p_max_connections > 10
  then
    return null;
  end if;

  -- Consistent ordering prevents deadlocks when users pick concurrently.
  perform u.id
  from public.users u
  where u.id in (p_picker_id, p_candidate_id)
  order by u.id
  for update;

  select count(*) into v_user_count
  from public.users u
  where u.id in (p_picker_id, p_candidate_id)
    and u.deleted_at is null;
  if v_user_count <> 2 then return null; end if;

  select
    count(*) filter (where m.user_1_id = p_picker_id or m.user_2_id = p_picker_id),
    count(*) filter (where m.user_1_id = p_candidate_id or m.user_2_id = p_candidate_id)
  into v_picker_live, v_candidate_live
  from public.matches m
  where m.ended_at is null
    and m.status not in ('ended', 'passed', 'expired')
    and (
      (coalesce(m.user_1_accepted, false) and coalesce(m.user_2_accepted, false))
      or m.expires_at is null
      or m.expires_at >= pg_catalog.clock_timestamp()
    )
    and (
      m.user_1_id in (p_picker_id, p_candidate_id)
      or m.user_2_id in (p_picker_id, p_candidate_id)
    );

  if v_picker_live >= p_max_connections or v_candidate_live >= p_max_connections then
    return null;
  end if;

  if exists (
    select 1
    from public.matches m
    where m.ended_at is null
      and m.status not in ('ended', 'passed', 'expired')
      and (
        (coalesce(m.user_1_accepted, false) and coalesce(m.user_2_accepted, false))
        or m.expires_at is null
        or m.expires_at >= pg_catalog.clock_timestamp()
      )
      and (
        (m.user_1_id = p_picker_id and m.user_2_id = p_candidate_id)
        or (m.user_1_id = p_candidate_id and m.user_2_id = p_picker_id)
      )
  ) then
    return null;
  end if;

  if exists (
    select 1 from public.match_history h
    where h.user_a_id = least(p_picker_id, p_candidate_id)
      and h.user_b_id = greatest(p_picker_id, p_candidate_id)
  ) then
    return null;
  end if;

  insert into public.matches (
    user_1_id, user_2_id, compatibility_score, status, expires_at
  ) values (
    p_picker_id,
    p_candidate_id,
    greatest(0, least(100, coalesce(p_compatibility_score, 0))),
    'pending',
    p_expires_at
  )
  returning id into v_match_id;

  update public.users
  set status = 'matched', last_matched_at = pg_catalog.clock_timestamp()
  where id in (p_picker_id, p_candidate_id);

  return v_match_id;
end;
$function$;

-- Remove the new pair from each other's own roster. A participant is removed
-- from all other rosters only after their third live slot has been filled.
create or replace function public.sync_match_rosters(
  p_user_ids uuid[],
  p_max_connections integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_ids_text text[];
  v_saturated_ids text[];
  v_rows integer;
begin
  if p_user_ids is null
    or cardinality(p_user_ids) = 0
    or cardinality(p_user_ids) > 10
    or p_max_connections is null
    or p_max_connections < 1
    or p_max_connections > 10
  then
    return 0;
  end if;

  select coalesce(array_agg(distinct participant_id::text), '{}'::text[])
  into v_user_ids_text
  from unnest(p_user_ids) as participants(participant_id);

  select coalesce(array_agg(participant_id::text), '{}'::text[])
  into v_saturated_ids
  from unnest(p_user_ids) as participants(participant_id)
  where (
    select count(*)
    from public.matches m
    where m.ended_at is null
      and m.status not in ('ended', 'passed', 'expired')
      and (
        (coalesce(m.user_1_accepted, false) and coalesce(m.user_2_accepted, false))
        or m.expires_at is null
        or m.expires_at >= pg_catalog.clock_timestamp()
      )
      and (m.user_1_id = participant_id or m.user_2_id = participant_id)
  ) >= p_max_connections;

  update public.users u
  set roster_snapshot = array(
        select candidate_id
        from unnest(coalesce(u.roster_snapshot, '{}'::text[])) as roster(candidate_id)
        where not (
          (u.id = any(p_user_ids) and candidate_id = any(v_user_ids_text))
          or candidate_id = any(v_saturated_ids)
        )
      ),
      roster_refreshed_at = null
  where u.id = any(p_user_ids)
     or coalesce(u.roster_snapshot, '{}'::text[]) && v_saturated_ids;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

revoke all on function public.create_capacity_pending_match(uuid, uuid, integer, timestamptz, integer)
  from public, anon, authenticated;
revoke all on function public.sync_match_rosters(uuid[], integer)
  from public, anon, authenticated;
grant execute on function public.create_capacity_pending_match(uuid, uuid, integer, timestamptz, integer)
  to service_role;
grant execute on function public.sync_match_rosters(uuid[], integer)
  to service_role;
