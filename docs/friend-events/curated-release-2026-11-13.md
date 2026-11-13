# Curated Friend events release candidate — November 13, 2026

## Scope
Reviewed manual event catalogue merged with existing Ticketmaster discovery. No curated-event count cap. Source-linked factual cards, six categories, Upcoming/date/free/search filters, exact event return links through authentication, explicit member invitation creation and existing RSVP/chat privacy rules. External events remain distinct from member invitations and joining a plan does not buy admission.

The first local catalogue contains 32 factual records across Trident, Berklee, Somerville Theatre, Bow Market, Boston Public Market and AXS/The Bowery Presents. Original organizer/primary-ticket pages were checked by the research worker before 2026-11-13T04:15:33Z, a clock-verified read-completion timestamp. Source information is not a guarantee of current tickets, age eligibility, cancellation status or fees. Unknown prices remain null; displayed known prices are advertised amounts. No event descriptions or images are copied. Cards link to current details and ask members to check admission, availability, age and price.

## Validation evidence
- Exact 32-record candidate: 414/414 serial unit tests; typecheck; production build; client-size budget passed.
- Simulated iPhone WebKit and Pixel Chromium: all 32 records, exact TroyBoi deep link, five free listings, food filter and viewport checks passed.
- Previous synthetic 40-record fixture: all 16 final authenticated mobile checks passed after completing only local synthetic Friend quiz fixtures. This resolves the earlier navigation-race failure for an incomplete synthetic account.
- Real isolated API tests passed: curated event → idempotent invitation → guest RSVP → chat, private venue visibility, outsider denial, withdrawal revoking chat/venue access. No production accounts or writes used.
- Independent code review found no new blocking defect.
- Physical-device/PWA verification is not claimed.

## Reusable staging
Persistent local Docker database/API, separate volumes/schema/test users, loopback-only ports, no production data or provider credentials. App runner denies nonlocal fetches and clears email/payment/AI keys. This is local staging, not an always-on cloud service. Staging details live outside the repository. Never commit private staging sessions or credentials.

## Operations and gates
Catalogue records expire at event start or 72 hours after their source check. Recheck, review and release updates before expiration. No recurring refresh service has been configured by this code. Review edits invalidate the previous content fingerprint. No new email campaign, recipients or schedule is enabled. The Friday email remains an unsent preview with exact-event and full-feed links.

The new migration must pass the exact linked ledger/dry-run check and be applied before code release. Current document describes a release candidate, not a successful production deployment. Verify the remote commit, CI and live revision before claiming release.
