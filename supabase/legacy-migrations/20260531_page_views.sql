-- First-party pageview tracking for the in-admin "web traffic" view.
-- One row per client route change (anonymous-friendly; anon_id is a random
-- localStorage id, NOT tied to identity). Low-volume early-stage; roll up later
-- if it grows. Vercel Analytics still covers raw traffic — this is the
-- in-dashboard slice.

create table if not exists page_views (
  id bigint generated always as identity primary key,
  path text not null,
  anon_id text,
  referrer text,
  created_at timestamptz not null default now()
);

create index if not exists page_views_created_idx on page_views(created_at desc);
create index if not exists page_views_path_idx on page_views(path);

grant all on page_views to service_role;
alter table page_views enable row level security;
