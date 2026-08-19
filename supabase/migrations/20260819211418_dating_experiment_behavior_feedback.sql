-- Privacy-safe behavioral measurement for the Dating Experiment. These tables
-- are service-role-only: shortlist participants never see another person's
-- response or feedback. Feedback is optional, structured, and contains no
-- free-text field.

create table public.dating_experiment_participant_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null references public.dating_experiment_events(event_key) on delete cascade,
  round_id uuid not null references public.dating_experiment_rounds(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'shortlist_viewed', 'choices_submitted', 'feedback_submitted', 'feedback_skipped'
  )),
  created_at timestamptz not null default now(),
  unique (round_id, user_id, event_type)
);

create index dating_experiment_participant_events_event_created_idx
  on public.dating_experiment_participant_events(event_key, created_at desc);

alter table public.dating_experiment_participant_events enable row level security;
revoke all on table public.dating_experiment_participant_events from anon, authenticated;
grant all on table public.dating_experiment_participant_events to service_role;

create table public.dating_experiment_decision_feedback (
  pair_id uuid not null references public.dating_experiment_shortlist_pairs(id) on delete cascade,
  event_key text not null references public.dating_experiment_events(event_key) on delete cascade,
  round_id uuid not null references public.dating_experiment_rounds(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  decision boolean not null,
  reason_code text not null check (reason_code in (
    'values_intent', 'shared_interests', 'profile_story', 'open_to_chemistry',
    'chemistry_fit', 'relationship_intent', 'age_distance', 'profile_detail',
    'timing', 'other'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pair_id, user_id)
);

create index dating_experiment_decision_feedback_event_created_idx
  on public.dating_experiment_decision_feedback(event_key, created_at desc);

alter table public.dating_experiment_decision_feedback enable row level security;
revoke all on table public.dating_experiment_decision_feedback from anon, authenticated;
grant all on table public.dating_experiment_decision_feedback to service_role;

create or replace function public.record_dating_experiment_participant_event(
  p_round_id uuid,
  p_user_id uuid,
  p_event_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_key text;
begin
  if p_event_type not in ('shortlist_viewed', 'choices_submitted', 'feedback_skipped') then
    raise exception 'invalid dating experiment participant event';
  end if;

  select p.event_key into v_event_key
  from public.dating_experiment_shortlist_pairs p
  where p.round_id = p_round_id
    and p_user_id in (p.user_a_id, p.user_b_id)
  limit 1;
  if not found then
    raise exception 'participant does not belong to this shortlist round';
  end if;

  insert into public.dating_experiment_participant_events (
    event_key, round_id, user_id, event_type
  ) values (
    v_event_key, p_round_id, p_user_id, p_event_type
  )
  on conflict (round_id, user_id, event_type) do nothing;

  return true;
end;
$function$;

revoke all on function public.record_dating_experiment_participant_event(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_dating_experiment_participant_event(uuid, uuid, text)
  to service_role;

create or replace function public.record_dating_experiment_decision_feedback(
  p_round_id uuid,
  p_user_id uuid,
  p_feedback jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item jsonb;
  v_pair public.dating_experiment_shortlist_pairs%rowtype;
  v_pair_id uuid;
  v_reason_code text;
  v_decision boolean;
  v_count integer := 0;
  v_event_key text;
begin
  if jsonb_typeof(p_feedback) is distinct from 'array'
    or jsonb_array_length(p_feedback) < 1
    or jsonb_array_length(p_feedback) > 2
  then
    raise exception 'feedback must contain one or two shortlist reasons';
  end if;

  if jsonb_array_length(p_feedback) <> (
    select count(distinct item->>'pairId')
    from jsonb_array_elements(p_feedback) as feedback(item)
  ) then
    raise exception 'feedback pair ids must be unique';
  end if;

  for v_item in
    select item
    from jsonb_array_elements(p_feedback) as feedback(item)
    order by item->>'pairId'
  loop
    v_pair_id := (v_item->>'pairId')::uuid;
    v_reason_code := v_item->>'reasonCode';

    select * into v_pair
    from public.dating_experiment_shortlist_pairs p
    where p.id = v_pair_id
      and p.round_id = p_round_id
      and p_user_id in (p.user_a_id, p.user_b_id)
    for update;
    if not found then
      raise exception 'feedback pair is not part of this participant shortlist';
    end if;

    v_event_key := v_pair.event_key;
    v_decision := case
      when v_pair.user_a_id = p_user_id then v_pair.a_accepted
      else v_pair.b_accepted
    end;
    if v_decision is null then
      raise exception 'feedback is accepted only after a choice is sealed';
    end if;

    if v_decision and v_reason_code not in (
      'values_intent', 'shared_interests', 'profile_story', 'open_to_chemistry'
    ) then
      raise exception 'reason does not match the sealed yes choice';
    end if;
    if not v_decision and v_reason_code not in (
      'chemistry_fit', 'relationship_intent', 'age_distance', 'profile_detail',
      'timing', 'other'
    ) then
      raise exception 'reason does not match the sealed pass choice';
    end if;

    insert into public.dating_experiment_decision_feedback (
      pair_id, event_key, round_id, user_id, decision, reason_code
    ) values (
      v_pair.id, v_pair.event_key, v_pair.round_id, p_user_id, v_decision, v_reason_code
    )
    on conflict (pair_id, user_id) do update
      set reason_code = excluded.reason_code,
          decision = excluded.decision,
          updated_at = now();
    v_count := v_count + 1;
  end loop;

  insert into public.dating_experiment_participant_events (
    event_key, round_id, user_id, event_type
  ) values (
    v_event_key, p_round_id, p_user_id, 'feedback_submitted'
  )
  on conflict (round_id, user_id, event_type) do nothing;

  return v_count;
end;
$function$;

revoke all on function public.record_dating_experiment_decision_feedback(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_dating_experiment_decision_feedback(uuid, uuid, jsonb)
  to service_role;
