# October 2 audit remediation

This release addresses the findings in `security-and-operational-audit-2026-10-02.md`.

## Changes

- Next.js 16.3.6 and brace-expansion 5.0.12; dependency audit is now enforced in CI.
- Shared reported/blocked/deleted/realm eligibility for Love messages, typing,
  coaching, Friend roster and packs. A new database trigger closes both lines
  on a pair report. Historical reported pairs are repaired without deleting
  message evidence. Terminal chats have no live presence.
- Database message guards serialize Love sending against ending/reporting and
  Friend DMs against Friend safety transitions. Local Postgres tests exercise
  both directions and eligibility failures; these are not a distributed load test.
- Message insertion atomically persists an outbox job for Love, Friend DMs,
  crew, clubs, plans and date chats. No historical message replay is performed.
  Date messages use the same retry worker as other notifications. Delivery
  rechecks date state and Love pair eligibility, including reports.
- Deactivation atomically schedules service-only billing/media cleanup. Immediate
  best-effort cleanup remains; an idempotent leased worker retries interruptions
  and failures independently, with exponential backoff and dead-job visibility
  in Admin. This does not retroactively queue all historical deleted accounts.
- City weekly activity now uses deduplicated session/client activity rather than
  the legacy users.last_seen_at field, still excluding ineligible accounts.

## Deployment order and rollback

Run typecheck, tests, production build and public mobile checks. Apply only
`20261002121037_audit_safety_delivery_cleanup.sql` using the documented linked
Supabase dry-run/push/list flow, then push the application to main. The database
triggers are compatible with the old application's idempotent outbox upserts.
Roll back the app deployment if required; never roll back or edit applied SQL.
Any database correction requires another forward migration.

## Remaining verification gates

Local release checks passed: 361 tests, TypeScript, production build, 48 public
HTTPS mobile browser checks, client bundle budget, and npm audit (zero reported
vulnerabilities). The linked migration push succeeded; its optional local Docker
catalog cache was unavailable, which does not roll back the remote migration.

- Authenticated staging workflow is provided in `authenticated-release.yml`.
  Configure the staging environment's `E2E_BASE_URL` variable and expiring
  `E2E_TEST_SESSION` secret, then dispatch it. Its preflight refuses production
  notcupid.com hosts and requires `is_test=true`. It is not claimed as a passing
  production/authenticated gate until those credentials exist and the run passes.
- Verify installed iPhone/Android push delivery and scrolling on physical devices.
- No real billing cancellation, real account deletion, email send, or customer
  message was used as a test. The security researcher's underlying report remains
  unknown until they supply reproduction details. No “zero vulnerabilities in the
  entire app” or penetration-test certification is implied by the dependency audit.

## Operator recovery

Admin displays queued/processing/retry/completed/dead cleanup counts. Inspect dead
jobs in the service-only `account_cleanup_jobs` ledger. Confirm the account is
still deleted and resolve the provider/storage error before deliberately resetting
its status to queued and available_at to now. Preserve billing_done/media_done;
never resurrect a deleted account merely to retry cleanup. Lease tokens prevent
a stale worker from completing another worker's job. No cleanup worker sends email.
