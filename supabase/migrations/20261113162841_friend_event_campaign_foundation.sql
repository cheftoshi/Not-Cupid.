-- Local foundation only: no audience backfill, no approval, no send or cron.
create table public.friend_event_preferences (
 user_id uuid primary key references public.users(id) on delete cascade,
 email_enabled boolean not null default false,
 push_enabled boolean not null default false,
 consent_version text not null check (consent_version = 'friend-events-v1'),
 updated_at timestamptz not null default now()
);
create table public.friend_event_preference_audit (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.users(id) on delete cascade,
 channel text not null check(channel in ('email','push')),
 enabled boolean not null,
 source text not null check(source in ('profile','signed_unsubscribe')),
 consent_version text not null,
 created_at timestamptz not null default now()
);
-- Populate only from verified provider feedback; missing reconciliation is a send blocker.
create table public.friend_event_suppressions (
 user_id uuid not null references public.users(id) on delete cascade,
 channel text not null check(channel in ('email','push')),
 reason text not null check(reason in ('bounce','complaint','provider_suppressed','invalid_device','operator')),
 created_at timestamptz not null default now(),
 primary key(user_id,channel)
);
create table public.friend_event_campaigns (
 id text primary key check(id ~ '^friend_events_[a-z0-9_]{1,80}$'),
 content_version text not null,
 -- Set only after exact copy/audience/count approval and separate send approval.
 approved_at timestamptz,
 send_enabled boolean not null default false,
 expires_at timestamptz not null
);
create table public.friend_event_deliveries (
 id uuid primary key default gen_random_uuid(),
 campaign_id text not null references public.friend_event_campaigns(id),
 user_id uuid not null references public.users(id) on delete cascade,
 channel text not null check(channel in ('email','push')),
 status text not null default 'claimed' check(status in ('claimed','accepted','delivered','failed','suppressed')),
 provider_id text,
 claimed_at timestamptz not null default now(),
 unique(campaign_id,user_id,channel)
);
create index on public.friend_event_deliveries(user_id,channel,claimed_at);
create table public.friend_event_attribution (
 delivery_id uuid not null references public.friend_event_deliveries(id) on delete cascade,
 event text not null check(event in ('link_request','authenticated_return','plan_join','plan_create')),
 occurred_at timestamptz not null default now(),
 primary key(delivery_id,event)
);
-- Only service code can read consent or member-level campaign records.
alter table public.friend_event_suppressions enable row level security;
alter table public.friend_event_preferences enable row level security;
alter table public.friend_event_preference_audit enable row level security;
alter table public.friend_event_campaigns enable row level security;
alter table public.friend_event_deliveries enable row level security;
alter table public.friend_event_attribution enable row level security;
revoke all on public.friend_event_suppressions, public.friend_event_preferences, public.friend_event_preference_audit, public.friend_event_campaigns, public.friend_event_deliveries, public.friend_event_attribution from anon, authenticated;
grant all on public.friend_event_suppressions, public.friend_event_preferences, public.friend_event_preference_audit, public.friend_event_campaigns, public.friend_event_deliveries, public.friend_event_attribution to service_role;
grant usage,select on sequence public.friend_event_preference_audit_id_seq to service_role;

create function public.set_friend_event_preference(p_user uuid,p_channel text,p_enabled boolean,p_source text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_channel not in ('email','push') or p_enabled is null or p_source not in ('profile','signed_unsubscribe') or (p_source='signed_unsubscribe' and p_enabled) then raise exception 'Invalid preference'; end if;
 insert into friend_event_preferences(user_id,consent_version) values(p_user,'friend-events-v1') on conflict(user_id) do nothing;
 update friend_event_preferences set email_enabled=case when p_channel='email' then p_enabled else email_enabled end,
 push_enabled=case when p_channel='push' then p_enabled else push_enabled end, updated_at=now() where user_id=p_user;
 insert into friend_event_preference_audit(user_id,channel,enabled,source,consent_version) values(p_user,p_channel,p_enabled,p_source,'friend-events-v1');
end $$;

-- Serialized by member to prevent concurrent campaigns bypassing weekly limits.
-- Unknown outcomes remain claimed: never automatically retry a possibly sent item.
create function public.claim_friend_event_delivery(p_user uuid,p_campaign text,p_channel text,p_admin_emails text[])
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if p_channel not in ('email','push') or p_admin_emails is null or cardinality(p_admin_emails)=0 then return null; end if;
 perform 1 from users where id=p_user for update;
 if not exists(select 1 from users u join friend_event_preferences p on p.user_id=u.id
 where u.id=p_user and not coalesce(u.is_test,false) and not coalesce(u.is_blocked,false) and u.deleted_at is null
 and u.friend_opted_in_at is not null and not(lower(u.email)=any(p_admin_emails))
 and p.consent_version='friend-events-v1'
 and ((p_channel='email' and p.email_enabled and u.email_notifications is true and u.notifications_paused_at is null)
 or (p_channel='push' and p.push_enabled and exists(select 1 from push_subscriptions s where s.user_id=u.id)))) then return null; end if;
 if exists(select 1 from friend_event_suppressions where user_id=p_user and channel=p_channel) then return null; end if;
 if not exists(select 1 from friend_event_campaigns where id=p_campaign and send_enabled and approved_at is not null and expires_at>now()) then return null; end if;
 if exists(select 1 from friend_event_deliveries where user_id=p_user and channel=p_channel and claimed_at>now()-interval '7 days') then return null; end if;
 insert into friend_event_deliveries(campaign_id,user_id,channel) values(p_campaign,p_user,p_channel) on conflict do nothing returning id into result;
 return result;
end $$;
revoke all on function public.set_friend_event_preference(uuid,text,boolean,text), public.claim_friend_event_delivery(uuid,text,text,text[]) from public,anon,authenticated;
grant execute on function public.set_friend_event_preference(uuid,text,boolean,text), public.claim_friend_event_delivery(uuid,text,text,text[]) to service_role;
