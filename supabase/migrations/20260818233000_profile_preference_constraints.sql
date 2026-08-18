-- Bring the database contract in line with the profile/onboarding contract.
-- The previous checks only allowed men seeking women and women seeking men,
-- which made "anyone" and non-binary/another-identity saves fail with a 500.

alter table public.users
  drop constraint if exists users_gender_check,
  drop constraint if exists users_seeking_check;

alter table public.users
  add constraint users_gender_check
    check (gender in ('m', 'f', 'nb', 'o', 'b')),
  add constraint users_seeking_check
    check (seeking in ('m', 'f', 'b', 'both'));

comment on constraint users_gender_check on public.users is
  'Matches the gender values accepted by profile and onboarding APIs.';
comment on constraint users_seeking_check on public.users is
  'Supports one-gender and anyone/both Love preferences; b is canonical.';
