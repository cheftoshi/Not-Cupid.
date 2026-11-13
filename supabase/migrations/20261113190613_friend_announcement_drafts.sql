-- Draft storage only. This does not create a campaign, an approval or a delivery.
create table public.friend_announcement_drafts (
 id text primary key check(id ~ '^friend_events_announcement_[a-z0-9_]{1,60}$'),
 manifest_hash text not null check(manifest_hash ~ '^[a-f0-9]{64}$'),
 audience_hash text not null check(audience_hash ~ '^[a-f0-9]{64}$'),
 recipient_count integer not null check(recipient_count>0),
 manifest jsonb not null check(jsonb_typeof(manifest)='object'),
 prepared_at timestamptz not null default now(),
 expires_at timestamptz not null,
 check(expires_at>prepared_at)
);
alter table public.friend_announcement_drafts enable row level security;
revoke all on public.friend_announcement_drafts from public,anon,authenticated,service_role;
-- Frozen drafts cannot be overwritten by application code.
grant select,insert on public.friend_announcement_drafts to service_role;
