# NotCupid agent handoff

Read `AGENTS.md` completely before working in this repository. It is the single
canonical current-state handoff for all coding assistants and was reconciled
with the application and linked production state on August 19, 2026.

Do not infer current Dating Experiment dates or rules from older commits,
`supabase/legacy-migrations/`, `supabase/apply-all.sql`, or an earlier applied
migration. Those files are immutable history. Current event configuration lives
in `lib/raffle.ts`; mutable operational state lives in the linked production
database; the newest forward migration wins when migrations supersede one
another.

Publicly the feature is the **NotCupid Dating Experiment**. Legacy `raffle`
identifiers remain internal for compatibility and are not current public
terminology.

The current Boston event is closed to new entries. Do not interpret the
internal `RAFFLE.featureEnabled` feature flag as permission to reopen the expired
entry window; the database event row and exact deadline are authoritative.
