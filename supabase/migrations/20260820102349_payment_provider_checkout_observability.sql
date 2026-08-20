-- Make the payment funnel honest (click -> provider session -> purchase) and
-- prevent a known provider outage from turning every repeated tap into another
-- failed external request. Only the service role can inspect or change state.

alter table public.monetization_events
  drop constraint if exists monetization_events_event_check;
alter table public.monetization_events
  add constraint monetization_events_event_check
  check (event in (
    'paywall_viewed',
    'checkout_clicked',
    'stripe_session_created',
    'checkout_started',
    'checkout_failed',
    'purchase_completed'
  ));

create table if not exists public.payment_provider_state (
  provider text primary key check (provider in ('stripe')),
  status text not null default 'unknown'
    check (status in ('unknown', 'healthy', 'probing', 'unavailable')),
  failure_code text,
  unavailable_until timestamptz,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  probe_generation integer not null default 0 check (probe_generation >= 0),
  updated_at timestamptz not null default now()
);

insert into public.payment_provider_state (provider, status)
values ('stripe', 'unknown')
on conflict (provider) do nothing;

alter table public.payment_provider_state enable row level security;
revoke all on table public.payment_provider_state from public, anon, authenticated;
grant all on table public.payment_provider_state to service_role;

-- A scalar, row-locked claim lets exactly one request probe an unknown or
-- recently recovered provider. Healthy state stays open for normal traffic.
create or replace function public.claim_payment_provider_request(p_provider text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_state public.payment_provider_state%rowtype;
begin
  insert into public.payment_provider_state (provider, status)
  values (p_provider, 'unknown')
  on conflict (provider) do nothing;

  select * into v_state
  from public.payment_provider_state
  where provider = p_provider
  for update;

  if v_state.status = 'healthy' then
    update public.payment_provider_state
    set last_checked_at = pg_catalog.clock_timestamp(),
        updated_at = pg_catalog.clock_timestamp()
    where provider = p_provider;
    return v_state.probe_generation;
  end if;

  if v_state.status = 'unavailable'
     and v_state.unavailable_until is not null
     and v_state.unavailable_until > pg_catalog.clock_timestamp() then
    return -1;
  end if;

  if v_state.status = 'probing'
     and v_state.last_checked_at is not null
     and v_state.last_checked_at > pg_catalog.clock_timestamp() - interval '30 seconds' then
    return -1;
  end if;

  update public.payment_provider_state
  set status = 'probing',
      unavailable_until = null,
      probe_generation = probe_generation + 1,
      last_checked_at = pg_catalog.clock_timestamp(),
      updated_at = pg_catalog.clock_timestamp()
  where provider = p_provider;
  return v_state.probe_generation + 1;
end;
$function$;

revoke all on function public.claim_payment_provider_request(text) from public, anon, authenticated;
grant execute on function public.claim_payment_provider_request(text) to service_role;

comment on table public.payment_provider_state is
  'Service-only payment availability circuit state. Stores safe codes, never provider payloads or secrets.';
