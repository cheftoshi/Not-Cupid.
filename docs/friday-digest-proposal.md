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
