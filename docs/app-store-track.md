# NotCupid — App Store / Play Store track

**Goal:** TestFlight (iOS) + Google Play (internal testing → production) with the
Capacitor shell. The native app is a thin wrapper around the LIVE site
(`capacitor.config.ts → server.url = https://notcupid.com`), so every Vercel
deploy updates the app instantly — no store re-review for content changes.

## What's already done (in this repo)
- `@capacitor/core|ios|android|cli` installed; `capacitor.config.ts` configured
  (appId `com.notcupid.app`, remote URL + Stripe checkout allow-listed).
- `ios/` and `android/` native projects generated (`npx cap add ios|android`).
- Scripts: `npm run cap:sync` / `cap:ios` / `cap:android`.

## iOS → TestFlight (needs a Mac with Xcode — this machine)
1. **Apple Developer Program** — enroll at developer.apple.com ($99/yr). Use the
   business identity if Lemon Labs ever registers; individual is fine for beta.
2. `sudo gem install cocoapods` (or `brew install cocoapods`), then
   `npm run cap:sync` (installs Pods).
3. `npm run cap:ios` → Xcode opens. Set the Team (Signing & Capabilities),
   bundle id `com.notcupid.app`. Add app icons (Assets.xcassets — reuse
   `public/icons/icon-512.png` sizes; Xcode 15+ accepts a single 1024px icon).
4. Product → Archive → Distribute → App Store Connect → Upload.
5. In App Store Connect: create the app record (name **NotCupid**, category
   Social Networking, age rating **17+** — dating). TestFlight tab → add the
   build → internal testers (instant) / external testers (one-time beta review,
   usually <48h).
6. Push notifications (later, optional for beta): the site's web-push works
   inside the wrapper only on iOS 16.4+ home-screen contexts — for reliable
   native push add `@capacitor/push-notifications` + APNs key and a small bridge
   that registers the token with our `/api/push/subscribe`.

## Android → Google Play
1. **Play Console** — one-time $25 at play.google.com/console.
2. `npm run cap:android` → Android Studio. Build → Generate Signed Bundle (AAB);
   create the upload keystore (STORE THE KEYSTORE + PASSWORDS IN A PASSWORD
   MANAGER — losing it means losing the app listing).
3. Play Console: create app → Internal testing track → upload AAB → add testers
   by email. Production later needs the data-safety form + content rating
   questionnaire (dating → Mature 17+).

## Review-risk notes (read before store submission — beta is lenient)
- **Pure-webview rejection risk (Apple 4.2 "minimum functionality"):** thin
  wrappers get flagged. Mitigations before App Store (not TestFlight): native
  push, app icon/splash, and ideally one native surface (e.g. share sheet — we
  already use `navigator.share`, which works natively in the wrapper).
- **Payments (Apple 3.1.1):** digital goods ($0.99 unlock, $3.99 All-Access)
  inside an iOS app historically required Apple IAP (15% small-biz cut). As of
  the 2025 US anti-steering rulings, US-storefront apps may link out to external
  payment — **verify the current guideline text at submission time**; the safe
  fallback is an IAP bridge for those two SKUs. Google Play has an equivalent
  billing policy with a similar external-offer carve-out.
- **Dating-app requirements (both stores):** 17+/Mature rating ✓, UGC moderation
  + report/block ✓ (we have report + block + admin moderation), account deletion
  in-app ✓ (`/profile` delete). No Sign-in-with-Apple needed (email OTP only —
  the rule only triggers if you add third-party social login).
- **Privacy labels:** App Store Connect + Play data-safety forms — declare:
  contact info (email), photos, coarse location (ZIP), messages; all linked to
  identity; used for app functionality (matching). No tracking/ads SDKs.

## Suggested order
1. Play internal testing first (cheapest, fastest, no review friction) —
   validates the wrapper on real devices.
2. TestFlight internal → external beta.
3. Store production submissions only after the wrapper has native push + the
   payments question is settled.
