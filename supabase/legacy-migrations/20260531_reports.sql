-- Block & report — core safety feature.
--
-- user_reports: one row per (reporter → reported) report, with a reason and
-- optional detail. The reported pair is also written to match_history so the
-- matcher never pairs them again (reuses the existing no-repeat path).
--
-- users.is_blocked: a hard platform block set by admin after reviewing
-- reports — excludes the user from matching entirely (separate from the
-- ghost-driven matching_disabled_at so admins can distinguish the reason).

create table if not exists user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references users(id) on delete cascade,
  reported_id uuid not null references users(id) on delete cascade,
  match_id uuid references matches(id) on delete set null,
  reason text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists user_reports_reported_idx on user_reports(reported_id);
create index if not exists user_reports_created_idx on user_reports(created_at desc);
grant all on user_reports to service_role;
alter table user_reports enable row level security;

alter table users add column if not exists is_blocked boolean not null default false;

-- Allow 'reported' as a match ended_reason (the report flow ends the match).
alter table matches drop constraint if exists matches_ended_reason_check;
alter table matches add constraint matches_ended_reason_check
  check (ended_reason in (
    'expired','one_passed','mutual_pass','completed','user_deleted',
    'user_ended','ghosted','not_vibing','user_requiz','reported'
  ));
