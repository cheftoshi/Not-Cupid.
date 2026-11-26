# Friend discovery editions — review only

Current review versions: ideas `friend-discovery-review-v1-2026-11-15`;
Friday `friend-discovery-friday-copy-v2-2026-11-26`.
This replaces the earlier single-Friday proposal. There is no scheduler, recurring
sender, campaign activation, consent migration, or change to existing send gates.

## Review workflow

`POST /api/admin/friend-discovery-prepare` accepts only `edition` (`ideas` or
`weekend`) and `revision` (1–20, default 1). It requires a dedicated short-lived
`FRIEND_DISCOVERY_PREPARE_TOKEN` and `FRIEND_DISCOVERY_PREPARE_EXPIRES`. These are
preparation credentials, never send authorization. Proposed cadence is a weekly
ideas edition plus a Friday weekend edition; exact day/time/windows remain unset.

The builder writes only immutable `friend_announcement_drafts`, using an Eastern
Monday-based week/edition/revision ID. Existing storage privileges, hashes and
unique IDs supply persistence, concurrent-request protection and retry recovery.
A retry returns the exact frozen artifact; changed content needs a new revision.
Drafts expire after six hours. Expired drafts remain reviewable, marked expired,
and cannot be silently refreshed. No new migration is needed.

The distinct `friend_discovery_review` purpose is rejected by existing member
executors even if their existing activation flags are set. No campaign rows,
delivery claims, approval timestamps, provider requests or push jobs are created
by member preparation. Owner preparation uses the already-established isolated
owner path, which may make its existing read-only suppression check.

## Inventory and copy

- Up to two actually eligible, explicitly Boston member plans first; up to three
  cards total. Outside events fill remaining places. No catalogue cap is added.
- Plans must have capacity, a valid host, correct realm, no reports involving the
  recipient and participants, suitable stated audience, and future expiry/time.
  Already responded-to plans and the recipient's own plans are excluded. Flexible
  plans are explicitly labeled. Private venues, participant identities, profile
  text and message text are never included.
- The full existing moderated catalogue is refreshed before preparation. Curated
  sources must have been checked within three days. Outside-event-linked plans
  require a currently valid event with the same start instant. Missing, stale,
  blacklisted or time-changed sources fail closed.
- Ideas cover the next week; weekend covers the current Friday–Sunday window.
  Selection varies categories deterministically, without inferred interests,
  psychological profiling or a claim of personal taste ranking.
- Outside events are clearly labeled as ideas around which members can start a
  plan, never existing joinable NotCupid plans. Admission remains separate.
- Ideas retain per-card signed links binding bounded plan/event destinations.
  Friday uses one signed main discovery link (`/hub?discover=1`), with organizer
  details as secondary source links. Old campaign links
  still open discovery. Only accepted-delivery links create attribution cookies;
  forwarded links still cannot attribute another member. Scanner requests are
  not authenticated returns or meaningful actions.

### Approved Friday structure

The November 26 copy approval covers the Friday template only, not activation,
scheduling, a second email or audience changes. Subject: “What’s happening near
you this weekend?” Greeting uses the first name (“Hey Sam,”), or “Hey there,”
when absent. Opening: “Curious what’s happening near you this weekend? Here are
a couple of things worth stepping out for:” A compact list shows verified time,
public area/venue and a plan-or-outside-event one-liner. Outside events have no
separate neighborhood field, so use their public venue without guessing one.
Closing: “Pick your vibe. Find a plan nearby or someone to go with.” The sole
main CTA is “See what’s happening on NotCupid →”. Organizer/admission notes,
sender, business address and unsubscribe remain. HTML escapes dynamic text.
Existing frozen Friday drafts with an older copy version are rejected; prepare a
new revision for review instead of mutating them. Ideas copy is unchanged.

## Audience, overlap and repetition

The preliminary review cohort requires adult, real, non-admin, non-blocked,
non-deleted Friend members with global email enabled, notifications unpaused,
explicit existing Friend email opt-in and active Boston discovery. Selected city
wins over eligible travel, then home metro. Unknown eligibility or read failure
blocks preparation. Local suppressions always apply. The provider must separately
recheck suppression before any future approved send; review counts are not final
send counts. Authorized recipients are always zero in this implementation.

**Existing consent says at most once a week per channel.** This release does not
reinterpret it as permission for twice-weekly email or enroll anyone. New consent
wording/version, audience policy and send authorization remain mandatory decisions.

The proposed review selection applies a conservative 72-hour campaign spacing
filter, while leaving existing production seven-day send gates unchanged. A
recipient with current qualifying daily activity, a queued/sent daily email in the
last 24 hours, or today's activity-digest marker is skipped. The daily digest is
not modified or consolidated. Since historical daily records lack item IDs, a
recipient with a daily plan section in the last seven days receives no member-plan
recommendations here; outside ideas can remain eligible if the recipient otherwise
passes overlap checks.

Recommendation keys from any delivery claim in the last 30 days prevent repeated
plan/event recommendations across discovery editions. A linked plan also suppresses
its original event; a prior event suppresses the linked plan. Preview drafts with
no delivery claim do not consume recommendations. Uncertain/failed claims are
conservatively treated as history until reconciled. Actual retry execution is not
implemented or authorized here; the existing sender's uncertain-outcome stop rule
must not be bypassed by a new revision.

## Owner review and approvals still required

The exact configured Yahoo owner path prepares a separate copy from the frozen
source. It keeps bounded plan/event destinations, replaces member attribution
with direct links, and uses the owner's global unsubscribe. The pinned address,
admin exclusion, preference/suppression checks, owner ledger and separate
content/send gates remain intact. A missing or suppressed owner is a blocker,
never a BCC or substitute recipient. No owner copy is sent by preparation.

Before production sending can exist, review:

1. Exact weekly-ideas day and ET time; Friday ET time; short windows and no late
   catch-up; two-edition frequency and spacing policy.
2. Explicit twice-weekly consent and audience scope; provider email-reuse permission.
3. Exact fresh per-recipient rendered body, sender, reply-to, all links and footer,
   owner copy, and final suppression-checked count. Content approval is separate
   from exact send/standing scope approval.
4. A separately reviewed recurring executor with atomic per-member/week/edition
   and daily-overlap claims, immediate safety/capacity/freshness rechecks, bounded
   retries only for proven no-submit failures, and reconciliation for uncertainty.
   It must use existing accepted-delivery/attribution ledgers and never override
   the daily digest's approved policy.

This is the review/preparation phase, not an enabled automatic email routine.

## Verification

Tests cover plan safety/capacity, broad catalogue selection, freshness, time-zone
normalization, category variety, repeats, overlap, frozen retry/storage failure,
source-purpose rejection, signed targets, escaping, and isolated owner links.
Loopback-only staging persists real draft rows and exercises API authorization,
idempotency, suppression and HTML links. iPhone WebKit and Pixel Chromium render
checks use no external resources. All provider credentials are blank in staging.
Actual provider delivery rendering remains untested because no test send is authorized.

## Friday-only readiness candidate — November 26

This isolated candidate starts from main c19e264 plus PR18's exact approved copy.
It does not activate either edition. GET `/api/admin/friday-friends-prepare`
returns a no-database schedule proposal. POST accepts only `deliveryDay` and
`revision` with the existing expiring preparation credential. It freezes Friday
review artifacts from 13:15 to 14:15 Eastern, after the daily digest window.
Proposed execution is Friday 14:00–14:15, with potential attempts at 14:00, 14:05
and 14:10. No cron is installed and late Fridays cannot silently carry forward.

Friday mode preserves the approved copy and existing opted-in Boston audience.
Its version is `friday-friends-once-weekly-v1-2026-11-26`; all Friend email claims
in the prior seven days count, including uncertain/failed ones. Daily overlap and
recommendation exclusions remain. Frozen artifacts expire at 14:15. The older
ideas preparation remains review-only, with no additional authorization.

The unapplied production migration `20261126013135_friday_friend_atomic_claim.sql`
adds an exact owner-test hash/timestamp requirement and a Friday-specific claim
wrapper around the existing weekly claim. The daily overlap trigger is installed disabled, so the existing daily path
executes no Friday code and takes no additional user lock. Friday claims fail
closed until the separate service-only overlap prerequisite is enabled. Once
enabled, shared user-row locking prevents Friday/daily races in both directions,
while all Friend email claim statuses
consume the seven-day limit. Local persisted tests run real migration routines
with synthetic fixture tables in a separate database; the pure clock predicate
is tested at actual boundaries, then substituted only in that test database for
positive races on weekdays. No production migration has been applied.

`POST /api/admin/friday-friends-execute` accepts only a campaign and manifest hash.
It has separate short-lived `FRIDAY_FRIENDS_EXECUTION_TOKEN` and
`FRIDAY_FRIENDS_EXECUTION_EXPIRES`, plus the exact `FRIDAY_FRIENDS_SEND_VERSION`.
No cron or schedule is installed. It validates the full remaining audience before
claiming and each entry again immediately before submission. Freshness, current
Boston location, explicit consent, provider/local suppression, capacity, safety,
repeats, daily overlap, signed links and exact approved copy all fail closed.
The worker reuses provider idempotency keys and the existing receipt ledger.
Accepted receipts are skipped on resume; claimed/failed/unknown submissions stop
for reconciliation, never automatic resend. A post-claim deadline/approval change
retains the claim conservatively. Missing migration/approval data blocks execution.

The pinned owner-only path remains `/api/admin/campaign-owner-review`. Friday
execution requires its exact source hash, accepted receipt, current verified
provider-delivery status, current owner eligibility/suppression, and an explicit
operator `friday_owner_test_verified_at` with `friday_owner_review_hash` before
content/send approval. Provider acceptance alone is not owner-test verification.
No owner email has been sent in this work.

Production-target configuration inspection found preparation/owner execution
credentials missing or expired; existing owner/announcement send flags are off.
A narrower GET-only aggregate check on November 26 found one member passing
explicit Boston consent, safety, local suppression, seven-day claims and historical
daily exclusion. This is not a final send count: current qualifying daily activity,
fresh inventory and recipient-specific provider suppression still need verification.
The available established local Resend credential returned 401 on a domain read;
that does not establish the status of the deployed credential. Automatic approval
review rejected recipient-specific external suppression lookups, which did not
run. No credential, flag, schedule, production data or reporting baseline changed.

Before activation: review/merge/deploy the exact tested candidate and apply its
migration through the normal workflow; supply valid scoped preparation/execution
credentials; verify sender/provider permission and fresh exact audience; separately
approve and verify the pinned owner delivery; record exact content/count/send
approvals and owner hash; then enable only the approved Friday window. These are
remaining release/operator steps, not actions performed by this candidate.

Privacy correction: the sampled member's greeting is retained only in their own
frozen email. Exported samples and owner copies use “Hey there,” in both HTML
and plain text. Owner derivatives preserve the frozen public ideas but replace
member attribution/unsubscribe links with the owner's safe links. Old personalized
owner artifacts fail closed and require a new source revision/test. Synthetic
fixtures use different owner/member names and verify no recipient identity leaks.


### Release-safety procedure (draft; no production actions performed)

The unapplied draft migration now sets transaction-local `lock_timeout = '2s'`
and `statement_timeout = '15s'`. Apply through the normal transactional Supabase
migration runner, after checking the exact pending migration set and dry run.
Do not pipe the file through an autocommit SQL console: transaction-local limits
and all-or-nothing DDL require one transaction. A lock timeout is a release stop,
not permission to increase limits, terminate other sessions or skip checks.
Inspect blockers and choose a quiet window before a fresh approved attempt.
DDL still needs an exclusive campaign-table lock and delivery-table locks; these
limits bound waits, not eliminate locks or prove production throughput.

1. Keep Friday application credentials/version gates and schedules disabled.
   Apply the migration first. It changes no campaign approvals or existing rows,
   and leaves `friday_daily_delivery_overlap` physically disabled. Confirm that
   state and verify the existing daily path before releasing the app.
2. Release the app still disabled. The service-only
   `set_friday_friend_overlap_enabled(true)` is a separate operator prerequisite
   before any future approved activation, never a send or content approval.
   Run it in a short transaction with an outer statement timeout of 15 seconds.
   Its built-in two-second lock timeout bounds waiting for existing transactions.
   It drains daily inserts before enabling protection; Friday claims hold a
   compatible table lock until commit and require the trigger to be enabled.
   Do not enable/disable the trigger directly with `ALTER TABLE`.
3. Only after exact owner/provider/audience/content/send checks may the separately
   approved Friday execution gates be enabled. This work enables none of them.
   Existing frozen approval, consent, suppression and weekly gates remain required.
4. For rollback, turn off Friday execution and stop/drain any executor first.
   Keep schema, claims and receipts. Restore the prior app if needed. Then call
   `set_friday_friend_overlap_enabled(false)` in a bounded short transaction.
   It refuses while any Friday claim is less than 24 hours old, or while any
   `claimed`/`failed` outcome remains unresolved regardless of age. Reconcile
   uncertain outcomes through the existing receipt process; never delete claims,
   change timestamps or force trigger disable to make the check pass.
5. If disable refuses, keep overlap protection until the drain criteria pass.
   Daily inserts still take the enabled-mode user lock during this safety tail.
   Successful disable restores the original daily path, blocks future Friday
   claims and preserves all receipts/seven-day dedupe for a later re-enable.

`python3 tests/friday-friends-postgres.py` covers real PostgreSQL activation,
disable and delivery races with synthetic fixtures only.
`python3 tests/friday-friends-migration.py` covers the migration's own lock timeout,
transaction rollback, 50,000 unchanged legacy rows/no heap rewrite, and legacy
claim/daily compatibility. Both require the existing loopback local container;
neither accepts production connection details. Production transaction duration,
lock queues, table size and enabled-mode daily latency remain unmeasured. Before
an authorized migration/activation, inspect those aggregate operational measures
and confirm a quiet window; synthetic timings are not a production SLA.


### First-send execution capacity

The first Friday pilot is capped at **one exact approved recipient**, including
already-accepted entries. This is a technical maximum, not a verified audience
count or send approval. Oversize frozen manifests are rejected in full before
approval/provider checks, claims or submissions; no truncation or substitution.
Increasing the cap requires new runtime evidence and review.

The 300-second route reserves 60 seconds of platform headroom: its execution
budget is 240 seconds from route entry, also bounded by credential/window expiry.
Immediately before a new claim it requires at least 90 seconds remaining. Reads,
claims, receipt persistence and each provider submission have a 10-second timeout.
Post-claim eligibility/approval checks inside the adapter are separately bounded;
a timed-out check cannot later continue into a send. A timed-out write or provider
request may still settle externally, so the claim is retained for reconciliation,
not automatically retried. Accepted receipts still skip without another claim/send.

A synthetic near-timeout run allocates 9.9 seconds to each bounded stage, including
the draft read and all submission checks: **128.7 seconds** for one recipient.
The production-equivalent stub test also counts 7.7 seconds of fixed pacing on
a fresh successful execution. The modeled limit approaches 130 seconds; pacing is inside the
bounded checks, not added outside them. This is simulated elapsed time under the
specified I/O contract, not measured provider latency or a promise under event-loop
stall/platform termination. The final pre-claim reserve is independently enforced.

Before go/no-go, verify provider quota/rate capacity, required suppression scope,
and receipt-read access separately. A verified sender/domain alone proves none
of those, and the preliminary internal one-member count is not a final audience.
