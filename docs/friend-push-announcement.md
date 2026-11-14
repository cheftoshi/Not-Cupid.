# One-time Friend product announcement push

This operator-only path is distinct from email and recurring discovery opt-in.
It never enrolls members or changes any notification preference. Runtime route:
`POST /api/admin/friend-push-announcement` with an expiring, dedicated bearer
credential. Preparation is read/freeze only; execution additionally requires
`FRIEND_PUSH_ANNOUNCEMENT_SEND_ENABLED=true` and an approved campaign matching the
immutable manifest hash/count. No cron calls this route. All flags default off.

The owner explicitly requested: “Send push to those who have push enabled”.
This authorizes a one-time Friend launch notification, not a weekly subscription.
The email-specific two-stage content/send approval procedure is untouched.

Audience: real active Friend members with current web-push subscriptions, excluding
admins, test/blocked/deleted/paused accounts, recorded push suppressions and actual
Friend-event push opt-outs. Email unsubscribe does not remove push permission.
Absent newly added weekly preferences are not treated as recurring enrollment.
One immutable campaign, atomic member claims, and a campaign execution lock prevent
duplicate attempts. Unknown results stay claimed and require reconciliation.

Prepare uses production runtime admin exclusions, VAPID configuration and signing
secret without exporting credentials. Preview returns aggregate count, exact copy,
hash and destination, never member identifiers or personalized tracking tokens.
Each subscription is fingerprinted, then rechecked before sending. Member acceptance
is monotonic on the first successful device submission. Per-device receipts distinguish
accepted/rejected/unknown; acceptance does not prove display or reading. Signed
channel-specific links use existing owner-authenticated attribution for returns and
plan actions. TTL is24 hours.

Before activation: pass tests/typecheck/build, apply reviewed migration through the
normal Supabase ledger workflow, deploy disabled, prepare/inspect exact frozen preview,
register current owner authorization and exact hash/count in the campaign row. Execute
once. After execution: verify receipts, campaign send_enabled=false, then revoke the
runtime credential/expiry and turn the execution environment flag off. Never retry
an uncertain or locked execution or clear its claims. No email send is involved.
