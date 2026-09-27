# Security, billing, and safety batch

## Scope and release boundary

Three ordered commits, one per requested group. Application changes are local:
do not push automatically because main auto-deploys. The operator authorized
production migration application only, not application calls, payment calls,
notifications, email, or deployment.

## Group 1 — urgent security

1. OTP and admin email correction use exact lowercased email equality. Runtime
   route tests distinguish underscore/percent addresses from wildcard matches.
2. New migration enables RLS and revokes public, anon, and authenticated table
   access to rate_limits and stripe_events; service_role retains access.
   Local PostgreSQL checks exercise consume_rate_limit and claim_stripe_event.
3. Friend blast, quiz blast, and press invite routes are archived with HTTP 410.
   Query parameters cannot reactivate them; no sender code remains in the routes.

Checks: typecheck, 282 passing unit tests, build, local PostgreSQL checks.
Commit: b0cada3.

## Group 2 — money and privacy

4. Authenticated Billing Portal endpoint and Manage subscription controls on
   Pro and profile settings. Direct cancel-renewal endpoint is a fallback if
   the portal is not configured. Neither accepts a caller-supplied customer
   or subscription identifier.
5. Account deletion rechecks the subscription after deactivation, attempts
   cancellation, logs failure without secret details, and warns if cleanup
   remains pending. Deletion itself is not blocked by a Stripe outage.
6. Checkout refuses linked subscriptions; database claims serialize a stable
   Stripe idempotency key across tabs. Webhook binding cannot overwrite another
   subscription, attach one to a deleted account, or silently orphan a duplicate.
7. Deletion removes owner-scoped profile photo and video storage objects.
   Photo replacement cleans up the previous owned photo unless still referenced
   by the gallery, and cleans up failed uploads. Match profiles fail closed on
   deletion, blocking, either-direction reports, or unavailable report checks.

Checks: typecheck, 291 passing unit tests, build, local PostgreSQL checkout and
binding checks. Commit: 936db1b.

Live Stripe configuration, real cancellation, and refund handling have NOT been
exercised. No historical subscriptions or previously deleted accounts were
modified. Cleanup failures are logged for follow-up; there is no new retry worker.

## Group 3 — safety

8. Ending a Love connection is one locked database transition. Ghost strikes
   require mutual acceptance at least 24 hours earlier and zero target messages.
   Closed matches and duplicate calls do not produce another strike. Message
   insertion locks the same match, serializing a reply against ending. Historic
   active matches have an intentionally conservative migration-time baseline
   because their actual mutual-acceptance timestamp was not recorded.
9. Friend DM, crew, club, and plan chat report controls call an authenticated,
   rate-limited endpoint. Database membership validation precedes writing the
   report, disconnecting the pair, and recording no-repeat history. Both parties'
   shared-chat messages become hidden from each other; Friend pushes between
   reported pairs are skipped, not delivered. Reports never notify the target.
10. Friend matching excludes blocked accounts and reports in either direction.
    A database write guard also rejects blocked, reported, and declined pairs.
    Profile refresh preserves declined Friend connections and all Friend history.
11. Core quiz scores clamp to 0–8; archetype caps at 80 characters. Both quiz
    endpoints reject malformed or over-5000-character vibes/values objects before
    writing. Love-deep remains non-destructive: it cannot overwrite core scores.

Checks: typecheck, 303 passing unit tests, build, local PostgreSQL eligibility,
terminal-state, report-context authorization, idempotence, test-account exemption,
three-strike escalation, and reentry guard checks.

## Migrations

- 20260927233447_security_internal_table_rls.sql
- 20260927233712_billing_checkout_serialization.sql
- 20260927234152_atomic_safety_reports_and_ghost_eligibility.sql

Each change is a new forward migration, applied only through the documented
linked dry-run, push, and ledger-confirmation flow. No applied historical
migration is edited.

## Follow-up before calling the application release live

- Operator authorization to push/deploy the three commits.
- Verify configured Billing Portal and cancellation in Stripe test mode.
- Real-device Friend reporting/UI checks and installed-PWA regression.
- Separate authorization for any production application checks or historical
  billing/storage cleanup. No email or notification test is authorized.
