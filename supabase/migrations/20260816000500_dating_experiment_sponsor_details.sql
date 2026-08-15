-- Record the operator-confirmed public Sponsor identity and postal address for
-- the August 20 Boston Dating Experiment. Legal review and entry status remain
-- independent fail-closed gates.
do $$
begin
  update public.dating_experiment_events
  set sponsor_details_confirmed = true,
      sponsor_details_confirmed_at = coalesce(sponsor_details_confirmed_at, now()),
      sponsor_legal_name = 'Lemon Labs',
      sponsor_public_mailing_address = '109 California Ave, Quincy, MA 02169',
      updated_at = now()
  where event_key = 'boston-dating-experiment-v1'
    and status = 'draft'
    and terms_version = 'boston-v11-2026-08-15';

  if not found then
    raise exception 'Boston Dating Experiment sponsor update requires the v11 draft event';
  end if;
end
$$;
