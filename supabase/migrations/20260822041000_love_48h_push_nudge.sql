-- Add one deduplicated, push-only midpoint decision nudge. Application code
-- keeps email at 24 hours and near expiry; this event is only claimed for PWA
-- push delivery and therefore does not increase email volume.

alter table public.love_notification_events
  drop constraint if exists love_notification_events_notification_type_check;
alter table public.love_notification_events
  add constraint love_notification_events_notification_type_check
  check (notification_type in (
    'interest_immediate', 'decision_24h', 'decision_48h', 'decision_final',
    'mutual', 'mutual_no_message_12h', 'expired'
  ));

create or replace function public.claim_love_notification_event(
  p_match_id uuid,
  p_recipient_id uuid,
  p_notification_type text,
  p_channel text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_notification_type not in (
    'interest_immediate', 'decision_24h', 'decision_48h', 'decision_final',
    'mutual', 'mutual_no_message_12h', 'expired'
  ) or p_channel not in ('email', 'push', 'in_app') then
    raise exception 'invalid Love notification event';
  end if;

  if not exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and p_recipient_id in (m.user_1_id, m.user_2_id)
  ) then
    raise exception 'recipient is not a match participant';
  end if;

  insert into public.love_notification_events (
    match_id, recipient_id, notification_type, channel
  ) values (
    p_match_id, p_recipient_id, p_notification_type, p_channel
  )
  on conflict (match_id, recipient_id, notification_type, channel) do update
    set status = 'claimed',
        claimed_at = now(),
        sent_at = null,
        delivered_at = null,
        opened_at = null,
        clicked_at = null,
        failed_at = null,
        last_event_at = now(),
        provider_id = null,
        error_code = null
    where love_notification_events.status = 'failed'
      and love_notification_events.claimed_at < now() - interval '30 minutes'
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.claim_love_notification_event(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_love_notification_event(uuid, uuid, text, text)
  to service_role;
