# City discovery + digest preparation

## Included

- Optional Find something to do on Home/new Friend home, plus an entry from the legacy Friend discovery card.
- Ticketmaster events in the selected discovery metro, with today/weekend/next-seven-days, category and listed-free filters. External listings are not inserted into the member feed.
- Deliberate publication into a normal member social invitation. Event ID and source URL are retained, provider status/time/city are rechecked before publication, and a per-host/event unique index prevents two-tab duplicates. Existing client-ID retries and participation/chat rules remain in use.
- Available member invitations for an event are shown before starting another. The API still applies its existing realm/report/host gates; the UI filters eligibility and available capacity.
- Public event venue versus participant meeting-place privacy is explained. No ticket purchase, reservation or admission guarantee is implied. Source links remain on both new and legacy plan cards.
- No images/descriptions are copied from the provider. Listings expire from discovery, requests time out, and moderation is checked even for cached results. Provider failures do not take down member plans/chat.
- Read-only Friday draft at `/admin/friday-digest`, linked from admin. It is not an active email campaign. All new sends and weekly enrollment remain absent.
- `activity_digest_runs` adds aggregate scheduler outcomes, with admin visibility. Existing approved daily send gates/content/audience are unchanged. No cron/send endpoint was invoked during this release.
- FAQ and current project memory updated.

## Validation and limitations

- Typecheck and unit suite (324 tests) pass; the isolated release copy uses no production secrets.
- The event-to-invitation-to-chat flow passes automated iPhone WebKit and Pixel Chromium tests with a synthetic localhost database and mocked publication/messages. This is not evidence of installed-PWA device push delivery.
- The local Ticketmaster credential returned HTTP 401. Production credentials were not readable through the available deployment connection. Live external inventory must be verified with a working production `TICKETMASTER_API_KEY`; code deployment alone does not fix a provider credential.
- Friday preview currently curates outside events only. Before activation, finish reviewed consent/preferences, personalized member-plan inclusion, signed unsubscribe links, exact audience/count, per-week idempotency, repeat-content suppression, Friday scheduling, and daily/weekly overlap policy. Provider email reuse requires review. Obtain explicit send approval separately.
- Event changes after publication are not automatically rewritten into a member invitation. Every card points to current provider details; users coordinate arrival changes in chat. Automated provider-change notifications are not part of this release.
- Digest run logging starts with this release; it cannot reconstruct missing historic scheduler outcomes or guarantee a log if the process is terminated before completion.

## Database and rollback

Apply only `20260928011854_friend_event_invitations.sql` through the documented CLI dry-run/push/list flow before deploying the new code. It is additive: nullable reference columns and index on `friend_activities`, plus an RLS/service-only run-summary table. Existing rows and delivery ledger are not rewritten.

Rollback by redeploying the prior commit. Leave the additive migration in place; do not edit or delete an applied migration. Existing member plans remain readable by the older code.
