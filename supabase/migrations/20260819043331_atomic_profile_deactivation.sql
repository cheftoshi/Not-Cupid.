-- Deactivate the account and every discoverable/notification surface in one
-- transaction. The API must never destroy the browser session and claim
-- success after only part of this state changed.

-- Keep the database enum aligned with every current match-ending path. The
-- legacy constraint omitted `passed`, which could make the old pass endpoint
-- fail even though the application treated it as valid.
alter table public.matches drop constraint if exists matches_ended_reason_check;
alter table public.matches add constraint matches_ended_reason_check
  check (ended_reason in (
    'expired','passed','one_passed','mutual_pass','completed','user_deleted',
    'user_ended','user_blocked','ghosted','not_vibing','user_requiz','reported'
  ));

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
      matching_disabled_at = coalesce(u.matching_disabled_at, v_now)
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

  delete from public.push_subscriptions p where p.user_id = p_user_id;
  delete from public.sessions s where s.user_id = p_user_id;
  return true;
end;
$function$;

revoke all on function public.deactivate_notcupid_account(uuid)
  from public, anon, authenticated;
grant execute on function public.deactivate_notcupid_account(uuid)
  to service_role;

-- Admin safety blocks must retire active connection/experiment state in the
-- same transaction as the block flag. Unblocking never silently re-enrolls a
-- person; they can explicitly reactivate from their account later.
create or replace function public.set_notcupid_account_blocked(
  p_user_id uuid,
  p_blocked boolean
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_user_id is null or p_blocked is null then return false; end if;
  perform u.id from public.users u where u.id = p_user_id for update;
  if not found then return false; end if;

  update public.users u
  set is_blocked = p_blocked,
      pool_active = case when p_blocked then false else u.pool_active end,
      status = case when p_blocked then 'inactive' else u.status end
  where u.id = p_user_id;
  if not p_blocked then return true; end if;

  update public.matches m
  set status = 'ended', ended_at = v_now, ended_reason = 'user_blocked'
  where (m.user_1_id = p_user_id or m.user_2_id = p_user_id)
    and m.ended_at is null;
  update public.friend_connections c
  set status = 'declined', circle_id = null, match_expires_at = null
  where (c.user_a_id = p_user_id or c.user_b_id = p_user_id)
    and c.status <> 'declined';
  update public.friend_circle_members m
  set left_at = coalesce(m.left_at, v_now)
  where m.user_id = p_user_id and m.left_at is null;
  update public.raffle_entries e
  set status = 'withdrawn', withdrawn_at = coalesce(e.withdrawn_at, v_now)
  where e.user_id = p_user_id and e.status in ('entered', 'picked');
  delete from public.push_subscriptions p where p.user_id = p_user_id;
  delete from public.sessions s where s.user_id = p_user_id;
  return true;
end;
$function$;

revoke all on function public.set_notcupid_account_blocked(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_notcupid_account_blocked(uuid, boolean)
  to service_role;

-- Reporting is a single safety transaction: save the report, close the exact
-- caller-owned match, record no-repeat history, and release the reporter.
create or replace function public.report_love_match(
  p_reporter_id uuid,
  p_reported_id uuid,
  p_match_id uuid,
  p_reason text,
  p_detail text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_match public.matches%rowtype;
  v_a uuid;
  v_b uuid;
begin
  if p_reporter_id is null or p_reported_id is null or p_match_id is null
    or p_reporter_id = p_reported_id then return false; end if;
  select m.* into v_match from public.matches m where m.id = p_match_id for update;
  if not found or not (
    (v_match.user_1_id = p_reporter_id and v_match.user_2_id = p_reported_id)
    or (v_match.user_2_id = p_reporter_id and v_match.user_1_id = p_reported_id)
  ) then return false; end if;

  if not exists (
    select 1 from public.user_reports r
    where r.reporter_id = p_reporter_id and r.reported_id = p_reported_id and r.match_id = p_match_id
  ) then
    insert into public.user_reports(reporter_id, reported_id, match_id, reason, detail)
    values (p_reporter_id, p_reported_id, p_match_id, p_reason, p_detail);
  end if;
  update public.matches m
  set status = 'ended', ended_at = coalesce(m.ended_at, pg_catalog.clock_timestamp()), ended_reason = 'reported'
  where m.id = p_match_id;
  v_a := least(p_reporter_id, p_reported_id);
  v_b := greatest(p_reporter_id, p_reported_id);
  insert into public.match_history(user_a_id, user_b_id, match_id, outcome)
  values (v_a, v_b, p_match_id, 'reported')
  on conflict (user_a_id, user_b_id) do update
    set match_id = excluded.match_id, outcome = excluded.outcome;
  update public.users u set status = 'waiting' where u.id = p_reporter_id;
  return true;
end;
$function$;

revoke all on function public.report_love_match(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.report_love_match(uuid, uuid, uuid, text, text)
  to service_role;
