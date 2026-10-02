# NotCupid security and operational audit — October 2, 2026

## Release outcome

Session fix `d666396d034a2d9d66bf9fe69eec8960edf638e9` is committed and pushed
to main. Vercel production deployment `6807517691` reports success. Post-release
login returns 200 and signed-out messages return 401. Typecheck and 345 tests
passed again before committing; the unchanged patch's production build had
already completed successfully. GitHub run `37002010218` completed successfully:
both verify and mobile-smoke passed, including the HTTPS public mobile tests.

The fix removes stored-hash authentication and logout fallbacks and rejects
invalid/expired sessions. A read-only database count found zero unexpired
non-version-1 sessions: no expected forced login for ordinary current sessions.

## Scope and limitations

Broad code and operational review, not a penetration-test certification. Scope:
authentication/signup/session handling, privileged route boundaries, Love and
Friend reporting/message access, date-plan access, deletion/media/billing,
webhooks/cron/email, AI wrapper, dependency advisories, CI and public endpoints.
Route inventory includes 135 tracked API route files; inventory and screening
do not mean every handler/branch received an exhaustive manual review.

Evidence combines source and migration review, existing automated tests,
synthetic local handler execution, public HTTP requests, and narrowly scoped
read-only database checks. No real user's conversation was accessed; no email,
payment, report, block, signup or destructive production test was performed.
No exploit payload was sent to production. No new migration was required.

Not covered: independent forensics, every live database policy/function against
its migration source, authenticated physical-device journeys, actual push inbox
delivery, real Stripe charge/refund/cancellation, or the researcher's undisclosed
finding. There is no evidence from these checks establishing a breach.

## Prioritized findings

### 1. P1 — Update Next.js: newly published critical dependency advisory

Installed Next.js is 16.3.4. The October 2 npm audit flags it against
[GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j), whose
patched version is 16.3.6. The advisory requires attacker-controlled values in
Node ImageResponse SVG content/attributes/styles. All five app ImageResponse
sources inspected use fixed text/styles or values selected from static city/type
definitions, not arbitrary user text. **Affected package confirmed; an exploitable
NotCupid input path was not established.** Do not describe this as proven RCE.

Upgrade to a patched release in a separate tested patch. Verify every OG route,
all six type slugs and production build. Avoid adding arbitrary profile/plan
content to these image routes before the upgrade. The previous zero-vulnerability
result is historical, not current; the advisory database was updated September 30.

Full audit also reports five high-severity package nodes along Capacitor CLI's
rimraf → glob → minimatch → brace-expansion chain. These are development/native
tooling dependencies, not five independent demonstrated production exploits.
Review compatible upgrades/overrides and native sync separately; do not run a
blind force-update. Source: the npm audit captured during this review, with
[brace-expansion advisory](https://github.com/advisories/GHSA-qhr7-859c-m2p7).

### 2. P1 — Pair reporting is not consistently enforced across connection types

`report_friend_context` inserts a pair report and declines the Friend connection
but does not terminate an existing Love match. `app/api/messages/route.ts` POST
checks membership and terminal match state; when already mutual it does not
recheck pair reports. The current `guard_love_message_end` SQL trigger checks
membership, terminal state and mutual acceptance, but not reports. Consequently,
a pre-existing mutual Love relationship can remain writable after a Friend
report under the reviewed code/migration contract. The profile page, by contrast,
checks pair reports and denies profile access.

Fix with shared server-side pair eligibility plus database write-time report
enforcement, with a new migration and concurrency tests. Test Friend→Love and
Love→Friend exclusions, both reporting directions, and simultaneous send/report.
This is source-supported; no live report or live message was created to test it.

### 3. P2 — Reported Love history and presence remain accessible through API

`app/api/messages/route.ts` GET verifies match ownership but not reports or the
other participant's current eligibility. A local synthetic execution returned
HTTP 200, one synthetic message and typing metadata for a match already ended
with reason `reported`, without querying `user_reports`. The typing POST similarly
checks only membership and can update an ended relationship.

Decide explicitly what safety archives expose. Existing history may have a
legitimate evidence-retention purpose; it must not imply live presence access.
Block typing/read-presence updates for terminal or reported relationships and
align API/profile access. Never delete evidence merely to hide a conversation.

Friend roster/pack reads also lack direct blocked/deleted/report filters. The
normal admin-block and deletion SQL already declines Friend connections, so
this is **defense-in-depth/stale-state risk**, not proof those flows currently
leak profiles. Revalidate eligible peers at read time and fail closed on errors.

### 4. P1 reliability — Notification enqueue failures can be silently lost

The outbox enqueuers in `lib/notification-outbox.ts` return false on database
failure. Message handlers such as `app/api/messages/route.ts` await the enqueue
but ignore its Boolean result, then return success. If the message insert succeeds
and the subsequent job insert fails, the cron cannot retry a job that never
existed. This is distinct from provider delivery retries, which the outbox handles.

Persist message and notification intent atomically, or create a durable recovery
mechanism keyed by message ID. Add a test for a failed job insert after a successful
message insert. Do not solve this by resending arbitrary user messages or emails.

### 5. P2 — Failed deletion cleanup has no durable retry workflow

`app/api/profile/delete/route.ts` deactivates first, then attempts subscription
cancellation and storage cleanup. Failure is logged and returned as cleanupPending;
the profile UI tells the user to contact support. The corresponding failure codes
appear only in that handler; no durable cleanup job/retry path was found.

This can leave billing or public storage objects pending after a transient failure.
Add an idempotent cleanup ledger/worker, backoff and an operator alert/status. Keep
deactivation immediate. Verify Stripe cancellation and storage deletion independently.
No actual failed cancellation or exposed deleted image was demonstrated in production.

### 6. P2 — CI does not enforce dependency or authenticated-journey checks

Current CI runs typecheck/tests/build/bundle budget and public mobile smoke tests,
but not npm audit or the authenticated release test suite. The fresh dependency
advisory can therefore coexist with green CI. Add a maintained vulnerability gate
with explicit, time-bounded exceptions, and a synthetic-account authenticated
release gate. Physical Android/iOS PWA behavior remains a separate device test.

## Controls that passed or were present

| Area | Evidence and qualification |
|---|---|
| Authentication | Exact normalized email lookup; signed browser-bound signup proof; atomic OTP claim; session regression tests pass |
| Anonymous database access | Head/count requests returned zero visible rows for users, sessions and messages; OTPs, reports, rate_limits and stripe_events returned permission denied. This checks these reads, not every table or privilege |
| Account safety | Block/deletion procedures revoke sessions and retire matching state; deleted/blocked accounts fail session reads |
| Admin routes | Reviewed routes use admin allowlist/auth checks; production signed-out admin stats and reports return 403 |
| Public app | Home/login/quiz/FAQ/terms/privacy/law-enforcement/Pro/NYC/Providence all returned 200 |
| Protected app | Signed-out profile/messages/Friend roster/Friend DM/date plans returned 401 |
| Browser headers | Checked responses carry DENY framing and nosniff; proxy also defines CSP/HSTS and cookie-mutation origin checks |
| Payments | Checkout uses a DB claim and idempotency key; billing portal derives customer from authenticated user; webhook verifies signature before parsing and atomically claims event |
| Uploads | Profile upload bounds file size, inspects image signatures, generates owner-scoped random paths and uses conditional profile replacement; image signature inspection alone is not full content moderation |
| Date plans | Access helper rechecks membership/metro/realm/adult eligibility, blocked/deleted people and pair reports; no new issue confirmed in the inspected access path |
| Notifications | Stale skips are distinct from delivery; provider retries exist; enqueue persistence gap remains above |
| AI | Server-side wrapper uses bounded timeouts and structured output with store:false; this is code inspection, not an adversarial model evaluation |
| Secrets | No .env files listed in tracked repository paths; this was not a complete historical secret scan |

## Recommended next batch

1. Upgrade Next.js to the patched version and recheck dependencies/OG pages.
2. Apply pair-safety checks across Love/Friend reads, writes and typing; protect
   the write boundary atomically, with a forward-only migration.
3. Make notification intent durable with the message write.
4. Add deletion-cleanup retries and operator visibility.
5. Add dependency/authenticated CI gates and run physical-device acceptance checks.

Only the authorized session patch was shipped in this turn. The findings above
are the next remediation plan, not claims that those fixes have been implemented.
