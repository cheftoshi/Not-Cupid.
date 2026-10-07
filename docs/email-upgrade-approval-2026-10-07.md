# Email upgrade approval — October 7, 2026

Content set: `notcupid-connection-email-v2-2026-10-07`.

The user received the exact-copy review package (Library `libfile_ceb09130ccd881919e4247dae4e1b8e8`, version 0), including 15 template variants and desktop/mobile renders. The assistant explicitly explained that publication covers revised content and ongoing automatic delivery. The user then instructed: “I want to make sure you’re keeping the B wording simple and clean. So make sure that’s in play and roll it out”. This authorizes the reviewed upgrade and existing normal transactional audiences/triggers. No labeled B copy variant was found; reviewed wording is preserved.

Approved templates: sign-in, profile-ready, profile-ready-held, mutual-match, interest, message, rotation, decision, decision-final, mutual-nudge, friend-crew, passed, feedback, daily-digest, personality-results. Feedback remains operator-initiated; this does not authorize unsolicited replies. No tests that deliver, campaigns, immediate batches, replay, backfill or historical event reactivation are authorized.

Sender is unchanged: `NotCupid <match@notcupid.com>`. Reply-to resolution remains the valid configured `INBOUND_FORWARD_TO`, otherwise `match@notcupid.com`. Production reply-to remains an operational verification prerequisite: Vercel CLI has no authenticated session in the current execution environment. Do not infer its actual value from local settings.

Historical Experiment layouts are frozen in `lib/legacy-email.ts`. Five historical template modules change only their renderer import; old renderer source is byte-preserved. Old campaign copy, gates and archived 410 behavior remain unchanged. The email transport is centralized and unchanged.

## Coordinated release prerequisites

Read current production activation values and resolved reply-to with authenticated Vercel access. Preserve existing enabled/disabled state; do not enable dormant features. Coordinate deployment with these new code approval versions, changing only corresponding active version settings:

- `DAILY_ACTIVITY_EMAIL_TEMPLATE_VERSION=daily-activity-drop-v2-2026-10-07`; retain existing `DAILY_ACTIVITY_EMAILS_ENABLED` value.
- `LOVE_MUTUAL_NUDGE_APPROVAL_VERSION=love-mutual-no-message-v2-2026-10-07`.
- `PROFILE_COMPLETION_EMAIL_APPROVAL_VERSION=profile-completion-v2-2026-10-07`.

The existing preference checks, audiences, cadence, idempotency, safety checks, consent, pricing and sending logic are preserved. No production configuration has yet been changed. Do not push a release that silently stops version-gated emails because code and environment versions differ.

## Validation

Run unit tests, TypeScript and production build before commit. The isolated webpack build uses synthetic local configuration; canonical build should also pass before push. Render QA covers 15 variants at mobile/desktop sizes (30 overflow checks); native email-client delivery testing remains excluded by the no-send instruction.
