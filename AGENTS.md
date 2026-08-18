# NotCupid — current project memory

Last reconciled with the current application code on **August 18, 2026**.

This file is a current-state handoff, not a chronological session log. Git history
contains retired plans and earlier implementations. Do not reintroduce an older
date, term, price, launch gate, or product rule from commit history or from an
older migration without checking the current sources listed below.

## Source of truth

Use this order when facts differ:

1. The linked production database is authoritative for mutable operational
   state such as event status, entry counts, shortlists, outcomes, and delivery
   records.
2. `lib/raffle.ts` is authoritative for the deployed Dating Experiment code
   gate, public labels, deadlines, limits, and fallback configuration.
3. The newest applicable file in `supabase/migrations/` is authoritative for
   current schema/data evolution.
4. Older migrations, `supabase/legacy-migrations/`, and
   `supabase/apply-all.sql` are immutable historical records. They intentionally
   contain superseded values and must never be treated as current product copy.

Live analytics change continuously. Query the production admin/API instead of
copying entry, traffic, or delivery counts from a handoff document.

## Current Boston Dating Experiment

- Public name: **The NotCupid Dating Experiment**. Never call it a raffle in
  public UI, email, social copy, FAQ, or terms.
- Internal compatibility note: the `RAFFLE` constant, `/api/raffle/*` routes,
  `raffle_*` tables, and `raffle-videos` bucket retain legacy names so the
  shipped system does not need a risky data/API migration.
- Event key: `boston-dating-experiment-v1`.
- Status: public entry is open in code and the production event is
  `entry_open`.
- Entry deadline: **Tuesday, August 18, 2026 at 11:59 PM ET**, or 400 eligible
  entries, whichever comes first. The exact server boundary is
  `2026-08-19T04:00:00Z`, midnight starting Wednesday in Boston.
- Shortlists are scheduled to start **Wednesday, August 19 after entries
  close**.
- Dinner: **Thursday, August 20, 2026**, with one pair at **6:30 PM ET** and one
  pair at **8:30 PM ET**.
- Venue: The Berkeley, 154 Berkeley Street, Boston, MA 02116. The venue is
  revealed privately to selected pairs, not in public event payloads.
- Prize: up to two disjoint selected pairs/four people. NotCupid covers up to
  **$200 per pair / $400 aggregate** through the prepaid restaurant arrangement.
- Eligibility: genuine non-test account, age 21+, Massachusetts, within about
  20 miles of 02116, and a complete core profile.
- A 5–15 second private intro video is optional and selection-neutral.
- Current terms: `boston-v13-2026-08-15`.
- Current algorithm: `dating-experiment-two-pair-v4`.
- Entrants select every dinner slot they can attend and answer the four event
  prompts. Event preferences are snapshotted and do not rewrite Love Line
  preferences.
- Mutual gender, age, radius, and shared-slot preferences are hard gates. Fit is
  75% core NotCupid compatibility, 15% shared interests, and 10% event answers.
- Every gender/orientation receives the same coverage-first cap of up to two
  private options. Choices are sealed. Only mutual yes pairs enter the final
  slot-aware, payment-neutral weighted selection without replacement.
- Test accounts are ineligible and must not count toward capacity or public
  metrics.

The current operating record is
`docs/dating-experiment-public-launch-checklist-2026-08-15.md`. The deadline
extension is migration
`20260816160000_dating_experiment_extend_entry_deadline.sql`.

### Retired experiment facts — do not use

All earlier event names, dinner dates, deadlines, smaller entry caps, mandatory
video rules, paid-entry weighting, pre-v13 terms, quiet-mode notes, and closed
public code gates are historical only. Older applied migrations preserve some
of those values as chronological data; later migrations and current code
supersede them.

## Outbound email — non-negotiable approval rule

- Never send an email without the user's explicit approval in the current
  conversation. This includes tests, previews that deliver, samples, individual
  messages, waves, and campaigns. A dry run is allowed only when it provably
  delivers nothing.
- Before asking for content approval, show the exact subject, rendered body,
  sender, reply-to, every CTA/link, audience definition, exact recipient count
  or named test recipient, and whether it is a test or production send.
- Content approval is not send approval. Ask separately for permission to
  execute the exact send. Any change to copy, links, sender, audience, count, or
  send type invalidates the earlier approval.
- Never infer approval from credentials, dashboard access, infrastructure
  testing, a dry run, or an earlier campaign.
- Narrow standing exception approved August 10: fixed transactional emails for
  an actual new/mutual Love match and the standard Love roster-rotation email
  may send automatically. The rotation email may send only after a genuine new
  candidate ID enters a previously composed roster, for a real user active in
  the last 12 days who has not opened the changed roster, no more than once per
  seven days. The approved subject is “Your Love Line roster just rotated” and
  the approved template is `loveRotationEmail` in `/api/cron/rematch`.
- The Dating Experiment comeback campaign v5 was explicitly approved for and
  sent once to 394 recipients. Do not resend it from this note. Query the live
  delivery ledger/Resend for current delivery and engagement data.
- The short profile-ready reminder content
  `dating-experiment-ready-reminder-v1-2026-08-17` is approved. Its dedicated
  campaign key is `dating_experiment_ready_reminder_aug17_2026`. Content
  approval is not send approval: refresh the exact audience and obtain a
  separate count-specific authorization before setting the send-approval env or
  delivering it. The production route defaults to a no-delivery dry run.
- The consolidated daily Love + Friend activity email is implemented and
  content-approved as `daily-activity-drop-v1-2026-08-17`. On August 17, 2026,
  the operator separately authorized the initial 112-recipient production send
  and standing automatic daily delivery of that exact version. The cron remains
  fail-closed unless both versioned production activation variables match. A
  content, sender, link, audience-policy, or cadence change requires fresh
  content and send approval. Delivery is permitted only from 1:00 through 1:14
  PM in `America/New_York`, including manual invocations, and at most once per
  recipient per Eastern calendar day. A late scheduler run must skip delivery
  rather than send outside that window. Vercel attempts the job at 1:00, 1:05,
  and 1:10 PM; a database `(user_id, delivery_day)` claim prevents duplicates
  while allowing provider failures to retry inside the approved window.
- A mutual-match/no-message 12-hour nudge is implemented as
  `love-mutual-no-message-v1-2026-08-18`, but it is fail-closed unless
  `LOVE_MUTUAL_NUDGE_APPROVAL_VERSION` exactly matches that version. Its copy
  and delivery are not approved merely because the code exists; do not set the
  activation variable or deliver it without the current-conversation approval
  required above.

## Current product behavior

### Love Line

- Roster-first matching: up to ten curated candidates (three included picks
  plus seven browseable alternatives), no swiping or public
  browsing.
- A user has three included outgoing picks per 24-hour roster cycle. The live
  connection safety ceiling remains ten; a fourth and later distinct outgoing
  pick uses Pro or a one-time $0.99 extra-connection entitlement.
- A recipient is hidden from new rosters while three incoming decisions are
  unanswered; an explicit Yes or Pass restores responsiveness standing.
- Picking creates a 72-hour pending invitation. Chat opens only after mutual
  acceptance.
- Ending a pending or mutual connection closes the pair, records no-repeat
  history, returns both people to the pool when eligible, and frees a slot.
- Matching activity segments authenticated users as recent (0–3 days), active
  (4–12 days), and dormant fallback. Candidate exposure cooldown is seven days.
- Roster verification may run every 24 hours; that is not an email cadence.
  Rotation notification requires a real candidate-ID addition and has its own
  seven-day notification cooldown.
- Test/real realm segregation is mandatory on every people query and write.
- The Love mobile/PWA connection inbox uses `all`, `your move`, `chatting`, and
  `waiting` filters. Every roster profile is free to preview; never place basic
  profile viewing, accepting, replying, blocking, or reporting behind payment.

### Friend Line

- Friend Line is live. It includes intent-based discovery, persistent 1:1
  connections/DMs, group pack chat, Scene plans/posts, clubs, and approved
  community links.
- Choosing “I’m interested” on a Scene plan opens that plan’s participant-only
  chat with the organizer. It does not bypass the 1:1 connection rule. Plan-chat
  replies push the organizer and interested participants and deep-link back to
  the exact plan.
- Pack, club, plan-chat, and Friend DM messages attempt immediate web push to
  the relevant real recipients with an active subscription. Unsubscribed
  devices receive in-app unread badges. The consolidated daily activity drop
  can include still-new or unread Friend conversations and eligible local
  plans, but remains template-and-standing-send approval gated.
- Friend discovery and content are metro-bounded and realm-segregated. A user
  can change the active city on the relevant Love/Friend surface; existing
  connections persist.
- Pack membership/group chat is not the same as a durable 1:1 connection. Only
  an explicit connected pair may use private DMs.
- The north-star action is a real connection action—signal, connect, club or
  community join, RSVP, or conversation—not passive page views.

### Monetization

- A fourth or later distinct outgoing Love connection in the current roster is
  a one-time $0.99. If the other person declines or the request expires before
  mutual connection, that entitlement returns as an in-app Love credit.
- Additional Friend packs: $0.99; first pack free.
- All-Access: $3.99/month.
- Acceptance and replies are always free. Chat is included after mutual
  connection; Dating Experiment entry/selection is not paywalled.

### PWA and native plan

- The PWA is the current production app. Web push is active; iPhone push needs
  an installed Home Screen PWA on iOS 16.4+ and user permission.
- The chosen native path remains PWA first, then a Capacitor App Store/Play
  wrapper when traction justifies native distribution. Store billing must be
  implemented before exposing digital Stripe purchases inside an iOS wrapper.

## Accounts, privacy, and operator facts

- Test accounts use `users.is_test` and must never appear to real users or in
  real public/admin counts. All cross-realm matches, Friend connections, DMs,
  Scene interactions, and experiment entries must fail closed.
- NotCupid is owned and operated by Lemon Labs.
- Public postal address: 109 California Ave, Quincy, MA 02169.
- Public/support email: `match@notcupid.com`; replies are forwarded through the
  verified inbound email workflow.
- Never expose service keys, private reservation references, exact user ZIPs,
  private experiment videos, or precise last-seen timestamps to clients.

## Stack, migrations, and deployment

- Next.js 16 App Router, Supabase/Postgres, Vercel Pro, Resend, Stripe.
- GitHub: `cheftoshi/Not-Cupid.`; `main` auto-deploys through Vercel.
- Local secrets live in gitignored `.env.local`; production secrets live in
  Vercel. Never commit or print secret values.
- The CLI baseline is
  `supabase/migrations/20260804190000_remote_baseline.sql`; pre-baseline SQL is
  in `supabase/legacy-migrations/`.
- Create every new database change with `supabase migration new <name>`. Then
  run `supabase db push --linked --dry-run`, verify the exact set, run
  `supabase db push --linked`, and confirm with
  `supabase migration list --linked`.
- Never edit an already-applied migration to make its old values look current.
  Add a new forward migration instead. Never use `--include-all` to bypass a
  ledger mismatch and never append new work to `supabase/apply-all.sql`.
- New tables need explicit table privileges for `service_role` in addition to
  RLS. Client components must not directly query sensitive Supabase tables with
  the anon client.
- Before committing: inspect the diff, run the relevant tests, run
  `npm run typecheck`, and run `npm run build`. Do not push a build you have not
  verified locally.
- Preserve unrelated user changes in a dirty worktree. Do not delete duplicate
  looking files until imports/history prove they are unused.

## Working principles

- Public copy and code should describe the product that is live now, not an old
  launch plan.
- Favor one canonical current-state source over accumulating dated,
  contradictory notes.
- Use migrations as immutable history and documentation as current truth.
- Matching must remain reciprocal, capacity-aware, realm-safe, and free of
  duplicate pairs.
- Pool density is primarily a supply problem. Algorithm changes improve fit and
  fairness but cannot manufacture reciprocal candidates in a thin metro.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
