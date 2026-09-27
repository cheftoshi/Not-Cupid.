# Date-plan notification follow-up

This batch follows `700ee3c`. Date invitations remain free and separate from paid Love picks.

## Changes

- Request pushes use one stable key per request, including withdraw/re-request cycles. The new forward migration preserves the earliest historical job as the dedupe record and skips queued/retrying duplicate jobs without deleting audit history.
- Irrelevant notices and unavailable push destinations are recorded as skipped, not delivered. Successful provider acceptance counts as delivery; this does not prove a device displayed or opened the notification. Historical delivery counts are not retroactively guessed.
- Date outcomes can be dismissed persistently by their requester. Default Home outcomes age out after 30 days from resolution (expiry time for expired invitations). Historical transition timestamps are unavailable and conservatively fall back to request creation time. Direct links still explain closure. Active/accepted chats are not dismissed.
- Push/install prompts survive scrolling and ordinary button taps. They suspend during input or a dialog and return afterward. Home reserves measured prompt height for its footer and floating conversations control. Dialog observation is filtered and coalesced instead of rescanning the whole page on every mutation.
- No email copy, audience, cadence, or send authorization changed. No real customer sends are part of QA.

## Verification

- 277 unit tests passed, including execution of the outbox with mocked provider/database boundaries.
- Production build, TypeScript, and client bundle budget passed.
- Lifecycle SQL assertions passed inside rolled-back transactions before and after migration application, using synthetic accounts only.
- Forward migration `20260927231217` confirmed in the production ledger. The CLI's optional local Docker catalog cache warning did not prevent remote application.
- 84 authenticated/public iPhone-WebKit and Pixel-Chromium checks passed, including prompt persistence, reachable controls, and outcome dismissal. Temporary test session removed.
- Deployment identifiers are recorded in the release handoff after completion.

## Remaining device validation

Browser emulation cannot prove physical installed-PWA behavior or APNs/FCM delivery. A consenting real-device tester must verify install/permission, a real request notification, deep link, and accepted chat. No guarantee of zero future bugs is implied.
