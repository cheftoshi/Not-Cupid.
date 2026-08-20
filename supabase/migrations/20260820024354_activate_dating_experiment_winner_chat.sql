-- A mutual Dating Experiment winner is already a bilateral yes. Link that
-- outcome to one normal Love match so the pair can use the existing private,
-- moderated chat instead of being left on a confirmation-only screen.
--
-- The function is idempotent, preserves an existing live conversation, refuses
-- to revive an ended/reported connection, and enforces the Love safety ceiling
-- when it must create a new match.

alter table public.raffle_draws
  add column if not exists love_match_id uuid references public.matches(id) on delete set null;

create unique index if not exists raffle_draws_love_match_id_uidx
  on public.raffle_draws (love_match_id)
  where love_match_id is not null;

create or replace function public.activate_dating_experiment_winner_chat(
  p_draw_id uuid,
  p_chat_expires_at timestamptz,
  p_max_connections integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_draw public.raffle_draws%rowtype;
  v_match public.matches%rowtype;
  v_eligible_users integer;
  v_user_a_live integer;
  v_user_b_live integer;
begin
  if p_draw_id is null or p_chat_expires_at is null
    or p_max_connections is null or p_max_connections < 1 or p_max_connections > 10 then
    raise exception 'invalid Dating Experiment chat activation';
  end if;

  select d.* into v_draw
  from public.raffle_draws d
  where d.id = p_draw_id
  for update;

  if not found then
    raise exception 'Dating Experiment winner was not found';
  end if;
  if v_draw.status <> 'both_accepted'
    or not coalesce(v_draw.a_accepted, false)
    or not coalesce(v_draw.b_accepted, false)
    or v_draw.user_a_id = v_draw.user_b_id then
    raise exception 'Dating Experiment pair is not mutually selected';
  end if;

  perform u.id
  from public.users u
  where u.id in (v_draw.user_a_id, v_draw.user_b_id)
  order by u.id
  for update;

  select count(*) into v_eligible_users
  from public.users u
  where u.id in (v_draw.user_a_id, v_draw.user_b_id)
    and u.deleted_at is null
    and coalesce(u.is_blocked, false) = false
    and coalesce(u.is_test, false) = false;
  if v_eligible_users <> 2 then
    raise exception 'Dating Experiment winner is not eligible for chat';
  end if;

  if v_draw.love_match_id is not null then
    select m.* into v_match
    from public.matches m
    where m.id = v_draw.love_match_id
    for update;
    if not found
      or v_match.ended_at is not null
      or v_match.status in ('ended', 'passed', 'expired')
      or not (
        (v_match.user_1_id = v_draw.user_a_id and v_match.user_2_id = v_draw.user_b_id)
        or (v_match.user_1_id = v_draw.user_b_id and v_match.user_2_id = v_draw.user_a_id)
      ) then
      raise exception 'Linked Dating Experiment chat is no longer available';
    end if;
  else
    -- Prefer an already-live Love connection. This preserves any opener that
    -- either participant sent before the experiment resolved.
    select m.* into v_match
    from public.matches m
    where m.ended_at is null
      and m.status not in ('ended', 'passed', 'expired')
      and (coalesce(m.user_1_accepted, false) and coalesce(m.user_2_accepted, false)
        or m.expires_at is null or m.expires_at >= pg_catalog.clock_timestamp())
      and (
        (m.user_1_id = v_draw.user_a_id and m.user_2_id = v_draw.user_b_id)
        or (m.user_1_id = v_draw.user_b_id and m.user_2_id = v_draw.user_a_id)
      )
    order by m.created_at desc
    limit 1
    for update;

    if not found then
      -- Never recreate a pair after a safety report closed their prior match.
      if exists (
        select 1 from public.matches m
        where m.ended_reason = 'reported'
          and (
            (m.user_1_id = v_draw.user_a_id and m.user_2_id = v_draw.user_b_id)
            or (m.user_1_id = v_draw.user_b_id and m.user_2_id = v_draw.user_a_id)
          )
      ) then
        raise exception 'Dating Experiment pair has a prior safety closure';
      end if;

      select count(*) into v_user_a_live
      from public.matches m
      where m.ended_at is null
        and m.status not in ('ended', 'passed', 'expired')
        and (m.user_1_id = v_draw.user_a_id or m.user_2_id = v_draw.user_a_id)
        and (coalesce(m.user_1_accepted, false) and coalesce(m.user_2_accepted, false)
          or m.expires_at is null or m.expires_at >= pg_catalog.clock_timestamp());
      select count(*) into v_user_b_live
      from public.matches m
      where m.ended_at is null
        and m.status not in ('ended', 'passed', 'expired')
        and (m.user_1_id = v_draw.user_b_id or m.user_2_id = v_draw.user_b_id)
        and (coalesce(m.user_1_accepted, false) and coalesce(m.user_2_accepted, false)
          or m.expires_at is null or m.expires_at >= pg_catalog.clock_timestamp());
      if v_user_a_live >= p_max_connections or v_user_b_live >= p_max_connections then
        raise exception 'Dating Experiment winner reached the Love safety ceiling';
      end if;

      insert into public.matches (
        user_1_id,
        user_2_id,
        compatibility_score,
        status,
        user_1_accepted,
        user_2_accepted,
        user_1_accepted_at,
        user_2_accepted_at,
        expires_at,
        chat_expires_at
      ) values (
        v_draw.user_a_id,
        v_draw.user_b_id,
        greatest(0, least(100, coalesce(v_draw.compatibility_score, 0))),
        'both_accepted',
        true,
        true,
        pg_catalog.clock_timestamp(),
        pg_catalog.clock_timestamp(),
        p_chat_expires_at,
        p_chat_expires_at
      )
      returning * into v_match;
    end if;
  end if;

  update public.matches m
  set status = 'both_accepted',
      user_1_accepted = true,
      user_2_accepted = true,
      user_1_accepted_at = coalesce(m.user_1_accepted_at, pg_catalog.clock_timestamp()),
      user_2_accepted_at = coalesce(m.user_2_accepted_at, pg_catalog.clock_timestamp()),
      chat_expires_at = case
        when m.chat_expires_at is null or m.chat_expires_at < p_chat_expires_at then p_chat_expires_at
        else m.chat_expires_at
      end
  where m.id = v_match.id
  returning * into v_match;

  update public.raffle_draws d
  set love_match_id = v_match.id
  where d.id = v_draw.id;

  update public.users u
  set status = 'matched',
      last_matched_at = coalesce(u.last_matched_at, pg_catalog.clock_timestamp()),
      ignored_picks = 0
  where u.id in (v_draw.user_a_id, v_draw.user_b_id);

  return v_match.id;
end;
$function$;

revoke all on function public.activate_dating_experiment_winner_chat(uuid, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.activate_dating_experiment_winner_chat(uuid, timestamptz, integer)
  to service_role;
