# Reliability and engagement batch — September 23, 2026

Scope: priorities 1–5 approved after the September 23 status check. Stripe, paid entitlements, matching weights, email copy/cadence, and AI consent/rollout settings are unchanged.

## 1. Mobile login recovery

OTP send and verify now have a 12-second deadline including body parsing, explicit response validation, duplicate-submit protection, cancellation on offline/page-hide, and accessible recovery messages. Email/code stay in the form for a manual retry. An uncertain send offers “Already have a code?” instead of automatically sending another email. Returning-user deep links are preserved and restricted to safe app paths. Autofill labels support email and one-time-code entry.

Anonymous `login_recovery` diagnostics record only send/verify stage and a bounded failure category. They never contain email, OTP, destination, or raw errors. Admin distinguishes handled failures/cancellations from uncaught crashes.

Limit: the September 21 anonymous login promise error had no usable source/stack. These repairs cover reproduced request failures; they do not establish that historical error's root cause. Draft preservation applies within the current page, not after an OS process kill.

## 2. Love roster latency

Pick-access reads now run alongside candidate discovery after expiry cleanup. This removes a sequential database dependency without caching balances or eligibility. Failed history/capacity reads now return a retryable roster error rather than silently treating candidates as unseen or available. Client reads bound both headers and response-body time while preserving the last roster on refresh failure.

Limit: September 23 production p75 was approximately 1.45 seconds. A post-release comparison is required before claiming a measured speedup. No eligibility rule or free-pick allocation was changed.

## 3. Love choice friction

“None of these feel right” now offers optional fixed reasons: distance, interests, intentions, repeated options, not ready, or prefer not to say. The existing `no_suitable_choice` event still measures the initial action (now once per mounted view to reduce duplicate taps); a separate `roster_feedback` event captures an optional reason. Users can review preferences; no preference or ranking is changed silently. Copy explains that refresh cannot guarantee new eligible people.

Limit: two successful pickers among 23 roster viewers is a diagnostic signal, not proof of an algorithm defect. The nine recorded no-choice events reported seven candidates twice and ten candidates seven times, not empty rosters. We do not infer a reason from non-response or private conversations.

## 4. Shadow AI diagnostics

Admin now distinguishes runtime disabled, unavailable diagnostics, overdue queue, failures, low embedding coverage, insufficient reciprocal coverage, and no recent jobs. It shows queue outcomes, skip/failure reasons, and the last observed finished job. The five-minute worker schedule is separate from daily embedding maintenance. Empty one-day-retention queues never certify scheduler health.

Live read-only evidence: two consenting real users, two ready users, four embeddings, zero evaluations, and no retained jobs. Promotion requires ten consenting users plus its other existing evidence gates. The production runtime flag and scheduler execution were not independently verified in this batch. No forced evaluation, consent enrollment, rollout expansion, or kill-switch change was performed.

## 5. Friend discovery-to-conversation path

Only confirmed “interested/yes” opens the plan chat directly. Save/maybe does not grant access. Conversation reads show loading, retry, and sign-in guidance rather than presenting failed requests as empty conversations. Failed sends retain drafts and retry IDs; polling reconciles a sender's client IDs. A starter button fills an editable draft and never sends it automatically.

Admin now reports plans with participant messages, plans with later organizer responses, and plans without an observed organizer response within the last 30-day window. Only timestamps/participant IDs are used, not message text; test/deleted/admin users and test plans are excluded from the new metrics. These are activity counts, not a claim of confirmed attendance or semantic reply quality.

Live inventory check found seven non-test stored items, no future-dated plans, and two undated plans. Expiry/metro rules may further reduce visible inventory. Actual upcoming hosted plans and responsive organizers are still needed; this batch does not invent or publish plans.

## Verification and release

- TypeScript and 244 unit/regression tests passed.
- Production build passed in a clean temporary checkout; the main Mac checkout build stalled before compilation.
- Bundle budget passed: approximately 1.66 MB measured chunks; largest approximately 240 KB.
- Final iPhone/WebKit and Pixel/Chromium regression suite: all 70 checks passed against the exact application source prepared for release (1.6 minutes). Temporary synthetic session cleanup succeeded.
- Browser mutations are mocked; authenticated rendering uses an existing synthetic test account and removes the temporary session after each run. No real-user selections, messages, OTP emails, or payments are executed.
- Physical installed-PWA background/keyboard/OS behavior still needs device acceptance.
- No database migration is required. The operator explicitly approved commit, push, and production deployment after verification. This document records the pre-release checkpoint; GitHub commit/deployment status is the source of truth for completion, not this approval note.
