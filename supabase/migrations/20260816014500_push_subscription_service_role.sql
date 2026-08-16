-- Push subscriptions are written only by authenticated server routes through
-- the service-role client. RLS bypass alone does not provide table privileges,
-- so grant the service role the explicit CRUD rights it needs while keeping
-- browser roles denied.

alter table public.push_subscriptions enable row level security;

revoke all on table public.push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to service_role;
