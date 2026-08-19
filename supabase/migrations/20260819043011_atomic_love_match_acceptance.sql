-- Serialize Love acceptance and capacity enforcement in Postgres. The previous
-- read-then-write server path could miss a mutual connection when both people
-- accepted at the same time.

create or replace function public.accept_love_match(
  p_match_id uuid,
  p_user_id uuid,
  p_max_connections integer,
  p_chat_expires_at timestamptz
)
returns table (
  outcome text,
  participant_1_id uuid,
  participant_2_id uuid,
  participant_1_accepted boolean,
  participant_2_accepted boolean
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_match public.matches%rowtype;
  v_other_live integer;
begin
  if p_match_id is null or p_user_id is null
    or p_max_connections is null or p_max_connections < 1 or p_max_connections > 10
    or p_chat_expires_at is null then
    return query select 'not_found'::text, null::uuid, null::uuid, false, false;
    return;
  end if;

  select m.* into v_match
  from public.matches m
  where m.id = p_match_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid, false, false;
    return;
  end if;

  if p_user_id <> v_match.user_1_id and p_user_id <> v_match.user_2_id then
    return query select 'not_party'::text, v_match.user_1_id, v_match.user_2_id,
      coalesce(v_match.user_1_accepted, false), coalesce(v_match.user_2_accepted, false);
    return;
  end if;

  -- Match creation uses the same ordered user locks. This serializes accepts
  -- with new picks and avoids capacity races without deadlocks.
  perform u.id from public.users u
  where u.id in (v_match.user_1_id, v_match.user_2_id)
  order by u.id
  for update;

  if v_match.ended_at is not null or v_match.status in ('ended', 'passed', 'expired') then
    return query select 'ended'::text, v_match.user_1_id, v_match.user_2_id,
      coalesce(v_match.user_1_accepted, false), coalesce(v_match.user_2_accepted, false);
    return;
  end if;

  if not (coalesce(v_match.user_1_accepted, false) and coalesce(v_match.user_2_accepted, false))
    and v_match.expires_at is not null
    and v_match.expires_at < pg_catalog.clock_timestamp() then
    update public.matches m
    set status = 'expired',
        ended_at = pg_catalog.clock_timestamp(),
        ended_reason = 'expired'
    where m.id = p_match_id;
    return query select 'expired'::text, v_match.user_1_id, v_match.user_2_id,
      coalesce(v_match.user_1_accepted, false), coalesce(v_match.user_2_accepted, false);
    return;
  end if;

  if coalesce(v_match.user_1_accepted, false) and coalesce(v_match.user_2_accepted, false) then
    return query select 'already_mutual'::text, v_match.user_1_id, v_match.user_2_id, true, true;
    return;
  end if;

  if (p_user_id = v_match.user_1_id and coalesce(v_match.user_1_accepted, false))
    or (p_user_id = v_match.user_2_id and coalesce(v_match.user_2_accepted, false)) then
    return query select 'already_first'::text, v_match.user_1_id, v_match.user_2_id,
      coalesce(v_match.user_1_accepted, false), coalesce(v_match.user_2_accepted, false);
    return;
  end if;

  select count(*) into v_other_live
  from public.matches m
  where m.id <> p_match_id
    and m.ended_at is null
    and m.status not in ('ended', 'passed', 'expired')
    and (m.user_1_id = p_user_id or m.user_2_id = p_user_id)
    and ((coalesce(m.user_1_accepted, false) and coalesce(m.user_2_accepted, false))
      or m.expires_at is null or m.expires_at >= pg_catalog.clock_timestamp());

  if v_other_live >= p_max_connections then
    return query select 'at_capacity'::text, v_match.user_1_id, v_match.user_2_id,
      coalesce(v_match.user_1_accepted, false), coalesce(v_match.user_2_accepted, false);
    return;
  end if;

  update public.matches m
  set user_1_accepted = case when p_user_id = m.user_1_id then true else m.user_1_accepted end,
      user_2_accepted = case when p_user_id = m.user_2_id then true else m.user_2_accepted end,
      user_1_accepted_at = case
        when p_user_id = m.user_1_id then coalesce(m.user_1_accepted_at, pg_catalog.clock_timestamp())
        else m.user_1_accepted_at end,
      user_2_accepted_at = case
        when p_user_id = m.user_2_id then coalesce(m.user_2_accepted_at, pg_catalog.clock_timestamp())
        else m.user_2_accepted_at end
  where m.id = p_match_id
  returning m.* into v_match;

  update public.users u set ignored_picks = 0 where u.id = p_user_id;

  if coalesce(v_match.user_1_accepted, false) and coalesce(v_match.user_2_accepted, false) then
    update public.matches m
    set status = 'both_accepted', chat_expires_at = p_chat_expires_at
    where m.id = p_match_id
    returning m.* into v_match;
    return query select 'accepted_mutual'::text, v_match.user_1_id, v_match.user_2_id, true, true;
    return;
  end if;

  return query select 'accepted_first'::text, v_match.user_1_id, v_match.user_2_id,
    coalesce(v_match.user_1_accepted, false), coalesce(v_match.user_2_accepted, false);
end;
$function$;

revoke all on function public.accept_love_match(uuid, uuid, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.accept_love_match(uuid, uuid, integer, timestamptz)
  to service_role;
