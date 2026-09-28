# Persistent Love chats

## Product policy

- Pending invitations still expire after 72 hours.
- Mutual chats no longer expire for inactivity.
- After 10 quiet days, a mutual chat is hidden from the default Love inbox,
  available in Archived, and omitted from concierge next-action suggestions.
  A message from either participant restores visibility. Opening a chat alone
  does not reset activity. Archived conversations still reserve connection capacity.
- Past conversations exposes up to 100 recent endings. Previously mutual chats
  ended only by automatic expiry offer Bring this chat back, once per chat and
  at most three initiated restores per user in a rolling 30-day period.
- Restoration preserves the same messages and original mutual consent; either
  person may end or report. Manual endings, passes, pending expirations, reports,
  blocked/deleted accounts, cross-realm pairs and matching pauses cannot reopen.
- Both participants must have capacity within the existing ten-connection cap.
  Pair history remains intact; restoration does not create another pick or charge.
- No restoration announcement, campaign email or automatic mass reopening.

## Implementation and rollout

Migration `20260928020257_persistent_love_chats.sql` adds the activity clock and
restore audit fields, neutralizes old timer writers during rolling deployment,
and provides a service-only transactional restore RPC with row locks and quotas.
Apply it before deploying the application. Do not roll it back to reinstate expiry.
The normal message notification path remains unchanged.

The FAQ explains archiving/restoration. Profile stats use message presence, not
the retired timer; digest mutual timestamps use recorded acceptance dates.

## Verification

- Typecheck, 327 unit tests and production Next build passed.
- SQL migration executed against an isolated PGlite PostgreSQL fixture, checking
  timer clearing, message activity, participant/realm/report/account restrictions,
  idempotence, quotas, rolling window and capacity. Reproduce with
  `PGLITE_MODULE=<installed module path> node tests/love-chat-lifecycle-sql.mjs`.
- Four targeted mobile browser checks passed across iPhone WebKit and Pixel
  Chromium: Archived visibility/readable chat and restore-limit error/retry.
  Initial checks caught a dropped archive prop; fixed before release.
- Browser tests used synthetic localhost users; the restore mutation was mocked.
  Database transition behavior was tested separately. Installed-device push
  delivery and real-user restoration were not exercised.
