-- Self-identification so "LGBTQ+" audiences/seeking can be gated accurately
-- (we don't collect orientation, so inferring from gender wrongly excluded
-- e.g. a gay man). null = unset (falls back to the gender signal in code).
alter table users add column if not exists is_lgbtq boolean;
