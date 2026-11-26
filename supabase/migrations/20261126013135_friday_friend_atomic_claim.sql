-- Unreleased draft migration. Apply in one transaction (Supabase migration runner).
-- Fail closed on busy tables; never wait indefinitely or leave partial DDL.
set local lock_timeout = '2s';
set local statement_timeout = '15s';

alter table public.friend_event_campaigns
 add column friday_owner_review_hash text check(friday_owner_review_hash ~ '^[a-f0-9]{64}$'),
 add column friday_owner_test_verified_at timestamptz;

create function public.friday_friend_window_open(p_day text,p_now timestamptz)
returns boolean language sql immutable set search_path=public as $$
 select p_day=(p_now at time zone 'America/New_York')::date::text
 and extract(isodow from p_now at time zone 'America/New_York')=5
 and (p_now at time zone 'America/New_York')::time>=time '14:00'
 and (p_now at time zone 'America/New_York')::time<time '14:15';
$$;
revoke all on function public.friday_friend_window_open(text,timestamptz) from public,anon,authenticated;
grant execute on function public.friday_friend_window_open(text,timestamptz) to service_role;

-- The physical daily trigger is disabled on installation. The daily path then
-- executes no Friday code and acquires no additional user lock. A Friday claim
-- must hold this table lock until commit and observe the trigger enabled. This
-- serializes with the operator transition without serializing ordinary claims.
create function public.friday_friend_overlap_ready() returns boolean
language plpgsql security definer set search_path=public set lock_timeout='2s' as $$
begin
 lock table public.activity_digest_deliveries in row exclusive mode;
 return exists(select 1 from pg_trigger
  where tgrelid='public.activity_digest_deliveries'::regclass
  and tgname='friday_daily_delivery_overlap' and tgenabled='O');
end $$;
revoke all on function public.friday_friend_overlap_ready() from public,anon,authenticated;
grant execute on function public.friday_friend_overlap_ready() to service_role;

-- Inert preparation prerequisite: creates no campaign, approval or schedule.
-- Must pass persisted concurrency tests before release. Application execution must
-- independently revalidate fresh inventory, Boston audience and provider suppression.
create function public.guard_friday_friend_overlap() returns trigger
language plpgsql security definer set search_path=public as $$
declare friday boolean; local_now timestamp; manifest jsonb;
begin
 if tg_table_name='activity_digest_deliveries' then
  perform 1 from users where id=new.user_id for update;
  if exists(select 1 from friend_event_deliveries d join friend_event_campaigns c on c.id=d.campaign_id
    where d.user_id=new.user_id and d.channel='email' and d.claimed_at>clock_timestamp()-interval '24 hours'
    and c.content_version='friday-friends-once-weekly-v1-2026-11-26') then
   raise exception 'Friday email overlap' using errcode='23505';
  end if;
  return new;
 end if;
 select content_version='friday-friends-once-weekly-v1-2026-11-26' into friday
 from friend_event_campaigns where id=new.campaign_id;
 if not coalesce(friday,false) then return new; end if;
 if not friday_friend_overlap_ready() then
  raise exception 'Friday overlap protection disabled' using errcode='23514';
 end if;
 perform 1 from users where id=new.user_id for update;
 local_now=clock_timestamp() at time zone 'America/New_York';
 if new.channel<>'email' then
  raise exception 'Friday email window closed' using errcode='23514';
 end if;
 select d.manifest into manifest from friend_announcement_drafts d join friend_event_campaigns c on c.id=d.id
 where d.id=new.campaign_id and d.manifest_hash=c.manifest_hash and d.recipient_count=c.recipient_count
 and c.audience_policy='weekly_discovery' and c.content_version=d.manifest->>'version'
 and c.send_enabled and c.approved_at<=clock_timestamp() and c.content_approved_at<=clock_timestamp()
 and c.send_approved_at>c.content_approved_at and c.send_approved_at<=clock_timestamp()
 and c.expires_at>clock_timestamp() and d.expires_at>clock_timestamp()
 and c.provider_permission_reviewed_at<=clock_timestamp() and length(trim(c.provider_permission_basis))>=20;
 if manifest is null or manifest->>'cadence' is distinct from 'once-weekly'
 or not coalesce(friday_friend_window_open(manifest->>'fridayDay',clock_timestamp()),false)
 or not exists(select 1 from jsonb_array_elements(manifest->'entries') e
   where e->>'userId'=new.user_id::text and e->>'channel'='email') then
  raise exception 'Exact Friday review required' using errcode='23514';
 end if;
 if exists(select 1 from activity_digest_deliveries where user_id=new.user_id and created_at>clock_timestamp()-interval '24 hours')
 or exists(select 1 from users where id=new.user_id and activity_digest_sent_at>clock_timestamp()-interval '24 hours') then
  raise exception 'Daily activity overlap' using errcode='23505';
 end if;
 -- Existing claim RPCs serialize on this same user row. All statuses count,
 -- including uncertain/failed claims; a new revision cannot bypass the cooldown.
 if exists(select 1 from friend_event_deliveries where user_id=new.user_id and channel='email' and claimed_at>clock_timestamp()-interval '7 days') then
  raise exception 'Weekly Friend email limit' using errcode='23505';
 end if;
 return new;
end $$;
revoke all on function public.guard_friday_friend_overlap() from public,anon,authenticated;
create trigger friday_friend_delivery_overlap before insert on public.friend_event_deliveries
 for each row execute function public.guard_friday_friend_overlap();
create trigger friday_daily_delivery_overlap before insert on public.activity_digest_deliveries
 for each row execute function public.guard_friday_friend_overlap();
alter table public.activity_digest_deliveries disable trigger friday_daily_delivery_overlap;

-- Separate operator prerequisite, not send authorization. The table lock drains
-- both daily writes and Friday transactions holding overlap_ready's lock. Once
-- disabled, waiting/new Friday claims fail closed. Do not bypass this routine
-- with ALTER TABLE: recent or unresolved claims must retain overlap protection.
create function public.set_friday_friend_overlap_enabled(p_enabled boolean) returns boolean
language plpgsql security definer set search_path=public set lock_timeout='2s' as $$
begin
 if p_enabled is null then raise exception 'Explicit overlap state required'; end if;
 lock table public.activity_digest_deliveries in share row exclusive mode;
 if p_enabled then
  alter table public.activity_digest_deliveries enable trigger friday_daily_delivery_overlap;
 else
  if exists(select 1 from friend_event_deliveries d join friend_event_campaigns c on c.id=d.campaign_id
   where c.content_version='friday-friends-once-weekly-v1-2026-11-26' and d.channel='email'
   and (d.claimed_at>clock_timestamp()-interval '24 hours' or d.status in ('claimed','failed'))) then
   raise exception 'Friday claims require overlap protection' using errcode='23514';
  end if;
  alter table public.activity_digest_deliveries disable trigger friday_daily_delivery_overlap;
 end if;
 return p_enabled;
end $$;
revoke all on function public.set_friday_friend_overlap_enabled(boolean) from public,anon,authenticated;
grant execute on function public.set_friday_friend_overlap_enabled(boolean) to service_role;

-- Only this wrapper is used by the Friday adapter. Reuse the existing frozen
-- weekly claim and its user lock, consent, suppression, seven-day and unique gates.
create function public.claim_friday_friend_delivery(p_user uuid,p_campaign text,p_admin_emails text[],p_delivery uuid,p_manifest_hash text)
returns uuid language plpgsql security definer set search_path=public as $$
begin
 if p_admin_emails is null or cardinality(p_admin_emails)=0 then return null; end if;
 if not friday_friend_overlap_ready() then return null; end if;
 if not exists(select 1 from friend_event_campaigns c
  join friend_announcement_drafts d on d.id=c.id
  join campaign_owner_reviews o on o.source_campaign=c.id
  where c.id=p_campaign and c.content_version='friday-friends-once-weekly-v1-2026-11-26'
  and c.audience_policy='weekly_discovery' and c.manifest_hash=p_manifest_hash
  and d.manifest_hash=p_manifest_hash and d.recipient_count=c.recipient_count
  and d.manifest->>'purpose'='friend_discovery_review' and d.manifest->>'cadence'='once-weekly'
  and d.manifest->>'edition'='weekend' and d.manifest->>'version'=c.content_version
  and friday_friend_window_open(d.manifest->>'fridayDay',clock_timestamp())
  and c.approved_at<=clock_timestamp() and c.content_approved_at<=clock_timestamp()
  and c.send_approved_at>c.content_approved_at and c.send_approved_at<=clock_timestamp()
  and c.send_enabled and c.expires_at>clock_timestamp() and d.expires_at>clock_timestamp()
  and c.provider_permission_reviewed_at<=clock_timestamp() and length(trim(c.provider_permission_basis))>=20
  and o.manifest_hash=c.friday_owner_review_hash and o.manifest->>'sourceHash'=p_manifest_hash
  and o.accepted_at<=clock_timestamp() and o.provider_id is not null
  and c.friday_owner_test_verified_at>=o.accepted_at
  and c.friday_owner_test_verified_at<=c.content_approved_at
  and exists(select 1 from jsonb_array_elements(d.manifest->'entries') e
    where e->>'userId'=p_user::text and e->>'deliveryId'=p_delivery::text and e->>'channel'='email')) then return null; end if;
 perform 1 from users where id=p_user for update;
 if not exists(select 1 from users where id=p_user and age>=18) then return null; end if;
 return claim_frozen_friend_event_delivery(p_user,p_campaign,'email',p_admin_emails,p_delivery,p_manifest_hash);
end $$;
revoke all on function public.claim_friday_friend_delivery(uuid,text,text[],uuid,text) from public,anon,authenticated;
grant execute on function public.claim_friday_friend_delivery(uuid,text,text[],uuid,text) to service_role;
