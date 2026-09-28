# Friday digest proposal — pending review, not activated

## Read-only diagnosis (September 27, 2026, 9:12 PM ET)

- Last recorded daily activity send: September 22 at 1:00 PM ET, four recipients.
- Executing the current production-data candidate collector locally completed successfully and returned zero eligible recipients. No send function was executed.
- 588 non-test, non-deleted, non-blocked accounts; 555 pass email/preference checks before content eligibility. These are not a proposed send count.
- Of those 555, 120 have opted into Friend Line. Home-metro counts include Boston 106, NYC 2 and Providence 1. Travel can change the collector's metro.
- Since the last send, raw table counts show zero Love messages, Friend DMs, pack messages, club messages and plan comments. Two social posts were created, both in NYC; one is now expired. No date plans were created in that interval. These counts describe rows, not unique-user engagement.
- The existing digest is a new/unread-activity notification, not a weekly newsletter. It can legitimately send nothing. It does not require recent activity as a recipient criterion.
- The zero-candidate result explains why a run now would send nothing. It does not establish that every earlier scheduler run succeeded: historical execution logs and production activation settings were not accessible in this check.

## Confirmed coverage and diagnostic gaps

1. Discovery uses home ZIP/travel rather than the Home screen's selected discovery city.
2. The separate date-plan lifecycle is not covered. Date-plan emails currently have no approval; do not silently add them.
3. There is no durable digest-run summary distinguishing disabled, outside-window, zero-candidate, collector error and provider failure outcomes.
4. Failed provider attempts delete their delivery claim for retry, losing durable failure evidence. Keep retry-safe claims, but add a separate attempt log.
5. A weekly discovery product needs a different content policy from unread-only transactional notifications. Increasing cadence alone cannot create local inventory.

## Proposed product

- Friday at **1:00 PM America/New_York**, first possible date October 2, 2026, only after content and send approval. Never catch up outside an approved window.
- Short, city-specific member-created plans for the weekend/next seven days. Maximum three cards, one main CTA; no imported events or invented activity.
- Audience: real, non-deleted, non-blocked users who allow email and have not paused notifications, with a new explicit weekly preference and at least one eligible item. Do not automatically restrict to recently active users, or silently enroll users whose existing consent does not cover weekly discovery.
- Respect selected city, chosen Friend/Love lines, reciprocal dating preferences, age, blocks/reports, capacity, expiry and privacy. No blind-date identity or private venue exposure.
- Friend social plans first. Adding date invitations or private pending decisions requires a separately reviewed template and audience policy.
- If a city has nothing relevant, skip it. Do not repeatedly email the same unchanged plan or replace an empty digest with unapproved promotional copy.
- Proposed overlap rule: on Friday, consolidate approved daily items into one weekly email where relevant, instead of sending two digests. This changes the daily policy and requires approval; do not activate implicitly. Transactional safety and match notifications remain separate.

## Short copy direction — illustrative, not send-ready

From: NotCupid <match@notcupid.com>

Reply-to: match@notcupid.com

Subject: A few plans for your weekend

Preheader: See what people in [your city] are planning.

Hi [first name],

Looking for something to do? Here are a few plans from people nearby.

[Up to three eligible real plans: title, public area, day/time. Each links to its actual in-app plan.]

CTA: See what's happening

CTA destination: https://notcupid.com/hub?from=friday-digest

NotCupid, operated by Lemon Labs
109 California Ave, Quincy, MA 02169
[Signed unsubscribe link] · [Verified email-preferences link]

Do not send these placeholders. Before approval, render the exact actual content, verify every plan/deep link and preference destination, calculate the exact recipient count, show it to the operator and obtain separate send authorization.

## Implementation order after review

1. Add read-only admin diagnostics and a durable per-run/per-attempt ledger, with aggregate reason codes and no raw email addresses or provider secrets.
2. Share deterministic city/eligibility/privacy rules with Home; tests cover empty, expired, full, blocked, deleted, wrong-city and wrong-intent inventory.
3. Build a separate, versioned weekly curator and exact no-delivery preview. Do not change the approved daily template in place.
4. Add weekly preferences, signed unsubscribe handling, Friday ET time gate, recipient/week idempotency, bounded retries and approved daily-overlap handling.
5. Test content selection, authorization, duplicate prevention, DST and real deep links; run typecheck, tests and build.
6. Review rendered copy, audience/count and exact send policy. Activate only after explicit approval, initially in cities with real qualifying supply.
7. Measure eligible/sent/skipped/failed/delivered separately. Track tagged return visits, RSVPs, host replies, reciprocal chats and next-week return; do not treat email opens as proof of engagement.

## Status

The initial investigation was read-only. The follow-up release implements the
separate outside-event discovery panel, explicit event-to-member-invitation
flow, duplicate protection, FAQ, and daily scheduler summary records. A
read-only city-roundup draft is available at `/admin/friday-digest`; it has no
send route or scheduler and does not yet combine personalized member plans.

The first provider is Ticketmaster, on demand only, with short-lived public
metadata caching, source links, no copied descriptions/images, strict
date/status/link validation, and the existing moderation blacklist. Browser
clients never receive provider credentials. The local key returned HTTP 401
during release validation; production key status must be checked separately.
Do not present the provider as verified live on this evidence.

Before weekly activation: confirm provider email-reuse permissions, complete
weekly consent/preferences, signed unsubscribe, personalized city/intent-safe
member-plan curation, per-week delivery claims/attempt logs, suppression of
repeated items, Friday ET scheduling and the daily-overlap rule. Show exact
copy/audience/count and obtain separate send approval. No new emails are
authorized by approval to ship this code. Existing daily approval is unchanged.
