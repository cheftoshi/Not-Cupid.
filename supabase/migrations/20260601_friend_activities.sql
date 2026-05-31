-- Friend Maxxin activity board (Reddit-style "wanna do X?") + RSVPs.
create table if not exists friend_activities (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references users(id) on delete cascade,
  title text not null,
  body text,
  category text not null default 'hang' check (category in
    ('food','drinks','active','outdoors','culture','nightlife','games','chill','hang')),
  area text,                 -- neighborhood label (derived from author zip or chosen)
  happens_at timestamptz,    -- when it's happening (optional)
  expires_at timestamptz,    -- auto-hide after this; defaults to happens_at or +14d
  created_at timestamptz not null default now()
);
create index if not exists friend_activities_live_idx on friend_activities(expires_at, created_at desc);
create index if not exists friend_activities_area_idx on friend_activities(area);
create index if not exists friend_activities_cat_idx on friend_activities(category);

create table if not exists friend_activity_rsvps (
  activity_id uuid not null references friend_activities(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);
create index if not exists friend_activity_rsvps_act_idx on friend_activity_rsvps(activity_id);

grant all on friend_activities to service_role;
grant all on friend_activity_rsvps to service_role;
alter table friend_activities enable row level security;
alter table friend_activity_rsvps enable row level security;
