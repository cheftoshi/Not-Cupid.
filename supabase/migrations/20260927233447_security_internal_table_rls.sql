begin;
alter table public.rate_limits enable row level security;
alter table public.stripe_events enable row level security;
revoke all on table public.rate_limits, public.stripe_events from public, anon, authenticated;
grant all on table public.rate_limits, public.stripe_events to service_role;
-- Existing service-only invoker RPCs retain access through service_role BYPASSRLS.
commit;
