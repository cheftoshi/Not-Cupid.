-- Separate owner-only review ledger; never contributes to member campaign metrics.
create table public.campaign_owner_reviews (
 source_campaign text primary key references public.friend_announcement_drafts(id),
 user_id uuid not null references public.users(id),
 manifest jsonb not null,
 manifest_hash text not null check(manifest_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 content_approved_at timestamptz,
 send_approved_at timestamptz,
 send_enabled boolean not null default false,
 claimed_at timestamptz,
 provider_id text,
 accepted_at timestamptz
);
alter table public.campaign_owner_reviews enable row level security;
revoke all on public.campaign_owner_reviews from public,anon,authenticated,service_role;
grant select,insert on public.campaign_owner_reviews to service_role;
grant update(content_approved_at,send_approved_at,send_enabled,provider_id,accepted_at) on public.campaign_owner_reviews to service_role;
create function public.claim_campaign_owner_review(p_campaign text,p_hash text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update campaign_owner_reviews r set claimed_at=now()
 where source_campaign=p_campaign and manifest_hash=p_hash and claimed_at is null
 and send_enabled and content_approved_at<=now() and send_approved_at>content_approved_at
 and send_approved_at<=now() and expires_at>now()
 and exists(select 1 from users u where u.id=r.user_id and u.email=r.manifest->'email'->>'to'
   and u.friend_opted_in_at is not null and u.email_notifications is true
   and u.notifications_paused_at is null and not coalesce(u.is_test,false)
   and not coalesce(u.is_blocked,false) and u.deleted_at is null)
 and not exists(select 1 from friend_event_suppressions s where s.user_id=r.user_id and s.channel='email')
 and not exists(select 1 from friend_event_preferences p where p.user_id=r.user_id and p.email_enabled=false
   and exists(select 1 from friend_event_preference_audit a where a.user_id=r.user_id and a.channel='email' and a.enabled=false));
 return found;
end $$;
revoke all on function public.claim_campaign_owner_review(text,text) from public,anon,authenticated;
grant execute on function public.claim_campaign_owner_review(text,text) to service_role;
