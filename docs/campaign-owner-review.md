# Owner campaign copies

The owner requested that his confirmed admin mailbox receive campaign copies.
This is **not** permission to include other admins, remove an admin role, bypass
unsubscribes, send pushes, or automatically approve future campaign content.

## Required campaign runbook

For every Friend announcement, prepare and review one separate owner copy using
`POST /api/admin/campaign-owner-review`, action `prepare`, the source `campaign`
and an `expires` timestamp no more than 24 hours ahead. The ordinary Friend announcement preparation now also prepares this separate
owner review automatically and returns its exact copy alongside the member
summary. A failed owner preparation is reported as a blocker; the operator
must resolve it before campaign execution. Do this alongside, not as part of,
the real member audience. Other campaign families must adopt this same review
process before they claim owner coverage; this release supports Friend
announcement drafts only, not every transactional email.

The mailbox comes from server-only `CAMPAIGN_OWNER_REVIEW_EMAIL`; code pins the
hash of the single address the owner confirmed. Any other address fails closed.
The user must still be an active, non-test Friend admin with global emails on,
not paused, not topic-opted-out, and clear of local/provider suppression.
No preference or admin-role changes occur.

Preparation requires separate short-lived `CAMPAIGN_OWNER_REVIEW_PREPARE_TOKEN`
and `CAMPAIGN_OWNER_REVIEW_PREPARE_EXPIRES`. It freezes the exact source draft's
copy, replacing member CTA attribution with `https://notcupid.com/hub?discover=1`
and replacing unsubscribe links with that owner's global opt-out links. Show
this exact frozen message, links, sender/reply-to and one named recipient for
content approval, then request a separate execution approval. Preparation does
not approve or deliver anything. No owner copy is BCC'd onto a member message.

Record the genuine sequential content/send approval timestamps against the
frozen hash in `campaign_owner_reviews`; never manufacture them. Execution
requires its own short-lived `CAMPAIGN_OWNER_REVIEW_EXECUTION_TOKEN` and
`CAMPAIGN_OWNER_REVIEW_EXECUTION_EXPIRES`, plus
`CAMPAIGN_OWNER_REVIEW_SEND_ENABLED=true`. POST action `execute`, `campaign`,
`manifestHash` only. The endpoint cannot set approvals or override recipients.

A unique source-campaign row and atomic database claim prohibit duplicate
attempts. The provider uses a stable per-campaign/hash idempotency key. Any
uncertain outcome stays claimed: inspect the provider and ledger before taking
another action. Never reset the claim or create a different campaign to retry.
Disable the send flag and revoke temporary tokens after execution.

## Analytics and verification

Owner copies live exclusively in `campaign_owner_reviews`, not
`friend_event_deliveries`. There are no member attribution tokens, no member
campaign delivery tags and no changes to the original audience/count/hash.
Provider acceptance is recorded separately and is **not** proof of inbox
arrival. Reconcile the provider ID for actual delivery. Normal app/admin
analytics exclusions remain unchanged.

No scheduler, recurring enrollment, automatic email or push delivery is added.
A copy is prepared with every future Friend announcement,
but each send remains separately approved. If the owner unsubscribes or becomes
suppressed, report the missing review copy rather than bypassing that choice.
