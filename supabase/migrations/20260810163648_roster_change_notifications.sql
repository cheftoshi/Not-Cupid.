alter table public.users
  add column if not exists roster_changed_at timestamptz,
  add column if not exists roster_change_notified_at timestamptz;

create index if not exists users_roster_refresh_due_idx
  on public.users (roster_refreshed_at)
  where pool_active = true
    and deleted_at is null
    and matching_disabled_at is null
    and coalesce(is_test, false) = false;

comment on column public.users.roster_changed_at is
  'Latest background verification that added at least one new candidate to a previously composed Love roster.';

comment on column public.users.roster_change_notified_at is
  'Latest verified roster change handled by delivery or by the user opening Love Line.';
