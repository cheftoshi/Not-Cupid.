# Connection-first Home release

User-approved scope: ship the reviewed Home, preserve NotCupid's app colors,
and keep date invitations free rather than charging Love Line pick credits.

## Implementation

- Personal Home at `/hub`, real member plans, Friends / Dates / Your invitations.
- AI remains available through `/hub?view=coach`; Love and Friend stay reachable.
- Desktop conversation rail; dismissible mobile conversation sheet; retained
  drafts and same-ID message retries after uncertain sends.
- Simple group invitation, neighborhood, optional public venue, flexible time.
- Approximate neighborhood distance and radius filter, no device GPS.
- Venue visibility is server-enforced, not hidden with client CSS.
- Free two-person dates, profile-first or blind, explicit gender preferences,
  adult eligibility, host approval, cancellation, report/block, private chat.
- No changes to paid Love roster rules or Stripe. No new email content/sends.

## Release gates

Migration `20260925011141_connection_plan_location_privacy` must precede the
application deploy. It is additive; old clients keep existing social-plan flow.
Never remove these tables when rolling back the application.

Rollback-only database validation passed: duplicate requests, exactly-one
acceptance, pending/outsider chat denial, same-ID message retries, reporting,
private location isolation, idempotent social RSVP, capacity and table grants.
Every synthetic fixture was rolled back. No notification was delivered.

Local release verification completed: 266 unit tests, typecheck, production
build, bundle budget, and 76 WebKit/Chromium regressions passed. The mobile
suite includes authenticated read-only checks against the migrated database
and mocked date creation/acceptance/message recovery. Temporary test sessions
were removed. Migration local/remote ledgers match. GitHub deployment and
live-site verification are still required before announcing the app as live.

## Deliberate limitations / next batch

- No maps, travel-time promises, venue verification or precise GPS collection.
- Public-place confirmation is a user declaration. Titles/bios/free text can
  identify a person or place; blind mode is not guaranteed anonymity.
- Existing legacy social plans retain their original public venues; private
  visibility is available through the new create/edit flow.
- Date notifications attempt web push only where permission/subscription
  exists. New email/digest templates need separate copy and send approval.
- Mobile automation covers WebKit/Chromium viewports and recovery. Physical
  Android/iOS installed-PWA testing remains a separate real-device check.
- No guarantee of people/plans in low-density areas; do not seed fake people.

The `design-previews/connection-home` folder is the historical fictional
review sandbox, not the authorization model or production Home implementation.
