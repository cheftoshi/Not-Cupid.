-- User feedback drop (from the dashboard "send feedback" spot).
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on feedback(created_at desc);
grant all on feedback to service_role;
alter table feedback enable row level security;
