# Friend announcement clean release preparation

Local preparation only, based on production commit 234b931. No campaign was sent,
no production schema/flags were changed, and no approvals were created.

## Prepared changes

- Short weekend copy and compact global marketing unsubscribe/address footer.
- New content version: `friend-announcement-weekend-2026-11-13-v3-clean`.
- Disabled operator-only execution endpoint, distinct expiring credential,
  frozen hash/count gate, separate sequential content and send approvals,
  single-attempt database lock and no automatic retry after uncertainty.
- Recipient eligibility/suppression rechecks, provider pacing, per-message
  idempotency and provider-acceptance recording remain in the sender.
- Invalid approval timestamps/purpose/deadline stop before acquiring a lock.

## Remaining release and send gates

1. Integrate with tracking changes; run aggregate checks on the combined release.
2. Review and apply only the new execution-lock migration under the normal
   linked-database dry-run/review workflow, if production release is authorized.
   Current SQL validation uses disposable synthetic PGlite only.
3. Deploy the verified code with both discovery/announcement sending disabled.
   Verify the exact deployment, authenticated app flow and fresh event inventory.
4. Prepare a NEW immutable draft ID from current production audience and a fresh
   send window. Do not reuse the previous v2 hash or approval, and do not mutate
   the old draft. The previous 123 count is historical, not this package's count.
5. Preserve the owner's explicit signup-permission affirmation. Record its
   provider-permission review for this campaign; do not silently enroll anyone
   in recurring discovery. Retain all current opt-outs and suppressions.
6. Show the exact final rendered subject/body, sender/reply-to, CTA destination,
   signed link shapes/one-click unsubscribe, audience, fresh exact count and
   production send type. Obtain explicit content approval for that package.
7. Obtain SEPARATE exact execution approval. Only then create matching approval
   records, enable the temporary execution configuration and submit once.
   Revoke the execution window/flag afterwards. Never blind-retry a locked or
   uncertain attempt; reconcile delivery records first.
8. Report provider accepted vs delivered/bounced separately; authenticated
   return/plan actions are not proof of attendance. No push package is included.

## Evidence

Synthetic preview artifacts are under the local release-evidence directory's
`friday-20261113/clean-campaign/` folder. They use synthetic tokens only and do not
send or contact a provider. Mobile viewport 390px has two links and no overflow.
This is a browser-rendered HTML check, not an inbox-client delivery/render test.
