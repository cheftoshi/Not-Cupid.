# Supabase migration workflow

## Reading current state

Migration files are an immutable timeline, not a current product manifest. An
older Dating Experiment migration may still contain retired event dates,
deadlines, limits, or terms versions. Do not edit an applied migration to remove
those historical values.

As of August 19, 2026, current code is `lib/raffle.ts`, current mutable state is
the linked production event row, and the latest deadline override is
`20260819042500_close_dating_experiment_entry_window.sql`. The live Boston
event closed Tuesday, August 18 at 11:59 PM ET and has two dinner slots on
Thursday, August 20 at 6:30 PM and 8:30 PM ET.

Production was originally maintained by running the dated SQL files manually.
Those files used date-only prefixes, including duplicate versions, so they
cannot safely remain in the CLI migration directory.

## Baseline

- `migrations/20260804190000_remote_baseline.sql` is the consolidated,
  idempotent production baseline. Its version matches the baseline row already
  present in `supabase_migrations.schema_migrations` on production.
- `legacy-migrations/` preserves every pre-baseline SQL file for audit and
  reference. Never run that directory with `db push`.
- `apply-all.sql` remains a historical recovery reference. New changes belong
  in timestamped CLI migrations and should not be appended there.

## New schema change

```sh
supabase migration new short_description
# edit the generated SQL
supabase db push --linked --dry-run
supabase db push --linked
supabase migration list --linked
```

Use the CLI-generated 14-digit timestamp. Never reuse a version and never make
production schema changes directly in the Dashboard SQL or Table editor.
Coordinate production pushes so only one person runs `db push` at a time.
Never rewrite an applied migration to make its data look current; create a new
forward migration that supersedes it.

## Safety

Before a baseline or high-risk migration, retain:

1. an archive of `legacy-migrations/`, `apply-all.sql`, and base schema files;
2. a production schema or Data API contract snapshot;
3. the output of `supabase migration list --linked`.

Always dry-run first. Do not use `--include-all` to bypass a history mismatch;
investigate and repair the ledger deliberately instead.
