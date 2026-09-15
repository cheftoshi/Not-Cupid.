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

## Follow-up: finishing the pending checks and shadow queue

The initial verification/pending list above describes commit `4ee5ecc`. This
follow-up adds a forward migration and closes the following items:

- Durable, service-only embedding shadow jobs replace inline evaluation on the
  Love roster. The roster awaits only a bounded queue insert; a five-minute cron
  claims leased jobs, retries at most three times, rechecks owner consent and
  account status, and records idempotent evaluations. Live ranking and AI rollout
  flags are unchanged. Stale snapshots expire; queued payloads are deleted after
  one day and on owner consent revocation/deletion/blocking.
- Migration `20260915170635_embedding_shadow_jobs.sql` passed the linked dry run,
  was applied, and its local/remote ledger entries match. It is now immutable.
- Install prompts yield to text entry and open dialogs instead of covering chat
  controls. The install option remains accessible from the existing menu.
- Authenticated WebKit/iPhone and Chromium/Pixel checks passed for Hub, Love,
  profile and Friend layouts at normal/enlarged text and landscape, composer
  resizing, simulated interrupted Hub requests, and Friend lost-acknowledgement
  retries/polling with one client ID.
- QA uses a temporary session for an existing synthetic `is_test` account in the
  linked database, never a real/admin account. It is not a separate staging
  database. Message and AI mutation requests are mocked; the temporary session
  is deleted afterwards. No emails are sent by this runner.
- The runner uses local HTTPS because Safari honors production CSP upgrades for
  assets; tests now verify that styles actually loaded. Production TLS/CSP is
  unchanged. Service workers are blocked in the authenticated mocked tests so
  they cannot bypass request interception.
- Typecheck, all 224 Node tests, production build and bundle budget passed.
- The combined HTTPS mobile run passed all 32 tests: 14 authenticated and 18
  public, across both browser engines, including automated accessibility checks.

Still pending: physical installed-Android scroll/keyboard/resume verification,
real service-worker/offline-radio and delivery testing, and enough new-release
telemetry to measure performance and user outcomes. Simulated browser tests are
not a claim of physical-device certification or measured retention improvement.

The data-backed next product step is documented in
`docs/friend-line-growth-plan-2026-09-15.md`; it proposes an activity-first pilot
and organization Apple enrollment, not an already-executed campaign or purchase.
