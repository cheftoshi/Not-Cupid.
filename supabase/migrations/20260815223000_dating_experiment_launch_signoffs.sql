-- Make every public-launch approval attributable and auditable. Boolean flags
-- remain convenient for the operator UI, but they cannot open an event unless
-- the underlying confirmation details are recorded too.

alter table public.dating_experiment_events
  add column if not exists prize_funding_confirmed_at timestamptz,
  add column if not exists venue_confirmed_at timestamptz,
  add column if not exists venue_confirmation_reference text,
  add column if not exists prize_fulfillment_method text,
  add column if not exists sponsor_details_confirmed_at timestamptz,
  add column if not exists sponsor_legal_name text,
  add column if not exists sponsor_public_mailing_address text,
  add column if not exists legal_review_approved_at timestamptz,
  add column if not exists legal_review_reference text;

-- The operator explicitly confirmed the $400 aggregate funding ceiling on
-- August 15. No venue, Sponsor, or legal approval is inferred here.
update public.dating_experiment_events
set prize_funding_confirmed_at = coalesce(prize_funding_confirmed_at, '2026-08-15T16:00:00Z'),
    terms_version = 'boston-v8-2026-08-15',
    updated_at = now()
where event_key = 'boston-dating-experiment-v1'
  and prize_funding_confirmed is true;

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
      and legal_review_approved and legal_review_approved_at is not null
      and nullif(btrim(legal_review_reference), '') is not null
    )
  );

comment on column public.dating_experiment_events.venue_confirmation_reference is
  'Internal reservation or venue confirmation reference; never return from public APIs.';
comment on column public.dating_experiment_events.prize_fulfillment_method is
  'Exact method and scope for paying the prize, including cap, tax, gratuity, and exclusions.';
comment on column public.dating_experiment_events.sponsor_public_mailing_address is
  'Physical postal address approved for publication in promotion rules and marketing email.';
comment on column public.dating_experiment_events.legal_review_reference is
  'Reviewer or written legal sign-off reference tied to the event terms_version.';
