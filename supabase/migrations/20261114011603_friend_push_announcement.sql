-- Operator-only, one-time product announcement push. No enrollment or activation.
-- Separate from both recurring discovery consent and email's two-step approval.
create function public.claim_friend_push_announcement(p_user uuid,p_campaign text,p_admin_emails text[],p_delivery uuid,p_manifest_hash text)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if p_delivery is null or p_manifest_hash is null or p_admin_emails is null or cardinality(p_admin_emails)=0 then return null; end if;
 if not exists(select 1 from friend_event_campaigns where id=p_campaign and id like 'friend_events_push_announcement_%'
  and audience_policy='friend_line_announcement' and content_version='friend-push-announcement-v1'
  and manifest_hash=p_manifest_hash and recipient_count>0 and approved_at is not null and approved_at<=now()
  and send_enabled and expires_at>now() and provider_permission_reviewed_at<=now()
  and length(trim(provider_permission_basis))>=20) then return null; end if;
 perform 1 from users where id=p_user for update;
 if not exists(select 1 from users where id=p_user and not coalesce(is_test,false) and not coalesce(is_blocked,false)
  and deleted_at is null and friend_opted_in_at is not null and notifications_paused_at is null
  and not(lower(trim(email))=any(p_admin_emails))) then return null; end if;
 if not exists(select 1 from push_subscriptions where user_id=p_user) then return null; end if;
 if exists(select 1 from friend_event_suppressions where user_id=p_user and channel='push') then return null; end if;
 if exists(select 1 from friend_event_preferences p where p.user_id=p_user and not p.push_enabled
  and exists(select 1 from friend_event_preference_audit a where a.user_id=p_user and a.channel='push' and not a.enabled)) then return null; end if;
 if exists(select 1 from friend_event_deliveries where user_id=p_user and channel='push' and claimed_at>now()-interval '7 days') then return null; end if;
 insert into friend_event_deliveries(id,campaign_id,user_id,channel) values(p_delivery,p_campaign,p_user,'push') on conflict do nothing returning id into result;
 return result;
end $$;
revoke all on function public.claim_friend_push_announcement(uuid,text,text[],uuid,text) from public,anon,authenticated;
grant execute on function public.claim_friend_push_announcement(uuid,text,text[],uuid,text) to service_role;
create table public.friend_push_announcement_drafts (
 id text primary key check(id ~ '^friend_events_push_announcement_[a-z0-9_]{1,50}$'),
 manifest_hash text not null, manifest jsonb not null, expires_at timestamptz not null,
 started_at timestamptz, result jsonb
);
alter table public.friend_push_announcement_drafts enable row level security;
revoke all on public.friend_push_announcement_drafts from public,anon,authenticated,service_role;
grant select,insert on public.friend_push_announcement_drafts to service_role;
grant update(started_at,result) on public.friend_push_announcement_drafts to service_role;
create table public.friend_push_announcement_receipts (
 delivery_id uuid references public.friend_event_deliveries(id), device_id uuid not null,
 outcome text not null check(outcome in ('accepted','rejected','unknown')),
 recorded_at timestamptz not null default now(), primary key(delivery_id,device_id)
);
alter table public.friend_push_announcement_receipts enable row level security;
revoke all on public.friend_push_announcement_receipts from public,anon,authenticated,service_role;
grant select,insert on public.friend_push_announcement_receipts to service_role;
