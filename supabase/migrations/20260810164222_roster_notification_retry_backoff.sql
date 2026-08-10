alter table public.users
  add column if not exists roster_notification_attempted_at timestamptz;

comment on column public.users.roster_notification_attempted_at is
  'Last provider attempt for a pending verified roster change; enforces six-hour retry backoff.';
