-- City Pulse = communities. Two things:
--  1. CLUBS — user-run groups (book club, run club). Join by REQUEST → creator
--     approves. Approved members get the club in their circles + its own chat.
--  2. COMMUNITY LINKS — submitted Discord/WhatsApp/etc. links, shown only after
--     an admin approves them.

create table if not exists friend_clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  creator_id uuid not null,
  area text,            -- neighborhood/zone (optional)
  metro text,           -- city/metro key (city-based discovery)
  is_test boolean not null default false,
  report_count int not null default 0,
  hidden_at timestamptz, -- admin hide OR auto-hide at the report threshold
  created_at timestamptz not null default now()
);
create index if not exists friend_clubs_metro_idx on friend_clubs (metro, created_at desc);

-- membership: 'pending' = a join request awaiting the creator; 'member' = approved.
create table if not exists friend_club_members (
  club_id uuid not null references friend_clubs(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

-- each club has its OWN chat (separate from the crew circle).
create table if not exists friend_club_messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references friend_clubs(id) on delete cascade,
  sender_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists friend_club_messages_idx on friend_club_messages (club_id, created_at);

-- one report per user; report_count auto-hides a club at the threshold.
create table if not exists friend_club_reports (
  club_id uuid not null references friend_clubs(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table if not exists friend_community_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  kind text,            -- discord / whatsapp / groupme / telegram / other
  description text,
  submitter_id uuid not null,
  metro text,
  is_test boolean not null default false,
  approved boolean not null default false,   -- admin-gated
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists friend_community_links_idx on friend_community_links (metro, approved);

alter table friend_clubs            enable row level security;
alter table friend_club_members     enable row level security;
alter table friend_club_messages    enable row level security;
alter table friend_club_reports     enable row level security;
alter table friend_community_links  enable row level security;
grant all on table friend_clubs, friend_club_members, friend_club_messages, friend_club_reports, friend_community_links to anon, authenticated, service_role;
