# Tide + saffron interface release — October 7, 2026

The approved direction uses deep teal `#064C48`, saffron `#F4C542`, warm paper
`#F7F5EE`, Space Grotesk headings, and DM Sans interface text. Saffron fills use
dark text; ochre is the accessible text/link counterpart. Existing color-token
names remain aliases so current surfaces share one palette. Dark-mode tokens
remain distinct. Font files are self-hosted WOFF2 (about 58 KB combined); their
SIL Open Font Licenses are included in `public/fonts/`. Source: Google Fonts'
Space Grotesk and DM Sans directories and their official WOFF2 distribution.

## Resulting experience

- Public introduction and share card use “Your connection destination.”,
  “A place to find your people.”, “Dating and friendship, with more in common.”,
  and “Start connecting”. Unused landing statistics queries and cursor-driven
  React updates are removed. The completed August experiment remains linked as
  history, rather than promoted as the current introduction.
- Home retains real invitations, requests, existing filters, and conversations.
  Its expressive header, stronger next-step cards, and visible conversation
  return point use genuine API state. No sample profiles or fabricated counts
  from the design boards enter the app.
- Shared navigation retains Home, Dating (Love Line), and Friendship access.
  Profile, city, safety, coach, and existing deep links remain available.
  Explicit Friend DM/club deep links bypass the default Home entry, fixing an
  existing routing collision caught by the authenticated checks.
- Discovery cards have more room; profile previews, conversation reading
  surfaces, plan cards, forms, login, profile/settings, optional Pro, and loading
  states share the typography and color system. Existing modal, viewport,
  keyboard, retry, and cancellation behavior is retained.
- The illustration is a small decorative static SVG reused on landing/Home.
  No video, looping canvas, cursor listener, or new animation library ships.
  The earlier cinematic animation is not integrated. Reduced-motion preferences
  disable decorative transitions globally.
- App/share metadata and existing install icons use the new identity. The PWA
  cache version refreshes stable icon/font URLs, and the cached offline screen
  uses the same brand kit. Its retry link works without an inline script.

## Product boundaries

No database migrations, matching rules, pricing, entitlements, privacy/consent
policy, payment flow, legal copy, or outbound-email template/send policy changes.
The optional AI coach and compatibility-read disclosures remain intact.

The Next 16 build compatibility fixes are narrowly scoped: await two pages'
`searchParams` promises and stop exporting a non-route constant from the
expiring-soon route. The mutual-nudge approval version and behavior are unchanged.

## Verification

- Typecheck and repository lint (`tsc --noEmit`); 384 existing Node tests.
- Local production webpack build and client bundle budget.
- Public mobile browser suite: 48 passing checks across Chromium and WebKit.
- Authenticated mobile suite against a loopback-only synthetic database adapter:
  37 checks passed on the full run; the remaining retry scenario passed on both
  browsers after making its test wait for an actual background poll rather than
  racing a transient reload button. The scenario still verifies unsent text,
  one idempotency key, and one delivered message after retry.
- The legacy Scene test now uses an explicit plan deep link, matching current
  Home-v2 routing. Two initial public failures were trace-file collisions from
  parallel suites sharing an output directory; separate directories passed.
- Desktop/mobile screenshots of actual components; repeated navigation,
  back/forward, form cancel, short keyboard viewport, theme changes, plan
  acceptance/cancellation, push-prompt positioning, and failed-request recovery.

The synthetic adapter verifies rendering and client behavior, not production
RLS/database integration or real message, email, payment, AI, or push delivery.
No production account was used for mutations. Installed-device service-worker
and native-device delivery behavior require separate device coverage.

The canonical normal production build, GitHub CI, deployment status, and live
smoke results are recorded in the operator's final release handoff.

## Structural follow-up

The original release above was the visual foundation, not completion of every
proposed screen. The subsequent non-animation implementation and item-by-item
scope are recorded in [the UI/UX worklist](ui-ux-worklist-2026-10-07.md).
Animation was explicitly deferred by the user's latest instruction.
