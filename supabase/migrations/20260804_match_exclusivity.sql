-- One live Love Line connection at a time. The claim RPC locks both user rows
-- before checking capacity, so two simultaneous picks cannot create duplicate
-- pending matches for the same person. The purge RPC removes a claimed person
-- from every other saved roster immediately instead of waiting for TTL refresh.

create or replace function public.create_exclusive_pending_match(
  p_picker_id uuid,
  p_candidate_id uuid,
  p_compatibility_score integer,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_match_id uuid;
  v_user_count integer;
begin
  if p_picker_id is null or p_candidate_id is null or p_picker_id = p_candidate_id then
    return null;
  end if;

  -- Consistent ordering prevents deadlocks when two people pick concurrently.
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
        m.user_1_id in (p_picker_id, p_candidate_id)
        or m.user_2_id in (p_picker_id, p_candidate_id)
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

create or replace function public.purge_roster_candidates(p_candidate_ids text[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_rows integer;
begin
  if p_candidate_ids is null or cardinality(p_candidate_ids) = 0 or cardinality(p_candidate_ids) > 10 then
    return 0;
  end if;

  update public.users u
  set roster_snapshot = case
        when u.id::text = any(p_candidate_ids) then '{}'::text[]
        else array(
          select candidate_id
          from unnest(coalesce(u.roster_snapshot, '{}'::text[])) as exposed(candidate_id)
          where candidate_id <> all(p_candidate_ids)
        )
      end,
      roster_refreshed_at = null
  where u.id::text = any(p_candidate_ids)
     or coalesce(u.roster_snapshot, '{}'::text[]) && p_candidate_ids;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

revoke all on function public.create_exclusive_pending_match(uuid, uuid, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function public.purge_roster_candidates(text[])
  from public, anon, authenticated;
grant execute on function public.create_exclusive_pending_match(uuid, uuid, integer, timestamptz)
  to service_role;
grant execute on function public.purge_roster_candidates(text[])
  to service_role;
