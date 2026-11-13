> Historical implementation checkpoints below. For the current release candidate, inventory and validation status, see `curated-release-2026-11-13.md`.

# Boston curated events: local editorial workflow

This implements the owner's manually curated, every-three-day approach. It does not require a new event API or images from other sites.

## Implemented locally
- Versioned facts with stable ID, Boston location, verified time including timezone, category, source name/link, source checked timestamp and verified or unknown price.
- Explicit draft → review → publish. Any fact edit invalidates review. Publication is local JSON, not a production action.
- Reviewed public admission and time are mandatory. Source checks expire after 72 hours; listings also expire when their event starts. Fail closed when stale, edited, cancelled by removal, or malformed.
- The server merges active curated records with Ticketmaster results; curated inventory works even when Ticketmaster is unavailable. Blacklist checks still run and fail closed.
- Food/outdoors/community categories and per-card source attribution added. Existing explicit invitation, RSVP/chat, realm/privacy and revalidation logic remains in place.
- Published catalogue is EMPTY. No real event is visible or published. No production DB changes, deployment or outbound messages occurred.

## Commands (local only)
Run with the repo's Node 24 runtime:

1. Write one facts object or an array in a private local input file. Use concise original factual titles, not copied full descriptions/images. Unknown price is null. Confirm public admission and exact timezone at the organizer's source.
2. `node scripts/curated-events.mjs draft INPUT.json DRAFT.json`
3. Inspect every event and its source manually, then `node scripts/curated-events.mjs review DRAFT.json REVIEWED.json`.
4. After editorial verification and within the owner’s current publication authorization: `node scripts/curated-events.mjs publish REVIEWED.json PUBLISHED.json`.
5. `node scripts/curated-events.mjs check PUBLISHED.json` reports active rows. Publishing creates an array compatible with `data/curated-events/published.json`. Files are never overwritten by this command.
6. Putting this reviewed catalogue into a released build is a separate production deployment. This first implementation is a versioned local catalogue, not a live admin CMS. Every-three-day updates require a fresh source check, re-review and an authorized catalogue release. No recurring job is configured by this work.

## Release gates
The forward migration `20261113032543_curated_friend_event_references.sql` is prepared but UNAPPLIED. It broadens the existing ID/URL constraint while preserving uniqueness/privacy. Its SQL shape check is not a replacement for the server's trusted-catalogue revalidation. Do not modify approved digest emails incidentally; their Ticketmaster-only filtering is unchanged.

Before production: inspect the final diff, validate this migration in isolated staging and exact ledger, test real synthetic-account invitation/RSVP/chat and interrupted/back/forward flows, pass final units/typecheck/build/UI checks, review actual event batch, and obtain deployment/migration approval. Versioned-file updates are adequate for a small initial curated feed; an authenticated CMS can be a later improvement if needed.

## Email return-loop preparation
The existing UNSENT Friday roundup draft now supports curated source attribution and event-specific return links (`/hub?discover=1&event=...&from=friday-digest`). It excludes expired source checks, escapes content and stays `enabled:false`, `sendReady:false`, with zero authorized recipients. No sender, cron, enrolled audience or tracking pixels were added. Existing approved daily activity delivery and consent behavior are untouched. Before any event campaign send, review exact content/links/sender, eligible opt-in audience, signed unsubscribe/preferences, suppression and approved cadence.

## Verification as of November 13
Fresh TypeScript check passes. Synthetic CLI draft→review→publish→check passed entirely under /tmp; the application catalogue remains empty. Focused policy, server/publication, draft email and isolated PGlite migration tests pass. Full suite and production build twice stalled without completing and were stopped; no full-pass or release-ready claim is made. New UI has not yet had final screenshot/browser verification, nor a real isolated-account RSVP/chat regression. No migration applied, real event published or email sent.
