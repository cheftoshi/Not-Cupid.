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
 perform 1 from users where id=new.user_id for update;
 local_now=clock_timestamp() at time zone 'America/New_York';
 if new.channel<>'email' or extract(isodow from local_now)<>5 or local_now::time<time '14:00' or local_now::time>=time '14:15' then
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
 or manifest->>'fridayDay' is distinct from local_now::date::text
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
