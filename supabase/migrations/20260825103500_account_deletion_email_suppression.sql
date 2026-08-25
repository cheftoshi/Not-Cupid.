-- Account deletion must be both discoverability-safe and communication-safe.
--
-- The previous RPC attempted to set users.status = 'deleted', but the remote
-- users_status_check still allowed only the live states. PostgreSQL therefore
-- rolled the whole transaction back, leaving the account active. Expand the
-- explicit state machine, then make email suppression part of the same locked
-- transaction so no notification sender can treat a deleted account as opted in.

alter table public.users drop constraint if exists users_status_check;
alter table public.users add constraint users_status_check
  check (status in ('waiting', 'matched', 'inactive', 'deleted'));

create or replace function public.deactivate_notcupid_account(p_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_user_id is null then return false; end if;

  perform u.id from public.users u where u.id = p_user_id for update;
  if not found then return false; end if;

  update public.users u
  set deleted_at = coalesce(u.deleted_at, v_now),
      status = 'deleted',
      pool_active = false,
      matching_disabled_at = coalesce(u.matching_disabled_at, v_now),
      email_notifications = false,
      notifications_paused_at = coalesce(u.notifications_paused_at, v_now),
      ai_concierge_consent_revoked_at = case
        when u.ai_concierge_consent_at is not null
          then coalesce(u.ai_concierge_consent_revoked_at, v_now)
        else u.ai_concierge_consent_revoked_at
      end,
      ai_matching_consent_revoked_at = case
        when u.ai_matching_consent_at is not null
          then coalesce(u.ai_matching_consent_revoked_at, v_now)
        else u.ai_matching_consent_revoked_at
      end
  where u.id = p_user_id;

  update public.matches m
  set status = 'ended', ended_at = v_now, ended_reason = 'user_deleted'
  where (m.user_1_id = p_user_id or m.user_2_id = p_user_id)
    and m.ended_at is null;

  update public.friend_connections c
  set status = 'declined', circle_id = null, match_expires_at = null
  where (c.user_a_id = p_user_id or c.user_b_id = p_user_id)
    and c.status <> 'declined';

  update public.friend_circle_members m
  set left_at = coalesce(m.left_at, v_now)
  where m.user_id = p_user_id and m.left_at is null;

  update public.friend_intents i
  set status = 'closed', updated_at = v_now
  where i.user_id = p_user_id and i.status = 'open';

  delete from public.friend_intent_members m where m.user_id = p_user_id;
  delete from public.friend_activity_rsvps r where r.user_id = p_user_id;
  delete from public.friend_club_members m where m.user_id = p_user_id;

  update public.friend_trips t
  set status = 'cancelled', updated_at = v_now
  where t.user_id = p_user_id and t.status = 'active';

  update public.friend_activities a
  set expires_at = v_now
  where a.author_id = p_user_id and (a.expires_at is null or a.expires_at > v_now);

  update public.raffle_entries e
  set status = 'withdrawn', withdrawn_at = coalesce(e.withdrawn_at, v_now)
  where e.user_id = p_user_id and e.status in ('entered', 'picked');

  -- Campaign rows are not workers today, but suppressing a previously claimed
  -- delivery makes the deletion state explicit and protects future workers.
  update public.email_campaign_deliveries d
  set status = 'suppressed', updated_at = v_now
  where d.user_id = p_user_id and d.status in ('queued', 'delayed');

  -- User-approved AI memory and derived embeddings have no retention need once
  -- the account is deleted. Aggregate outcome ledgers remain non-message data.
  delete from public.connection_memories m where m.user_id = p_user_id;
  delete from public.user_connection_embeddings e where e.user_id = p_user_id;

  delete from public.match_notifications n where n.recipient_id = p_user_id;
  delete from public.push_subscriptions p where p.user_id = p_user_id;
  delete from public.sessions s where s.user_id = p_user_id;
  return true;
end;
$function$;

revoke all on function public.deactivate_notcupid_account(uuid)
  from public, anon, authenticated;
grant execute on function public.deactivate_notcupid_account(uuid)
  to service_role;

comment on function public.deactivate_notcupid_account(uuid) is
  'Atomically removes an account from connection surfaces, suppresses all notifications, revokes AI consent, and destroys active sessions.';
