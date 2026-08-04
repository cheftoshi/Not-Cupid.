# NotCupid — App Store / native release track

Updated August 4, 2026.

## Decision

Enroll in the Apple Developer Program now and use TestFlight, but do not send
the current remote-web wrapper to public App Review yet.

- Membership is $99 USD per year.
- If Lemon Labs is a registered legal entity, enroll as an organization so the
  company—not an individual founder's legal name—appears as the seller. Apple
  requires a D-U-N-S number, organization-domain email and public website.
- If the legal entity is not ready, individual enrollment can unblock internal
  TestFlight, but the person's legal name is shown as the seller.

Official enrollment requirements:
https://developer.apple.com/programs/enroll/

## What is already in the repository

- Capacitor 8 core/iOS/Android/CLI and generated `ios/` + `android/` projects.
- App ID `com.notcupid.app`, icons, PWA manifest, service worker and offline page.
- Phone-safe Friend Line layouts, safe-area insets and PWA/native runtime
  separation. The native shell no longer offers “Add to Home Screen” or tries
  to use browser Web Push.
- Account deletion in `/profile`; safety, privacy, terms and contact surfaces.

## Public-release blockers

### 1. Replace the remote production wrapper

`capacitor.config.ts` currently uses `server.url = https://notcupid.com` for
internal device testing. Capacitor labels `server.url` and `allowNavigation` as
live-reload options that are not intended for production. It also leaves
NotCupid exposed to Apple's minimum-functionality rule for repackaged websites.

Before a public submission, ship a local app entry point and make remote calls
to the NotCupid APIs, or build meaningful native-owned surfaces around the
web experience. Do not market the current remote wrapper as release-ready.

### 2. Add reliable native push

Browser Web Push is correct for the installed PWA. The iOS app needs APNs:

1. Add the Push Notifications capability and APNs entitlement in Xcode.
2. Add `@capacitor/push-notifications` and request permission after an in-app
   explanation triggered by a user action.
3. Store APNs tokens separately from web-push subscriptions, including platform,
   environment, user and last-seen timestamp.
4. Update/expire tokens and route notification deep links into the right chat,
   match, plan or club.

Apple APNs registration guidance:
https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns

### 3. Settle native digital payments

NotCupid's Stripe checkout is fine on the website, but digital unlocks and
subscriptions offered inside an iOS app fall under App Review Guideline 3.1.1.
The lowest-risk release is StoreKit/In-App Purchase for native purchases, with
server-side entitlement reconciliation. For the first TestFlight build, hide
native purchase entry points until that bridge is complete. Do not assume the
US external-link treatment applies in every storefront.

### 4. Finish the social/UGC review surface

Apple requires social apps to provide objectionable-content filtering, reports
with timely response, user blocking and published contact information. Verify
all four in the actual iOS build—not only in admin code. Give App Review an
active demo account or a full demo mode with populated Friend Line, Love Line,
chat, travel and club data.

### 5. Complete App Store privacy and age-rating disclosures

The privacy label must include data collected in embedded web views and by
third-party SDKs. Audit at least email/contact info, photos, approximate location
(ZIP/metro/trip), messages and other user content, account/device identifiers,
purchase history and diagnostics as actually used. A privacy-policy URL is
required. Complete Apple's current age-rating questionnaire for dating, chat,
UGC and social capabilities; select the resulting rating accurately.

Privacy details:
https://developer.apple.com/app-store/app-privacy-details/

## Why NotCupid can pass the crowded-category test

Guideline 4.3 says dating is a saturated category and new apps must offer a
unique, high-quality experience. The submission story should lead with the
connection/community product—not “another dating app”:

- no-swipe, compatibility-limited Love Line;
- Friend Line routing people into concrete plans, clubs and communities;
- metro-aware travel discovery before arrival;
- scarcity plus real-world follow-through rather than an endless feed.

The build must demonstrate these differences immediately. Screenshots, review
notes and demo data should all reinforce that story.

App Review Guidelines:
https://developer.apple.com/app-store/review/guidelines/

## Recommended sequence

1. Enroll (organization preferred) and create the App Store Connect record.
2. Build with Xcode 26 or later and the iOS 26 SDK, which Apple requires for
   uploads as of April 28, 2026.
3. Add native push, deep links, share/haptics/keyboard handling and the local
   release entry point; hide Stripe purchase UI until StoreKit is ready.
4. Run on physical iPhones, including compact and notched/Dynamic Island sizes.
5. Ship an internal TestFlight build (up to 100 internal testers).
6. Add a small external beta; TestFlight supports up to 10,000 external testers
   and builds are testable for 90 days. The first external build is reviewed.
7. Complete privacy, age rating, review notes, demo access, screenshots and
   moderation proof; submit public release only after the blockers above close.

Current upload requirements:
https://developer.apple.com/news/upcoming-requirements/

TestFlight overview:
https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/

Eligible developers under $1M proceeds can apply for Apple's Small Business
Program and a 15% commission rate:
https://developer.apple.com/app-store/small-business-program/
