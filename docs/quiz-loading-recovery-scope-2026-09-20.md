# Quiz loading recovery: scope and acceptance

## Evidence and boundary

Production recorded one network-classified unhandled promise rejection on
`/quiz` at September 19, 2026, 8:15 p.m. Eastern. The event has no request URL
or source location; it does not prove which request failed or that answers
were lost. Code review found unguarded profile requests in retake and Love
setup. This repair closes that reproducible gap without claiming to have
identified the historical request conclusively.

## Work items

- Share a profile loader across signup detection, baseline retake and Love setup.
- Limit the complete profile read, including body parsing, to 12 seconds.
- Cancel outstanding reads on navigation and ignore stale responses.
- Distinguish confirmed HTTP 401 from network errors, rate limits and server failures.
- Reject invalid successful payloads rather than starting with missing profile data.
- Show an accessible loading/retry state; do not falsely restart signup on failure.
- Retry only the profile read. Do not clear answers, change saved profiles,
  send email, invoke AI or automatically repeat a submission.
- Retain the existing quiz destination through genuine sign-in expiry, and
  retain referral/next parameters when routing an existing signup visitor to retake.
- Test network rejection, HTTP failures, invalid JSON/data, request/body timeout,
  cancellation, retry recovery and signed-out entry.
- Verify iPhone WebKit and Android Chromium against a production build;
  run the unit suite/typecheck/build before commit and deployment.

## Excluded

No changes to matching, payments, email policy, quiz scoring, schema or customer
records. No claim of persistent draft recovery after a browser restart. The
retry occurs before questions are unlocked and does not reset component state.

## Acceptance

Failure leaves the visitor on a clear retry screen, not an unhandled exception
or a misleading login redirect. A successful retry opens the correct quiz.
Only 401 leads to sign-in. The public signup path remains available for a
confirmed signed-out visitor. Test fixtures intercept API traffic and never
submit quiz answers or send messages to real people.
