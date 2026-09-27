# Date-plan lifecycle fixes

## Product rules

- Withdrawn requests can become pending again while an invitation is open and both people's gender preferences match. Host declines cannot be bypassed by requesting again.
- Host acceptance still selects exactly one guest under a database row lock. Everyone else gets a distinct **filled** outcome, not a personal rejection.
- Passed, filled, cancelled and expired requests appear under **Your date updates**. These updates do not reveal the chosen guest or private venue.
- Lifecycle and venue push notices are queued transactionally and checked again before delivery for blocks, deletion, test accounts and stale state. No date-plan email was added.
- Dates can be scheduled up to 60 days ahead. Unfilled discovery closes within 14 days or at the date's start, whichever comes first. Confirmed dates are not ended by discovery expiry.
- Date preferences are free and independent of Love signup/payments. Explicit date preferences override existing stated Love preferences for this feed only. Missing preferences are requested, never guessed.
- Confirmed venue edits create a private conversation note and queue a guest notification. Cancelled venues cannot be edited.
- Cancelled chats remain read-only for the original pair. Reporting, blocking and account deletion still remove access.
- Database request reads are limited to the viewer's own history and pending requests on plans they host.
- Optional floating install prompts pause during page interaction/scrolling so they cannot cover Home actions. The app menu can reopen them.

## Verification

- Policy behavior: `tests/date-plan-lifecycle.test.mjs`.
- Transactional SQL behavior: `tests/date-plan-lifecycle.sql`, with synthetic test accounts inside an explicit rollback transaction. It checks retries, withdrawal recovery, reciprocal preference enforcement, exactly-one acceptance, closure notifications, venue update idempotency, cancellation and RPC permissions.
- Mobile behavior: `e2e/authenticated-mobile.spec.ts`, using mocked mutations and an isolated synthetic-account session. Checks free creation, re-requesting, filled outcomes, preferences, private chat retries and read-only archives on iPhone WebKit and Pixel Chromium.
- Release gates: typecheck, unit suite, production build, bundle budgets, mobile suite, migration ledger, GitHub CI and production deployment status.
- Browser emulation does not certify physical installed-PWA behavior or device push receipt. Those still need a real-device check.

Local release checks on September 27, 2026: 270 unit tests and 82 mobile tests passed. Typecheck, production build and client bundle budgets passed. Migration `20260927224907` is present in the linked migration ledger; installed-function rollback checks passed. The first mobile run exposed a floating install prompt covering Home's refresh control; the prompt was fixed and the full suite rerun successfully. Temporary test sessions were removed.

## Repository housekeeping

The invalid local `refs/heads/main 2` pointed to a valid ancestor commit. Its commit was preserved as `refs/archive/recovered-main-2`, and the original ref file moved to `.git/main-2.recovered`. The Desktop source snapshot was left untouched; it is not a second Git checkout. The canonical working repository remains this `not-cupid` directory.
