-- One consolidated, preference-aware daily activity email for Love + Friend.
-- Delivery remains disabled in application code until the versioned template
-- and automatic-send policy are explicitly approved by the operator.

alter table public.users
  add column if not exists activity_digest_sent_at timestamptz;

create table if not exists public.activity_digest_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content_key text not null,
  status text not null default 'queued' check (status in ('queued', 'sent')),
  item_counts jsonb not null default '{}'::jsonb,
  provider_email_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, content_key)
);

create index if not exists activity_digest_deliveries_user_idx
  on public.activity_digest_deliveries (user_id, created_at desc);

alter table public.activity_digest_deliveries enable row level security;
revoke all on table public.activity_digest_deliveries from public, anon, authenticated;
grant select, insert, update, delete on table public.activity_digest_deliveries to service_role;

-- Scene event comments now double as a small participant-only plan chat. A
-- durable cursor prevents a daily email from repeating a conversation the user
-- already opened.
create table if not exists public.friend_plan_chat_reads (
  activity_id uuid not null references public.friend_activities(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create index if not exists friend_plan_chat_reads_user_idx
  on public.friend_plan_chat_reads (user_id, read_at desc);

alter table public.friend_plan_chat_reads enable row level security;
revoke all on table public.friend_plan_chat_reads from public, anon, authenticated;
grant select, insert, update, delete on table public.friend_plan_chat_reads to service_role;

-- Existing participants start clean. Only comments written after this migration
-- can become unread daily-digest material.
insert into public.friend_plan_chat_reads (activity_id, user_id, read_at)
select a.id, a.author_id, now()
from public.friend_activities a
where coalesce(a.kind, 'event') = 'event'
on conflict (activity_id, user_id) do nothing;

insert into public.friend_plan_chat_reads (activity_id, user_id, read_at)
select r.activity_id, r.user_id, now()
from public.friend_activity_rsvps r
join public.friend_activities a on a.id = r.activity_id
where coalesce(a.kind, 'event') = 'event'
  and r.response = 'yes'
on conflict (activity_id, user_id) do nothing;

comment on table public.activity_digest_deliveries is
  'Idempotency ledger for the consolidated daily Love + Friend activity email.';
comment on table public.friend_plan_chat_reads is
  'Read cursors for participant-only Friend Scene plan conversations.';
