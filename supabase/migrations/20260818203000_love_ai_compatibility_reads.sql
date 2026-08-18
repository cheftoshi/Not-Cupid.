-- A paid Love connection now also includes one private AI Compatibility Read
-- for that exact candidate. Core roster profiles stay free. The report stores
-- only a bounded interpretation; raw quiz answers and chat contents never land
-- in this table.

create table if not exists public.love_compatibility_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  candidate_id uuid not null references public.users(id) on delete cascade,
  connection_unlock_id uuid unique references public.love_connection_unlocks(id) on delete set null,
  roster_cycle_at timestamptz,
  stripe_session_id text unique,
  stripe_payment_id text unique,
  report jsonb,
  report_source text check (report_source in ('ai', 'curated')),
  report_version text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, candidate_id),
  check (user_id <> candidate_id)
);

create index if not exists love_compatibility_reads_user_idx
  on public.love_compatibility_reads (user_id, created_at desc);

alter table public.love_compatibility_reads enable row level security;
revoke all on table public.love_compatibility_reads from public, anon, authenticated;
grant all on table public.love_compatibility_reads to service_role;

