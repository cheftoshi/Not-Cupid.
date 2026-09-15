# UI/UX release — September 15, 2026

This is an implementation and verification record, not a claim of measured
retention improvement or a complete physical-device certification.

## Implemented

- Stable pre-hydration viewport/header sizing, coalesced viewport updates, and
  a settled keyboard-dismissal measurement to recover the available screen area.
- Surface-specific Hub/Love/Friend loading placeholders rather than the same
  generic loading screen; static placeholders respect reduced-motion needs.
- Larger primary chat, connection-filter, RSVP, and concierge controls, visible
  focus indicators, and fewer competing mobile scroll containers.
- Friend DM/club pending and failed messages survive polling, with explicit
  retry buttons that reuse the original client ID. GET responses expose a
  sender's own client IDs for lost-acknowledgement reconciliation. Load failures
  are no longer returned as an empty successful conversation.
- Typed DM/club composer drafts survive closing/reopening while the Friend
  component stays mounted. These are in-memory drafts, not durable storage;
  failed message bubbles are not guaranteed across navigation/reload.
- Love, plan, and pack retries reuse the same ID for the same uncertain send;
  failed sends preserve existing typed text. A valid first greeting is no longer
  blocked by the old “send again” coaching gate.
- A simpler Hub header and brief; optional matching controls stay in AI controls
  rather than occupying the main conversation. Consent requirements are unchanged.
- Love decisions appear before unread chats, starter opportunities, and waiting
  invitations. Pending cards show their existing deadline in Eastern time.
- Free profile viewing and the actual remaining included-pick balance are clear.
  Entitlements, prices, safety limits, and eligibility rules are unchanged.
- Scene interest confirmation points to the participant-only plan chat.
- Failed roster refreshes preserve the last roster and offer retry. Independent
  signal lookups run alongside pool/history queries. Server-Timing distinguishes
  authentication and roster composition latency.
- Push enabling reports failure truthfully and remains dismissible when browser
  storage is unavailable. Notification/email cadence and audiences are unchanged.
- CLS telemetry accepts only a fixed whitelist of UI-region names, never message
  text, element IDs, or arbitrary selectors.
- Authenticated mobile tests cover enlarged text, landscape, and Hub composer
  resizing. `npm run test:e2e:release` requires an explicit seeded test session
  instead of silently skipping authenticated checks.

## Verification

The original macOS dependency/build-cache tree stalled filesystem traversal.
Verification therefore uses a clean mirror of the exact base commit with this
working-tree patch overlaid and a fresh lockfile-based dependency install.
No dependency versions changed and no database migration is required.

- TypeScript check: passed.
- Node regression suite: 221 passed.
- Optimized Next.js production build: passed.
- Client bundle budget: passed.
- Existing public mobile suite: 18 passed across iPhone/WebKit and Pixel/Chromium,
  including login keyboard-viewport and automated accessibility checks.
- Browser skill visual check: local phone-sized login renders within the viewport.

The initial sandboxed browser test invocation could not launch browser processes;
the same suite passed when allowed to launch outside the sandbox.

## Still to verify or implement

- A real installed Android PWA: drag/scroll, keyboard open/close, orientation,
  resume, profile-card scrolling, and accessibility font settings.
- Full authenticated journeys against an explicitly provisioned non-production
  test session. No real user account was impersonated or messaged for this release.
- Real offline/reconnect/send-retry end-to-end scenarios, beyond unit coverage.
- Moving optional shadow evaluation off the roster request into a durable job;
  this release parallelizes lookups but does not add a background job system.
- Post-release, compare device/path/release-segmented CLS and roster latency with
  the pre-release baseline, then reciprocal connections and first replies. Do not
  infer user-outcome improvement from passing tests or page views.

Stripe activation, AI rollout allocation, closed Dating Experiment state,
notification-outbox operations, and outbound email approvals are outside this
UI/UX batch and have not been changed.
