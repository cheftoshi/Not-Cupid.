-- Durable unread state for Friend pack + club chats.
--
-- A recipient gets at most one fallback email for an unread period. Opening
-- the thread advances read_at and clears the email markers; only a later batch
-- can become eligible again. Existing memberships are backfilled as read now
-- so enabling this feature can never blast people about historical messages.

create table if not exists public.friend_chat_reads (
  user_id uuid not null references public.users(id) on delete cascade,
  thread_kind text not null check (thread_kind in ('circle', 'club')),
  thread_id uuid not null,
  read_at timestamptz not null default now(),
  email_attempted_at timestamptz,
  email_notified_at timestamptz,
  last_email_message_at timestamptz,
  primary key (user_id, thread_kind, thread_id)
);

create index if not exists friend_chat_reads_thread_idx
  on public.friend_chat_reads (thread_kind, thread_id, read_at);

alter table public.friend_chat_reads enable row level security;
revoke all on table public.friend_chat_reads from public, anon, authenticated;
grant select, insert, update, delete on table public.friend_chat_reads to service_role;

-- Existing users start clean. The app and cron create missing rows lazily for
-- memberships added by older code paths.
insert into public.friend_chat_reads (user_id, thread_kind, thread_id, read_at)
select member.user_id, 'club', member.club_id, now()
from public.friend_club_members as member
where member.status = 'member'
on conflict (user_id, thread_kind, thread_id) do nothing;

insert into public.friend_chat_reads (user_id, thread_kind, thread_id, read_at)
select club.creator_id, 'club', club.id, now()
from public.friend_clubs as club
on conflict (user_id, thread_kind, thread_id) do nothing;

insert into public.friend_chat_reads (user_id, thread_kind, thread_id, read_at)
select member.user_id, 'circle', member.circle_id, now()
from public.friend_circle_members as member
where member.left_at is null
on conflict (user_id, thread_kind, thread_id) do nothing;

-- Atomically claim an email attempt. This prevents overlapping hourly cron
-- runs from sending the same reminder twice. A provider failure may retry after
-- one hour and reuses a stable Resend idempotency key.
create or replace function public.claim_friend_chat_email(
  p_user_id uuid,
  p_thread_kind text,
  p_thread_id uuid,
  p_latest_message_at timestamptz,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean := false;
begin
  update public.friend_chat_reads
  set email_attempted_at = p_now,
      last_email_message_at = p_latest_message_at
  where user_id = p_user_id
    and thread_kind = p_thread_kind
    and thread_id = p_thread_id
    and email_notified_at is null
    and (email_attempted_at is null or email_attempted_at < p_now - interval '1 hour')
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_friend_chat_email(uuid, text, uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_friend_chat_email(uuid, text, uuid, timestamptz, timestamptz)
  to service_role;

comment on table public.friend_chat_reads is
  'Read cursors and one-per-unread-period email state for Friend circle and club chats.';
