-- Fix: date_feedback existed in prod (early partial run) WITHOUT the rating
-- columns, so the later `create table if not exists` was skipped and never
-- added them. The admin date-feedback panel errors on date_feedback.rating.
-- Patch the existing table explicitly. Nullable (can't add NOT NULL to a table
-- that may have rows without a default); the API already validates rating 1-5.

alter table date_feedback add column if not exists rating int;
alter table date_feedback add column if not exists would_again boolean;
alter table date_feedback add column if not exists notes text;
alter table date_feedback add column if not exists created_at timestamptz not null default now();
