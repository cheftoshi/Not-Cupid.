# Health fixes release — September 28, 2026 UTC

## Changes

- Signup now requires a signed HttpOnly, SameSite=Strict browser credential,
  bound to the exact email, OTP hash and original expiry. A global verified
  email row cannot authorize another browser. Verification uses a conditional
  update to claim only an unused, unexpired code. Existing account login stays
  on exact normalized email equality.
- New-email verification clears the previous browser session before the quiz.
  Successful signup clears its credential and matching OTP. The existing
  `users_email_unique` constraint ensures concurrent submit requests cannot
  create extra users or sessions. Failed inserts retain the proof for retry;
  existing accounts are never logged in through duplicate signup.
- City balance counts and held-user scans are paginated and exclude test,
  blocked, deleted, disabled and cooldown accounts. Releases recheck those
  conditions and return only IDs actually updated. Small-city seeding stays.
- Profile personality bars/labels stay within 0–100%; stored scores and
  archetypes are unchanged. No unsupported historical-scale inference.
- Unsubscribe footer now accurately states that matching and push settings
  remain unchanged. No email send or campaign activation performed.
- Pending Love invitations display a waiting state, not a writable composer
  or AI openers. Incoming Yes/Pass and mutual chat remain available. The
  profile rail prioritizes profile details with a more compact image, using
  existing app color tokens.

## Release compatibility

No new database migration or environment variable. Reuses the OTP signing
secret and existing email uniqueness constraint. Signups already mid-quiz
without the new credential must verify again; the existing recovery screen
retains answers in memory. No test accounts, notifications or payments are
created by the regression suite.

## Verification

- Typecheck passed.
- 341 unit/behavior tests passed, including handler-level second-browser,
  replay, concurrent submit/verify and account-switch tests; balance pagination
  and write-time exclusion tests; rendered pending/incoming/mutual/closed chat
  tests; bounded personality display and rendered email footer checks.
- Production build passed in an isolated copy with dummy service credentials.
- Bundle budget passed.
- Mobile HTTPS regression suite: all 48 checks passed (1.4 minutes), across
  iPhone WebKit and Pixel Chromium emulation. Dummy-database connection warnings
  in this isolated harness are expected; no production credentials were used.

Physical installed-PWA keyboard/scrolling and actual push delivery are not
certified by browser emulation. Authenticated database journeys still require
controlled test-realm verification; no real-user mutation tests were run.
