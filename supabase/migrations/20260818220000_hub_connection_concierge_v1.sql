-- Hub Connection Concierge v1
--
-- The direct user message is deliberately not retained in these tables. The
-- first release stores the declared intent category, the bounded recommendation,
-- its versioned reasons, and the user's downstream action so the product can
-- learn from human outcomes without building a hidden transcript/dossier.

alter table public.users
  add column if not exists ai_concierge_consent_version text,
  add column if not exists ai_concierge_consent_at timestamptz,
  add column if not exists ai_concierge_consent_revoked_at timestamptz;

create table if not exists public.connection_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  intent text not null check (intent in ('love', 'friendship', 'plan', 'community', 'travel', 'profile', 'general')),
  source text not null default 'hub_concierge' check (source in ('hub_concierge', 'friend_signal', 'operator')),
  city_label text,
  status text not null default 'active' check (status in ('active', 'completed', 'dismissed', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists connection_intents_user_created_idx
  on public.connection_intents (user_id, created_at desc);
create index if not exists connection_intents_active_idx
  on public.connection_intents (user_id, expires_at desc)
  where status = 'active';

create table if not exists public.concierge_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  intent_id uuid references public.connection_intents(id) on delete set null,
  surface text not null default 'hub',
  action_type text not null check (action_type in (
    'open_profile', 'open_core_quiz', 'open_love_setup', 'open_love_roster', 'open_match',
    'join_friend_line', 'open_friend_home', 'open_friend_pack', 'open_friend_chat',
    'open_friend_plan', 'open_friend_scene', 'open_communities', 'open_travel', 'none'
  )),
  target_type text not null check (target_type in ('love_match', 'friend_connection', 'friend_plan', 'route')),
  target_id text,
  reason_codes text[] not null default '{}',
  confidence_band text not null check (confidence_band in ('low', 'medium', 'high')),
  response_copy text not null,
  cta_copy text,
  source text not null check (source in ('ai', 'curated')),
  eligibility_version text not null,
  ranker_version text not null,
  explanation_version text not null,
  shown_at timestamptz not null default now(),
  acted_at timestamptz,
  dismissed_at timestamptz,
  outcome_state text check (outcome_state is null or outcome_state in ('acted', 'dismissed', 'completed', 'reciprocal', 'expired')),
  outcome_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists concierge_recommendations_user_created_idx
  on public.concierge_recommendations (user_id, created_at desc);
create index if not exists concierge_recommendations_action_created_idx
  on public.concierge_recommendations (action_type, created_at desc);
create index if not exists concierge_recommendations_open_outcome_idx
  on public.concierge_recommendations (expires_at)
  where outcome_state is null;

alter table public.connection_intents enable row level security;
alter table public.concierge_recommendations enable row level security;

revoke all on table public.connection_intents from public, anon, authenticated;
revoke all on table public.concierge_recommendations from public, anon, authenticated;
grant select, insert, update, delete on table public.connection_intents to service_role;
grant select, insert, update, delete on table public.concierge_recommendations to service_role;

comment on table public.connection_intents is
  'Structured, expiring user intent categories. Raw Hub concierge messages are not stored.';
comment on table public.concierge_recommendations is
  'Versioned Hub concierge decisions and outcome measurements; contains no raw user prompt.';
