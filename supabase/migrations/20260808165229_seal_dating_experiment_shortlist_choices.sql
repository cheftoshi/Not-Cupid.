-- Seal every choice in a participant's shortlist as one database transaction.
-- The function is service-role-only; authenticated clients cannot call it.

create or replace function public.submit_dating_experiment_shortlist_choices(
  p_round_id uuid,
  p_user_id uuid,
  p_decisions jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_round_status text;
  v_response_deadline timestamptz;
  v_decision jsonb;
  v_pair_id uuid;
  v_accept boolean;
  v_favorite boolean;
  v_is_a boolean;
  v_a_accepted boolean;
  v_b_accepted boolean;
  v_decision_count integer;
  v_offer_count integer;
  v_favorite_count integer := 0;
  v_updated integer := 0;
begin
  if not exists (
    select 1 from public.users
    where id = p_user_id and is_test is not true
  ) then
    raise exception 'participant is not eligible for a live experiment shortlist';
  end if;

  if jsonb_typeof(p_decisions) is distinct from 'array' then
    raise exception 'decisions must be an array';
  end if;
  v_decision_count := jsonb_array_length(p_decisions);
  if v_decision_count < 1 or v_decision_count > 2 then
    raise exception 'submit one or two shortlist decisions';
  end if;
  if v_decision_count <> (
    select count(distinct decision->>'pairId')
    from jsonb_array_elements(p_decisions) as choices(decision)
  ) then
    raise exception 'shortlist decision ids must be unique';
  end if;

  select status, response_deadline
  into v_round_status, v_response_deadline
  from public.dating_experiment_rounds
  where id = p_round_id
  for update;
  if not found or v_round_status <> 'collecting' or now() >= v_response_deadline then
    raise exception 'shortlist decision window is closed';
  end if;

  select count(*)
  into v_offer_count
  from public.dating_experiment_shortlist_pairs
  where round_id = p_round_id
    and status = 'pending'
    and p_user_id in (user_a_id, user_b_id);
  if v_offer_count <> v_decision_count then
    raise exception 'every shortlist option must receive a decision';
  end if;

  -- Stable lock ordering prevents concurrent submissions from splitting a
  -- participant's choices across two requests.
  for v_decision in
    select decision
    from jsonb_array_elements(p_decisions) as choices(decision)
    order by decision->>'pairId'
  loop
    if jsonb_typeof(v_decision->'accept') is distinct from 'boolean'
      or jsonb_typeof(v_decision->'favorite') is distinct from 'boolean'
    then
      raise exception 'accept and favorite must be booleans';
    end if;

    v_pair_id := (v_decision->>'pairId')::uuid;
    v_accept := (v_decision->>'accept')::boolean;
    v_favorite := (v_decision->>'favorite')::boolean;
    if v_favorite and not v_accept then
      raise exception 'a favorite must also be accepted';
    end if;
    if v_favorite then
      v_favorite_count := v_favorite_count + 1;
      if v_favorite_count > 1 then
        raise exception 'choose at most one favorite';
      end if;
    end if;

    select user_a_id = p_user_id, a_accepted, b_accepted
    into v_is_a, v_a_accepted, v_b_accepted
    from public.dating_experiment_shortlist_pairs
    where id = v_pair_id
      and round_id = p_round_id
      and status = 'pending'
      and p_user_id in (user_a_id, user_b_id)
    for update;
    if not found then
      raise exception 'shortlist option is not active for this participant';
    end if;
    if (v_is_a and v_a_accepted is not null)
      or (not v_is_a and v_b_accepted is not null)
    then
      raise exception 'shortlist choices are already sealed';
    end if;

    if v_is_a then
      update public.dating_experiment_shortlist_pairs
      set a_accepted = v_accept,
          a_favorite = v_favorite,
          a_responded_at = now()
      where id = v_pair_id;
    else
      update public.dating_experiment_shortlist_pairs
      set b_accepted = v_accept,
          b_favorite = v_favorite,
          b_responded_at = now()
      where id = v_pair_id;
    end if;
    v_updated := v_updated + 1;
  end loop;

  return v_updated;
end;
$function$;

revoke all on function public.submit_dating_experiment_shortlist_choices(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_dating_experiment_shortlist_choices(uuid, uuid, jsonb)
  to service_role;

-- Re-run the integrity trigger whenever any pair-to-round identity changes.
drop trigger if exists enforce_live_dating_experiment_pair
  on public.dating_experiment_shortlist_pairs;
create trigger enforce_live_dating_experiment_pair
before insert or update of round_id, event_key, user_a_id, user_b_id
on public.dating_experiment_shortlist_pairs
for each row execute function public.enforce_live_dating_experiment_pair();
