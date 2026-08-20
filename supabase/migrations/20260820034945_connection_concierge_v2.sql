-- Hub Connection Concierge v2
--
-- Durable memory is deliberately small, structured, and user-confirmed. The
-- raw Hub conversation remains device-only and is never written here. Users
-- can inspect and delete every memory from the Hub AI controls.

create table if not exists public.connection_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  category text not null check (category in (
    'goal', 'preference', 'boundary', 'availability', 'location',
    'coaching_style', 'current_context'
  )),
  memory_key text not null check (char_length(memory_key) between 1 and 80),
  memory_value text not null check (char_length(memory_value) between 1 and 240),
  source text not null default 'user_confirmed'
    check (source = 'user_confirmed'),
  expires_at timestamptz,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, memory_key)
);

create index if not exists connection_memories_user_active_idx
  on public.connection_memories (user_id, updated_at desc);
create index if not exists connection_memories_expiry_idx
  on public.connection_memories (expires_at)
  where expires_at is not null;

alter table public.connection_memories enable row level security;
revoke all on table public.connection_memories from public, anon, authenticated;
grant select, insert, update, delete on table public.connection_memories to service_role;

comment on table public.connection_memories is
  'Small user-confirmed facts for optional AI connection support. Never stores raw conversation text.';
comment on column public.connection_memories.memory_value is
  'A user-visible, user-confirmed value that can be removed from Hub AI controls.';
