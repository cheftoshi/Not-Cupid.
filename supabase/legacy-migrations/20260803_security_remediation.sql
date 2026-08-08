-- Security remediation: close externally reachable data paths and make
-- abuse controls atomic. Safe to re-run.

begin;

-- Sensitive tables are server-only. RLS without permissive policies is the
-- final barrier if an anon key is used directly against PostgREST.
alter table if exists public.otp_codes enable row level security;
drop policy if exists "allow all on otp_codes" on public.otp_codes;
revoke all on table public.otp_codes from anon, authenticated;
grant all on table public.otp_codes to service_role;

alter table if exists public.unlocks enable row level security;
revoke all on table public.unlocks from anon, authenticated;
grant all on table public.unlocks to service_role;

-- Public buckets already permit direct object URLs. This broad policy also
-- allowed anonymous clients to enumerate every profile-photo object.
drop policy if exists "Anyone can read photos yndkpx_0" on storage.objects;

-- Enforce the same upload constraints at the storage boundary. Signed upload
-- URLs alone do not limit size or MIME type.
update storage.buckets
set file_size_limit = 4194304,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'profile-photos';

update storage.buckets
set public = false,
    file_size_limit = 83886080,
    allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']::text[]
where id = 'raffle-videos';

-- These RPCs are called only by server routes through the service role.
create or replace function public.bump_ignored_picks(p_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $function$
  update public.users set ignored_picks = ignored_picks + 1 where id = p_id;
$function$;

create or replace function public.activity_rsvp_counts(p_ids uuid[])
returns table(activity_id uuid, yes integer, maybe integer, no integer)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    activity_id,
    count(*) filter (where coalesce(response, 'yes') = 'yes')::int,
    count(*) filter (where coalesce(response, 'yes') = 'maybe')::int,
    count(*) filter (where coalesce(response, 'yes') = 'no')::int
  from public.friend_activity_rsvps
  where activity_id = any(p_ids)
  group by activity_id
$function$;

revoke all on function public.bump_ignored_picks(uuid) from public, anon, authenticated;
revoke all on function public.activity_rsvp_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.bump_ignored_picks(uuid) to service_role;
grant execute on function public.activity_rsvp_counts(uuid[]) to service_role;

-- Supabase's RLS event trigger is internal infrastructure, not a public RPC.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Serialize each rate-limit key inside Postgres. The old read/increment/write
-- sequence could be raced by parallel requests and bypassed.
create or replace function public.consume_rate_limit(
  p_key text,
  p_window_sec integer,
  p_max_attempts integer,
  p_block_sec integer default 0
)
returns table(allowed boolean, retry_after_sec integer, reason text)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_row public.rate_limits%rowtype;
  v_count integer;
  v_retry integer;
  v_blocked_until timestamptz;
begin
  if p_key is null or p_key = '' or pg_catalog.length(p_key) > 300
     or p_window_sec < 1 or p_max_attempts < 1 or p_block_sec < 0 then
    raise exception 'invalid rate-limit arguments';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key, 0));

  select * into v_row
  from public.rate_limits
  where key = p_key;

  if found and v_row.blocked_until is not null and v_row.blocked_until > v_now then
    v_retry := greatest(1, pg_catalog.ceil(
      extract(epoch from (v_row.blocked_until - v_now))
    )::integer);
    return query select false, v_retry, 'blocked'::text;
    return;
  end if;

  if not found or v_row.window_start <= v_now - pg_catalog.make_interval(secs => p_window_sec) then
    insert into public.rate_limits as rl (key, count, window_start, blocked_until)
    values (p_key, 1, v_now, null)
    on conflict (key) do update
      set count = 1, window_start = excluded.window_start, blocked_until = null;
    return query select true, 0, 'allowed'::text;
    return;
  end if;

  v_count := coalesce(v_row.count, 0) + 1;
  if v_count > p_max_attempts then
    v_blocked_until := case
      when p_block_sec > 0 then v_now + pg_catalog.make_interval(secs => p_block_sec)
      else v_row.window_start + pg_catalog.make_interval(secs => p_window_sec)
    end;
    update public.rate_limits
      set count = v_count, blocked_until = v_blocked_until
      where key = p_key;
    v_retry := greatest(1, pg_catalog.ceil(
      extract(epoch from (v_blocked_until - v_now))
    )::integer);
    return query select false, v_retry, 'throttled'::text;
    return;
  end if;

  update public.rate_limits set count = v_count where key = p_key;
  return query select true, 0, 'allowed'::text;
end;
$function$;

revoke all on function public.consume_rate_limit(text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer, integer)
  to service_role;

-- The replacement limiter stores only v2 SHA-256 keys. Remove legacy rows
-- whose primary keys could contain raw email addresses or IP addresses.
delete from public.rate_limits where key not like 'v2:%';

-- Analytics never needs URL queries/fragments. Scrub any historic referrers
-- that may include emailed action tokens or payment-provider session IDs.
update public.page_views
set referrer = pg_catalog.regexp_replace(referrer, '[?#].*$', '')
where referrer ~ '[?#]';

-- Provider deliveries are at-least-once. Enforce idempotency in the database
-- rather than relying on a raceable check followed by insert.
create unique index if not exists inbound_messages_resend_email_id_uq
  on public.inbound_messages (resend_email_id)
  where resend_email_id is not null;

alter table public.stripe_events add column if not exists processing_started_at timestamptz;
alter table public.stripe_events add column if not exists processed_at timestamptz;
alter table public.stripe_events add column if not exists last_error text;

create or replace function public.claim_stripe_event(p_event_id text, p_type text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_rows integer;
begin
  if p_event_id is null or p_event_id = '' or pg_catalog.length(p_event_id) > 255 then
    return false;
  end if;

  insert into public.stripe_events (event_id, type, received_at, processing_started_at, last_error)
  values (p_event_id, pg_catalog.left(p_type, 255), pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp(), null)
  on conflict (event_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then return true; end if;

  update public.stripe_events
  set processing_started_at = pg_catalog.clock_timestamp(), last_error = null
  where event_id = p_event_id
    and processed_at is null
    and (processing_started_at is null
      or processing_started_at < pg_catalog.clock_timestamp() - interval '10 minutes');
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$function$;

revoke all on function public.claim_stripe_event(text, text) from public, anon, authenticated;
grant execute on function public.claim_stripe_event(text, text) to service_role;

-- Session cookies retain the random bearer token, while the database keeps
-- only its SHA-256 digest. The version flag makes this migration idempotent.
alter table public.sessions add column if not exists token_hash_version smallint not null default 0;
update public.sessions
set token = pg_catalog.encode(extensions.digest(token, 'sha256'), 'hex'),
    token_hash_version = 1
where token_hash_version = 0;

commit;
