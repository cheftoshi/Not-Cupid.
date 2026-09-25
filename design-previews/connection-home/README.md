# Connection Home v2 — design-review sandbox

September 24, 2026. This is **not wired into the production app** and is not a security implementation. The sample state is entirely client-side and contains only fictional people. Do not use these helpers to authorize production requests or store real private profiles.

The running isolated preview at `http://127.0.0.1:3107` contains a snapshot of this folder's source files. It runs in `/private/tmp/notcupid-home-preview-63naAN`, with no production credentials, database calls, or outbound messages. Refresh resets all state. Localhost is accessible on this Mac, not a public share link.

## Location review update — September 24

- Required Boston neighborhood; optional public meeting place or “Decide together.” The Back Bay default is a demo choice, not inferred GPS. Multi-city selection is still pending.
- Friendship venue visibility: joined participants only by default, or everyone viewing the invitation. Leaving hides participant-only venue details again.
- Date venues remain hidden from requesters until host acceptance; the host always sees their own venue. Accepted invitations disappear from unrelated members' feeds.
- Hosts can set or edit the meeting place within the conversation panel. Switching to “Decide together” clears the old venue.
- A public-place checkbox is a user declaration, not venue verification. No geocoding, autocomplete, GPS, or maps provider is connected.
- Browser-checked creation, host editing, date acceptance/reveal, third-member exclusion, and phone-width editor scrolling. Main app and isolated preview typechecks pass; all 10 focused model tests pass. Physical Android/iOS checks remain.
- All visibility is a fictional client-side UI demonstration. Production must redact private venue data on the server and enforce authorization before these flows can ship.

## Changes requested in review

- Replace the marketing headline with a personal home greeting, upcoming get-together, and connection updates.
- Rename “All plans” to “Discover,” under “Around you.” Add Friends, Dates, and Your invitations.
- Keep conversation list and plan chat in a dedicated right column on desktop. On small screens, Messages opens a dismissible, keyboard-accessible sheet.
- Date invitations have exactly two seats, profile-first or blind presentation, explicit gender preferences, and host acceptance.
- Requesting interest does not create chat. Accepting one guest closes other requests and removes the invitation from other sample members' feeds.
- Blind mode hides names/profile details in the discovery and request cards until host acceptance. It still displays age, gender, and shared interests. It is not guaranteed anonymity. Free text could also reveal identity; production needs explicit copy/consent and a privacy review.

## Try it

1. As Jamie, open a friendship conversation; it appears on the right.
2. Open a date profile, or request the blind-date sample.
3. Switch “Preview as” to Noah (sample host). Review the request and accept.
4. The private date chat opens for Noah/Jamie, with profile identity revealed.
5. Switch to Taylor: the accepted invitation and its private room are absent.
6. Create a date: select its mode and gender preferences. The group-size selector is replaced by the fixed two-person rule.

## Still required before production

Server-side membership/visibility and blind-profile payload redaction; transactional two-person acceptance and capacity; verified source of user-declared gender/preferences; age/radius/block/report policy; expiry/cancellation; invitation/payment entitlement policy; push/email approval and delivery; durable room/message storage; deep links; and physical Android/iOS testing. Preview perspective switching must never exist as a live-user impersonation feature.

Model tests cover reciprocal preferences, adult gates, pending-chat denial, host-only acceptance, exactly-two membership, one accepted guest, and third-member exclusion. These validate the proposed UI state model only, not live backend protections.
