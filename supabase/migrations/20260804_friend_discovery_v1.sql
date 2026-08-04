-- Friend Discovery v1: one short-lived social intent routes into plans, clubs,
-- vetted external communities, or other people who want the same thing.

alter table public.friend_activities
  add column if not exists metro text,
  add column if not exists is_test boolean;
update public.friend_activities a
set is_test = coalesce(u.is_test, false)
from public.users u
where a.author_id = u.id and a.is_test is null;
update public.friend_activities set is_test = false where is_test is null;
alter table public.friend_activities alter column is_test set default false;
alter table public.friend_activities alter column is_test set not null;
create index if not exists friend_activities_realm_metro_live_idx
  on public.friend_activities (is_test, metro, expires_at, created_at desc);

alter table public.friend_clubs
  add column if not exists activity_key text,
  add column if not exists cadence text not null default 'ongoing',
  add column if not exists next_meet_at timestamptz,
  add column if not exists join_mode text not null default 'request',
  add column if not exists external_url text,
  add column if not exists last_active_at timestamptz not null default now();

alter table public.friend_community_links
  add column if not exists activity_key text,
  add column if not exists area text,
  add column if not exists cadence text not null default 'ongoing',
  add column if not exists audience text,
  add column if not exists last_verified_at timestamptz,
  add column if not exists join_count integer not null default 0,
  add column if not exists last_joined_at timestamptz;

create table if not exists public.friend_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  activity_key text not null,
  time_window text not null default 'this_week'
    check (time_window in ('today', 'this_week', 'weekend', 'ongoing')),
  role text not null default 'either' check (role in ('join', 'host', 'either')),
  group_size text not null default 'small' check (group_size in ('one', 'small', 'group')),
  note text,
  activity_id uuid references public.friend_activities(id) on delete set null,
  metro text,
  area text,
  is_test boolean not null default false,
  status text not null default 'open' check (status in ('open', 'closed', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists friend_intents_one_open_per_user_idx
  on public.friend_intents (user_id) where status = 'open';
create index if not exists friend_intents_discovery_idx
  on public.friend_intents (is_test, metro, activity_key, status, expires_at, created_at desc);
alter table public.friend_intents
  add column if not exists activity_id uuid references public.friend_activities(id) on delete set null;

create table if not exists public.friend_intent_members (
  intent_id uuid not null references public.friend_intents(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (intent_id, user_id)
);
create index if not exists friend_intent_members_user_idx
  on public.friend_intent_members (user_id, created_at desc);

create table if not exists public.friend_action_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  event text not null check (event in (
    'discovery_viewed', 'intent_created', 'intent_joined', 'intent_closed',
    'community_opened', 'club_joined', 'plan_rsvp'
  )),
  subject_type text,
  subject_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists friend_action_events_created_idx
  on public.friend_action_events (created_at desc);
create index if not exists friend_action_events_funnel_idx
  on public.friend_action_events (event, created_at desc);
create index if not exists friend_action_events_user_idx
  on public.friend_action_events (user_id, created_at desc);

create or replace function public.record_friend_community_open(p_link_id uuid)
returns void language sql security invoker set search_path = '' as $function$
  update public.friend_community_links
  set join_count = join_count + 1, last_joined_at = pg_catalog.clock_timestamp()
  where id = p_link_id and approved = true;
$function$;

alter table public.friend_intents enable row level security;
alter table public.friend_intent_members enable row level security;
alter table public.friend_action_events enable row level security;
revoke all on table public.friend_intents, public.friend_intent_members, public.friend_action_events
  from public, anon, authenticated;
grant all on table public.friend_intents, public.friend_intent_members, public.friend_action_events
  to service_role;
revoke all on function public.record_friend_community_open(uuid) from public, anon, authenticated;
grant execute on function public.record_friend_community_open(uuid) to service_role;
