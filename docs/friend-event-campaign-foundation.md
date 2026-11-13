# Friend event campaign foundation (local, not activated)

Status: separate local consent and measurement foundation. No production migration,
provider send, campaign activation, subscriber backfill or scheduled job was run.
The Friday preview and existing daily activity email are unchanged.

## Implemented

- Profile has explicit, independently saved email/push discovery choices, both off
  for absent rows. Versioned audit history records profile choices and unsubscribe.
  It never enables browser permission or infers marketing consent from messages.
- Dedicated signed, purpose-scoped, expiring tokens use a new server-only
  `FRIEND_EVENT_SIGNING_SECRET` (at least 32 characters). Missing key fails closed.
  Unsubscribe GET shows confirmation; POST disables only the signed channel.
  POST also supports one-click email unsubscribe. No prefetch-triggered opt-out.
- Atomic member-locked claim checks real/active Friend eligibility, explicit
  channel opt-in, global email off/pause, admin exclusions, device existence,
  channel suppression records, approved/enabled/unexpired campaign, unique
  campaign/member/channel and a seven-day per-channel frequency ceiling.
  Claimed/failed/unknown outcomes continue to suppress duplicates; no blind retry.
- Signed `/go/friend-events?token=...` links only redirect to Friend discovery,
  stripping the token before the destination. Cookies are HttpOnly, seven-day
  maximum, SameSite Lax and secure in production. No arbitrary redirects.
- Distinguish raw link requests (may include scanners) from owner-authenticated
  returns and actual successful new yes-RSVPs/plan creations. Forwarded links
  cannot count another account as the recipient. Only provider-accepted or
  delivered sends qualify. First event of each type per delivery is retained.
  This is last-touch association within seven days of the delivery claim, NOT proof of causation or meetup.

## Still required before sending

1. Review this migration and code; apply to isolated staging, run authenticated
   mobile preference/unsubscribe/redirect/login/RSVP/create flows with synthetic
   members, confirm no outbound providers are enabled. Unit SQL runs are not full
   staging QA. Existing deployments require the new schema before showing UI.
2. Production migration and deployment decision, plus generate/provision the new
   signing secret through approved credential management. Do not reuse preview
   credentials or commit the value.
3. Collect explicit opt-ins. Current technical email/push reach is NOT a consent
   audience, and the migration deliberately enrolls zero existing members.
4. Sender integration is now implemented but not exposed by any route/cron:
   `friend-event-message.ts` freezes exact rendered messages and personalized
   signed URLs; `friend-event-sender.ts` hashes all content/audience/count into a
   reviewed manifest; `friend-event-sender-adapter.ts` rechecks explicit consent,
   Boston city, global settings, admin/test/account exclusions and provider/local
   suppressions before each claim. Separate content/send timestamps, exact hash,
   count, the retained `approved_at` campaign gate and
   `FRIEND_EVENT_SEND_ENABLED=true` are required. Nobody has approved
   a manifest, no flag has been enabled, and no actual send was attempted.
   Email submissions carry provider idempotency keys and one-click unsubscribe
   headers. Unknown outcomes remain claimed and stop the batch: reconcile, never
   clear/retry blindly. Any audience drift stops rather than silently selecting a
   different count. Unsubscribe signatures last at least 400 days beyond the
   manifest expiry; signing-key rotation must preserve old unsubscribe validity.
5. Validate the new webhook path in isolated staging and later provider setup.
   It is wired after existing raw-body signature verification, uses atomic
   event-id dedupe, locks known deliveries, checks provider IDs, and preserves
   terminal suppressions across out-of-order callbacks. It does not change
   existing email preferences or enable campaigns.
6. Validate the admin-only aggregate report at
   `/api/admin/friend-events/report?campaign=...`. It separates claimed,
   accepted, delivered, failed/suppressed/bounced/complained, raw links,
   authenticated returns, plan joins/creates and meaningful-action users.
   Rates use provider-accepted channel cohort, null when denominator is zero.
   Channels overlap. Push accepted is not proof of device display.
7. Provider reconciliation is implemented at
   `/api/admin/friend-events/reconcile`, disabled unless
   `FRIEND_EVENT_RECONCILIATION_ENABLED=true`. An authenticated same-origin admin
   can reconcile one known provider ID via GET, never resend or clear a claim.
   Unknown submission IDs require operator investigation. Reconciliation times
   are observation times, not invented provider occurrence timestamps.
8. Future sender must call `checkFriendEventSuppression` immediately before
   submission using SDK suppressions.get, and record any suppression. Unknown,
   timeout, permissions errors, mismatched address and empty data all block;
   only explicit 404/not_found is clear. Local suppressions are never removed
   merely because the provider lookup is clear.

The delivery foundation is deliberately not an operational sending endpoint.
A campaign row alone is not a substitute for the exact review/send gates in
AGENTS.md. Copy, links, sender, count or audience changes invalidate approval.

## Checks

`npm run typecheck`; `npm test`; synthetic-env `npm run build`.
`tests/friend-event-campaign.test.mjs` runs SQL on ephemeral PGlite, never the
linked production database. Do not run schema push as part of unit tests.

## Local validation update (2026-11-13)

- 428 automated tests pass; typecheck and synthetic-localhost-config production
  build pass. No production credentials used for these checks.
- Isolated staging passed 18 strict API/DB checks covering separate consent,
  signed unsubscribe, account isolation, redirect privacy headers, authenticated
  returns, real synthetic plan creation/RSVP and unique-user aggregate reporting.
- All four new migrations were applied only to isolated local staging. Production
  migrations, deploy, sends, enrollment and provider calls remain unperformed.
- Independent read-only review found an attribution-window wording mismatch; it
  was resolved by explicitly labeling seven days from the delivery claim. No
  further safety blocker was found for this intentionally non-sending foundation.
- Five mobile-browser checks passed, including opt-in persistence, opt-out and
  no horizontal overflow at 390px. Non-admin report/reconcile access was denied.


## Staged sender integration and release gates

The sender worker has no public/admin invocation endpoint, no cron, and no caller
in production routes. A future explicit execution handoff must supply the exact
frozen manifest reviewed by the owner; never reconstruct links or recipients
between approval and execution. Review exposes separate email/push delivery counts
and distinct people, not one misleading blended count.

Fake-provider tests cover exact approval binding, changed copy/links/address/count,
missing/invalid approval, suppression, last-moment eligibility changes, duplicate
claims, ambiguous provider/receipt failure, provider idempotency and signed
unsubscribe headers. Fake adapters cannot access the network.

Release is currently **staged, not authorized for production publication**. Latest
owner instruction is to stage the build ready to roll. Production deployment must
keep all send/reconciliation flags off, no campaign rows activated, and no existing
members enrolled. Before first real campaign: collect explicit opt-ins, prepare
exact manifest and preview, obtain content/audience/count approval and later
separate execution approval, then confirm actual provider scope and suppression
lookup permissions. The current application data and signing secret must never be
copied into the reusable staging environment.

Final staged rerun: six fake-provider sender tests, 18 isolated API/DB checks and five mobile-browser checks passed after the fourth migration. All staging consent switches and campaign approvals restored off.
