-- The verified Resend webhook archives an inbound message before forwarding it.
-- RLS was already enabled, but the service role did not have the underlying
-- INSERT privilege, so valid replies to match@notcupid.com returned HTTP 500.
-- Keep browser roles denied and grant only the operation the server route uses.

revoke all on table public.inbound_messages from anon, authenticated;
grant insert on table public.inbound_messages to service_role;
