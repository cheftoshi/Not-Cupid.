# Non-animation UI/UX worklist — October 7, 2026

This extends the Tide+saffron foundation released at `f78a2c0`. It implements
production components, not the exploratory 18-screen prototype. The selected
palette/fonts, static illustration, real inventory, routes and product policies
remain the basis of the app.

Latest user instruction: **“Don’t add any animation yet. But do all the other
things and update the items.”** Animation is explicitly deferred. No new animation,
video, animated asset or motion library is included in this change.

| Worklist item | Result in this release |
| --- | --- |
| Landing + share | Complete in preceding release; approved copy, responsive composition and static sketch retained. |
| Login + recovery | Shared visual system retained; existing input retention, code fallback and recovery tested. Install prompts now remain suspended when focus moves to a form's submit control. |
| Quiz intent + details | Shorter intent cards and descriptions; shared-profile wording; effort explained once; honest-answer instruction replaces performance/algorithm claim. Scoring, OTP and intent gates unchanged. |
| Public Friend Line | Removed fabricated numeric pulse cards and example participant counts; adjacent example labels retained; invitation copy avoids claiming live supply. |
| How It Works + FAQ | Four-step connection overview; setup mechanics behind an expandable section; expandable FAQ preserves full answers and adds an addressable notification-help section. Legal text unchanged. |
| Shared navigation | Persistent desktop rail at 1024px+, four-destination mobile bottom navigation; selected states, profile/settings destination, desktop coach/Pro links; measured viewport handling preserved. Actual keyboard viewport shrink controls mobile-bar visibility. |
| Connection Home | One primary action based on loaded state: pending date decisions, upcoming eligible plan, existing conversations, exploration or creation. Failures remain distinct from empty inventory. Current plan/discovery filters and deep links retained. No inferred unread-message or cross-product priority claims are introduced. |
| Love discovery + inbox | Distinct Connections and Discover people views, focused/paid-return defaults and anchor return; profile setup moved after the main journey on mobile and to the right on desktop. Existing decision/read/archive filters and free profile access retained. |
| Friend discovery + clubs | Shared responsive primary shell around existing Home/people/club implementations. Existing contextual links, direct DM/club entry and separate connection/plan rules retained rather than replacing those data models. Legacy DM recovery and plan-chat return covered by regression tests. |
| Coach + AI controls | Explicit optional-AI framing, return-to-plans/settings navigation, and settings deep link opening existing memories/permission controls. Individual memory removal, evaluation consent, cross-intent preference and provider disclosures retained. |
| Chat + conversation states | Active-conversation AI help is collapsed by default; messages and composer remain primary; duplicate score narration removed. Existing profile/plan views, safety menu, mutual gate, archived/read-only state and retry behavior retained. Keyboard and prompt positioning checked. |
| Plan discovery/create/detail | Four stages: connection/audience, idea/time, place/privacy, review. Back retains fields; required fields gate progression; final review explicitly shows venue visibility and blind-date rules. Only final submission publishes, retaining the existing payload, validation and idempotency key. Existing acceptance/cancellation/closed-detail states retained and regression-tested. |
| Profile + settings | Grouped overview: identity/preferences, discovery city, notifications, privacy/AI, account/membership. Direct links to named edit sections; email settings separated visually from age preferences. Existing explicit save, deletion confirmation and independent notification/matching semantics retained. |
| Pricing/purchase | Visible free/one-time $0.99/Pro $3.99-month comparison above optional extras; existing entitlements, checkout/provider-unavailable behavior and subscription controls unchanged. |
| Empty/loading/error states | Home skeleton follows hero/next-action/feed structure; explicit loading and failed-refresh next-action states, truthful empty next action, and preserved draft/retry states. Existing offline recovery from the preceding release retained. |
| Emails + notifications | Email wording/send rules deliberately excluded from this UI release. The stale lifecycle email needs its separate exact-copy review; nothing was sent. PWA prompt position now reserves mobile navigation space. |
| Animation | Deferred by the user. Existing static cover retained; asset inspection/integration is not a release blocker. |

## Verification boundaries

The local browser app uses a loopback synthetic database adapter and mocked
mutation responses. No production member data appears in screenshots. These
checks validate real rendering/client behavior, not production RLS or real
email, payments, AI, messaging or push delivery. No real outbound communication
or purchase is exercised.

The acceptance matrix includes phone Chromium/WebKit, desktop/tablet/narrow-phone
captures, route/back navigation, required-field and Back behavior, publication
only after review, consent/settings entry, private venue policy, retry and draft
retention, cancelled/read-only conversations, and push-prompt placement.

Physical iOS/Android installed-PWA keyboard/safe-area/push behavior and manual
screen-reader testing still require device coverage. Emulation is not a substitute
for those checks. The seeded real-database integration gate remains unrun; local
fixtures must not be described as a migrated production/staging database.

The October 7 deploy/HTTP/browser checks are smoke checks, not new production
activity metrics. The latest activity snapshot collected in this task remains
October 5 at 18:04:57 UTC, compared with October 3 at 14:55:16 UTC.

## Local validation completed after reconnect

- Canonical `npm run build` (Turbopack) and `npm run typecheck`: passed.
- Unit/policy suite: 384 passed, zero failures or skips.
- Authenticated Chromium/WebKit suite: 50 passed, including all 12 new journey checks.
- Public Chromium/WebKit suite: 48 passed, including automated accessibility checks.
- Coach/Friend DM draft recovery: separate focused rerun, 4 passed.
- Client budget: 40 chunks, 1,886,333 bytes total; largest 239,745 bytes.
- Final isolated preview build: passed; same application sources as canonical.
- Responsive previews: 44 route/viewport captures and 12 focused captures;
  no recorded page errors or horizontal overflow in the captured checks.

Commit, exact-commit CI and deployment status are recorded in the final
handoff. If rollback is needed, revert this release commit (preserving subsequent
work) and run normal CI/deployment; `f78a2c0` is the preceding known-good release.
