# Outside-event funnel instrumentation

Prepared locally November 13, 2026. This document does not indicate production deployment or campaign delivery.

## What is measured

All records use the existing service-only `app_client_events` ledger, `surface = outside_events`, with `outside_event_` event names:

- `panel_open`: discovery heading is at least 50% visible for 500ms in a foreground tab. A hub return alone is not a feed view.
- `impression`: a card is at least 50% visible for 500ms. Cards merely rendered below the fold do not count.
- `source_click`: organizer/admission link action. This is not a ticket purchase.
- `invitation_open`: existing member invitation opened from an outside-event card.
- `plan_start`: user opens the invitation composer. This is not a published plan.
- `filter`: closed category, date-window, free-only and reset selections. Search text is never collected.
- `plan_create`: server-verified successful outside-event plan, including same-ID recovery after partial registration. One unique member/plan outcome, not an attempt.
- `plan_join`: server-verified fresh yes-RSVP from someone other than the host. One unique member/plan outcome across leave/rejoin; not attendance.

A session is tab-local, randomly generated, and rotates after 30 minutes without tracked interaction. Server keys dedupe repeated telemetry by authenticated member, session, discovery metro, action and catalogue/filter identity. Verified campaign delivery is part of the observation key, so an organic browse does not erase a later signed campaign return in the same session. For aggregate session metrics use distinct member/session, not raw row counts. Plan outcomes are deduped by member/action/plan regardless of session or campaign.

## Campaign and privacy boundaries

Existing `friend_event_attribution` still distinguishes link requests, authenticated returns and general plan outcomes. New rows add only a verified campaign delivery ID/channel from the existing signed, owner-matching, accepted/delivered, seven-day cookie. Never trust `from`, UTM strings, or client-provided delivery IDs. Forwarded links cannot attribute another member.

Client events are authenticated, rate-limited, size-bounded and same-origin checked. Event references are verified against the current city catalogue, including moderation and expiration. Categories come from server data, not client claims. The endpoint cannot write successful creation or join events. No raw searches, titles, URLs, exact location, message content, hobby/music profiles or inferred sensitive traits are stored in this telemetry. This does not change personalization or newsletter preferences.

Client telemetry is best-effort: offline use, blockers and process interruption can lose observations. Failed storage returns503 rather than a false success; a subsequent matching observation may retry. There is no background durable retry queue. Server outcome instrumentation is also non-blocking to user success and is not a financial/audit ledger. Do not promise 100% capture.

## Reporting

Start after the exact deployment timestamp. Exclude test, blocked and deleted users. Never mix historical incomplete tracking with a conversion denominator. Campaign-return-to-view conversion should join accepted deliveries and authenticated returns to distinct signed `panel_open` or `impression` users; a scanner/link request is not a person.

Example aggregate read-only query (restrict timestamps and campaign ID for the actual campaign):

```sql
select e.event_name,
       count(distinct e.user_id) as members,
       count(distinct (e.user_id,e.session_id)) filter (where e.session_id is not null) as sessions,
       count(*) as deduped_observations
from public.app_client_events e
join public.users u on u.id=e.user_id
where e.surface='outside_events'
  and e.created_at >= :release_at
  and u.is_test is not true and u.is_blocked is not true and u.deleted_at is null
group by e.event_name;
```

Later-day return is the same member with an observed panel/card on a later Eastern calendar date, not merely a new session or email open. Compute daily cohorts from `created_at AT TIME ZONE 'America/New_York'`. Outcomes refer to unique plan IDs; RSVP is intention, not attendance. Prefer these meaningful outcomes over click totals. Existing reciprocal chat and self-reported meetup metrics remain separate.

## Verification and release gate

No new migration is needed: uses the existing RLS-protected ledger and unique dedupe key. Unit tests cover input allowlists, private-input stripping, origin/auth/rate gates, catalogue validation, trusted campaign metadata, durable-write acknowledgment, partial-creation recovery and forged retry exclusion. Isolated staging tests use only local synthetic accounts/catalogue and no provider credentials, asserting real persisted rows and iPhone WebKit/Pixel Chromium interaction paths.

Before production: review commit, integrate campaign branch separately, run combined checks, deploy exact approved SHA, verify production deployment and signed-in discovery appearance, then confirm real telemetry writes without creating fake member plans. Campaign rendering/content and send gates remain separate. This patch does not send email or push, enable a cron, rank events by interests, or backfill past behavior.
