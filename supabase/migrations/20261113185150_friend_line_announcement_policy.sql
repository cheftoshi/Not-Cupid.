-- One-time product announcements are distinct from recurring discovery consent.
-- No campaign is registered/approved, no preferences changed, no sends scheduled.
alter table public.friend_event_campaigns
 add column audience_policy text not null default 'weekly_discovery' check(audience_policy in ('weekly_discovery','friend_line_announcement')),
 add column provider_permission_reviewed_at timestamptz,
 add column provider_permission_basis text;
create function public.claim_friend_line_announcement(p_user uuid,p_campaign text,p_admin_emails text[],p_delivery uuid,p_manifest_hash text)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if p_delivery is null or p_manifest_hash is null or p_admin_emails is null or cardinality(p_admin_emails)=0 then return null; end if;
 if not exists(select 1 from friend_event_campaigns where id=p_campaign and id like 'friend_events_announcement_%'
  and audience_policy='friend_line_announcement' and manifest_hash=p_manifest_hash and recipient_count>0
  and approved_at is not null and approved_at<=now() and content_approved_at is not null
  and send_approved_at>content_approved_at and send_approved_at<=now() and send_enabled and expires_at>now()
  and provider_permission_reviewed_at is not null and provider_permission_reviewed_at<=now()
  and length(trim(provider_permission_basis))>=20) then return null; end if;
 perform 1 from users where id=p_user for update;
 if not exists(select 1 from users where id=p_user and not coalesce(is_test,false) and not coalesce(is_blocked,false)
  and deleted_at is null and friend_opted_in_at is not null and email_notifications is true and notifications_paused_at is null
  and length(trim(email))>3 and not(lower(trim(email))=any(p_admin_emails))) then return null; end if;
 if exists(select 1 from friend_event_suppressions where user_id=p_user and channel='email') then return null; end if;
 -- Honor an actual topic opt-out too; absence/default false is NOT an opt-out.
 if exists(select 1 from friend_event_preferences p where p.user_id=p_user and not p.email_enabled
  and exists(select 1 from friend_event_preference_audit a where a.user_id=p_user and a.channel='email' and not a.enabled)) then return null; end if;
 if exists(select 1 from friend_event_deliveries where user_id=p_user and channel='email' and claimed_at>now()-interval '7 days') then return null; end if;
 insert into friend_event_deliveries(id,campaign_id,user_id,channel) values(p_delivery,p_campaign,p_user,'email') on conflict do nothing returning id into result;
 return result;
end $$;
revoke all on function public.claim_friend_line_announcement(uuid,text,text[],uuid,text) from public,anon,authenticated;
grant execute on function public.claim_friend_line_announcement(uuid,text,text[],uuid,text) to service_role;
