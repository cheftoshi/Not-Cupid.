> Historical implementation checkpoints below. For the current release candidate, inventory and validation status, see `curated-release-2026-11-13.md`.

# Community event discovery release checklist

Status: November 13, 2026. Local preparation only. The owner requires Wicked-style community breadth, not a Ticketmaster-only finish line.

## Existing implementation
The richer discovery UI is shared by authenticated Ticketmaster discovery and a synthetic preview. Current local base includes the shipped Duo release. No event-feature production deployment has occurred.

## Current work
- `lib/event-source-policy.ts` defines source-neutral provenance, strict source-owned HTTPS allowlists, event freshness/cancellation validation and conservative deduplication. It is intentionally not connected to production fetching or publication.
- Source-policy tests use only synthetic example.test data. No real member writes, messages or notifications.
- Exclude generated `artifacts/` review copies from TypeScript compilation. They are partial source archives, not application source; previously they caused typecheck failure.

## Required integration, in dependency order
1. Validate actual permitted community feeds and their current sample data. Start with official structured calendars that document reuse. MIT returns public JSON, but current Localist documentation states API access requires a paid license and new terms. Hold integration pending clarification; HTTP 200 is not evidence of reuse authorization. Do not scrape The Boston Calendar: its terms prohibit scraping. Do not bypass FindLocal's prior denied sample access.
2. Implement source adapters with explicit venue-local timezone handling. Unknown dates/prices/cancellations must remain unknown, not guessed. Preserve source links, checked times and available cancellation updates. Use original category art unless image reuse is permitted.
3. Feed adapters into the server-owned catalog. Surface partial source failure, enforce per-source cache/retention terms, and preserve current blacklist and source freshness checks. No client-supplied URL or provider host can define access.
4. Extend category/price/attribution UI to community, outdoors and food only when backed by inventory. Current UI is restricted to music/arts/sports and hardcodes Ticketmaster attribution.
5. Add a forward database migration broadening `friend_event_reference_valid` only to the verified sources. Current constraint requires `live:tm:*` and ticketmaster.com. Preserve host/event uniqueness and all privacy/realm rules. Do not apply migrations to production without release authorization.
6. Update authenticated publication and serialization together. `app/api/friend/activities/route.ts` currently rejects non-Ticketmaster IDs and strips non-Ticketmaster URLs. Re-fetch the selected source by trusted ID immediately before publication, fail closed if stale/cancelled/changed, and preserve deliberate user publication. Digest logic also has a Ticketmaster-only link filter; do not modify approved email content/send policy incidentally.
7. Verify integrated flow with isolated synthetic accounts: browse/filter → start or join invitation → RSVP → participant-only chat; duplicate clicks, browser Back/Forward, auth interruption, failed provider, cancellation and changed times. Never use real members for synthetic messages.
8. Run exact-final-code typecheck, complete units, build/client budget, mobile/desktop UI and staging/database constraints. Physical iPhone/PWA validation and owner review remain separate from simulated browser coverage.
9. Obtain explicit deployment approval and verify exact revision/CI/live output. No new source account, subscription, paid API, outreach, deployment or provider legal commitment is authorized by this checklist.

## Current verification
Fresh typecheck and 10 focused event/source-policy tests pass. Full unit suite and build were started but stalled without completion and were stopped; do not report them passing. Prior 395-test/build results describe the November 9 snapshot, not these final files. Existing Ticketmaster key presence verified without printing its value; fresh catalog query timed out after system-CA TLS setup, so inventory/access remains unverified. No source account, subscription, schema write or deployment occurred.

## Boston RSS local prototype
`lib/boston-rss-preview.ts` is a review-only adapter over extracted RSS items. It retains only title, source URL, venue, source display time and checked time. No images, descriptions, contact details or city seal are reproduced. It rejects untrusted source links and snapshots older than one hour, and deduplicates identical source occurrence records. Its one-hour freshness limit is an internal fail-closed choice, not a city-guaranteed refresh interval.

A read of https://www.boston.gov/rss/events at 2026-11-13T02:56:15.126Z returned 25 items, reduced to 20 unique review occurrences. All 20 had unverified Z-suffixed local-time fields. None is publication eligible. The adapter deliberately leaves startsAt null rather than guessing UTC or silently correcting the clock. Price and cancellation status remain unknown; source pubDate is not a verified event freshness/cancellation timestamp. No inventory completeness or social-event breadth is claimed; the sample is civic-heavy.

The city terms contemplate third-party app use of city data without endorsement: https://www.boston.gov/government/cabinets/innovation-and-technology/terms-use-and-privacy-policy-city-boston-digital . This is not a blanket image/full-description license or proof of every underlying contributor's rights. Commercial production reuse scope, polling limits and accurate cancellation/time handling still need verification. Current local work is not production integration, automatic publication or approval to scrape other sites.

Fresh final checks: typecheck and 13 focused tests pass, including three new Boston adapter tests. Full-suite/build completion is still unverified. Result summary: `boston-rss-prototype-result.json`.
