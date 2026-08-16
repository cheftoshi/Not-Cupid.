-- Make the Dating Experiment introduction video genuinely optional. Entrants
-- who skip it remain fully eligible and receive no scoring or selection
-- penalty. When a video is provided, its existing privacy and duration rules
-- continue to apply.

alter table public.raffle_entries
  add column if not exists preview_consent_at timestamptz;

alter table public.raffle_entries
  drop constraint if exists dating_experiment_optional_video_pair_check;
alter table public.raffle_entries
  add constraint dating_experiment_optional_video_pair_check
  check (
    event_key <> 'boston-dating-experiment-v1'
    or (
      (video_url is null and video_duration_seconds is null)
      or (
        video_url is not null
        and video_duration_seconds is not null
        and nullif(btrim(video_url), '') is not null
        and video_duration_seconds between 5 and 15
      )
    )
  );

create or replace function public.reserve_dating_experiment_entry(
  p_event_key text,
  p_user_id uuid,
  p_video_url text,
  p_video_duration_seconds numeric,
  p_notify boolean,
  p_terms_version text,
  p_questionnaire jsonb,
  p_accepted_at timestamptz
)
returns table (was_new boolean, active_entry_count integer, spots_left integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.dating_experiment_events%rowtype;
  v_existing_status text;
  v_was_new boolean;
  v_active_count integer;
begin
  if not exists (
    select 1 from public.users where id = p_user_id and is_test is not true
  ) then
    raise exception 'participant is not eligible for a live dating experiment';
  end if;
  if p_accepted_at is null or p_questionnaire is null then
    raise exception 'dating experiment entry is incomplete';
  end if;
  if (p_video_url is null) <> (p_video_duration_seconds is null) then
    raise exception 'dating experiment video reference and duration must be supplied together';
  end if;
  if p_video_url is not null
    and (nullif(btrim(p_video_url), '') is null
      or p_video_duration_seconds < 5
      or p_video_duration_seconds > 15)
  then
    raise exception 'dating experiment video must be between 5 and 15 seconds';
  end if;

  select * into v_event
  from public.dating_experiment_events
  where event_key = p_event_key
  for update;
  if not found
    or v_event.status <> 'entry_open'
    or now() < v_event.entry_opens_at
    or now() >= v_event.entry_closes_at
  then
    raise exception 'dating experiment entries are not open';
  end if;
  if p_terms_version is distinct from v_event.terms_version then
    raise exception 'dating experiment terms version is not current';
  end if;

  select status into v_existing_status
  from public.raffle_entries
  where user_id = p_user_id and event_key = p_event_key
  for update;
  v_was_new := not found or v_existing_status = 'withdrawn';
  if not v_was_new and v_existing_status <> 'entered' then
    raise exception 'dating experiment entry has already been processed';
  end if;

  if v_was_new then
    select count(*) into v_active_count
    from public.raffle_entries
    where event_key = p_event_key and status <> 'withdrawn';
    if v_active_count >= v_event.entry_cap then
      raise exception 'dating experiment entry capacity reached';
    end if;
  end if;

  if v_existing_status is null then
    insert into public.raffle_entries (
      user_id, event_key, video_url, video_duration_seconds, notify, attempts,
      agreed_at, status, terms_version, terms_accepted_at, video_consent_at,
      preview_consent_at, safety_acknowledged_at, attendance_confirmed_at,
      publicity_consent_at, questionnaire, withdrawn_at
    ) values (
      p_user_id, p_event_key, p_video_url, p_video_duration_seconds,
      coalesce(p_notify, true), 0, p_accepted_at, 'entered', p_terms_version,
      p_accepted_at,
      case when p_video_url is not null then p_accepted_at else null end,
      p_accepted_at, p_accepted_at, p_accepted_at, null,
      p_questionnaire, null
    );
  else
    update public.raffle_entries set
      video_url = p_video_url,
      video_duration_seconds = p_video_duration_seconds,
      notify = coalesce(p_notify, true),
      attempts = case when status = 'withdrawn' then 0 else attempts end,
      agreed_at = p_accepted_at,
      status = 'entered',
      terms_version = p_terms_version,
      terms_accepted_at = p_accepted_at,
      video_consent_at = case when p_video_url is not null then p_accepted_at else null end,
      preview_consent_at = p_accepted_at,
      safety_acknowledged_at = p_accepted_at,
      attendance_confirmed_at = p_accepted_at,
      publicity_consent_at = null,
      questionnaire = p_questionnaire,
      withdrawn_at = null
    where user_id = p_user_id and event_key = p_event_key;
  end if;

  select count(*) into v_active_count
  from public.raffle_entries
  where event_key = p_event_key and status <> 'withdrawn';
  return query select v_was_new, v_active_count, greatest(0, v_event.entry_cap - v_active_count);
end;
$function$;

revoke all on function public.reserve_dating_experiment_entry(
  text, uuid, text, numeric, boolean, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.reserve_dating_experiment_entry(
  text, uuid, text, numeric, boolean, text, jsonb, timestamptz
) to service_role;

do $$
begin
  update public.dating_experiment_events
  set terms_version = 'boston-v12-2026-08-15',
      operator_compliance_approved = true,
      operator_compliance_approved_at = now(),
      operator_compliance_reference = 'NotCupid operator approval of optional-video boston-v12-2026-08-15 recorded 2026-08-15',
      updated_at = now()
  where event_key = 'boston-dating-experiment-v1'
    and status = 'entry_open'
    and terms_version = 'boston-v11-2026-08-15';

  if not found then
    raise exception 'Optional-video v12 requires the allowlisted v11 rehearsal event';
  end if;
end
$$;

comment on column public.raffle_entries.preview_consent_at is
  'Consent to share the private shortlist preview; independent of whether an optional video was supplied.';
