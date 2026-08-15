-- Replace the self-imposed outside-counsel launch gate with the dated operator
-- compliance approval requested by the NotCupid operator. The event row is
-- opened only to support the server-enforced, email-allowlisted admin rehearsal;
-- the public code gate remains false until the iPhone/PWA walkthrough passes.

alter table public.dating_experiment_events
  drop constraint if exists dating_experiment_entry_open_signoffs_check;

alter table public.dating_experiment_events
  rename column legal_review_approved to operator_compliance_approved;
alter table public.dating_experiment_events
  rename column legal_review_approved_at to operator_compliance_approved_at;
alter table public.dating_experiment_events
  rename column legal_review_reference to operator_compliance_reference;

alter table public.dating_experiment_events
  add constraint dating_experiment_entry_open_signoffs_check
  check (
    status <> 'entry_open'
    or (
      prize_funding_confirmed and prize_funding_confirmed_at is not null
      and venue_confirmed and venue_confirmed_at is not null
      and nullif(btrim(venue_confirmation_reference), '') is not null
      and nullif(btrim(prize_fulfillment_method), '') is not null
      and sponsor_details_confirmed and sponsor_details_confirmed_at is not null
      and nullif(btrim(sponsor_legal_name), '') is not null
      and nullif(btrim(sponsor_public_mailing_address), '') is not null
      and operator_compliance_approved and operator_compliance_approved_at is not null
      and nullif(btrim(operator_compliance_reference), '') is not null
    )
  );

update public.dating_experiment_events
set operator_compliance_approved = true,
    operator_compliance_approved_at = now(),
    operator_compliance_reference = 'NotCupid operator approval of boston-v11-2026-08-15 recorded 2026-08-15',
    status = 'entry_open',
    updated_at = now()
where event_key = 'boston-dating-experiment-v1'
  and status = 'draft'
  and terms_version = 'boston-v11-2026-08-15';

comment on column public.dating_experiment_events.operator_compliance_reference is
  'Dated operator compliance approval tied to the exact event terms_version.';
