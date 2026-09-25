# NotCupid: connection-first product plan

Status: proposal for review, September 23, 2026. Not a production release record.

### Review preview — September 24

**Latest review revision:** The running sandbox now uses the v2 design in `design-previews/connection-home/`, not the original Home snapshot described below. It has a personal greeting, upcoming get-together, connection summary, “Discover” navigation, and right-side chat (mobile sheet). Dating is now interactive **in the sandbox only**: profile-first/blind choice, explicit gender preferences, host review, exactly two people, and private chat after acceptance. Blind profile identity reveals after acceptance; age/gender/interests remain visible before it. The user requested these product controls in review; payment policy and production authorization remain unresolved. See that folder's README for exact scope and limits. No production behavior changed.

**Location preview update:** Required neighborhood, optional public meeting place or “Decide together,” friendship visibility controls, date venue reveal after acceptance, and host editing within chat are now available in the sandbox. Boston-only demo defaults are not live GPS. Typechecks and 10 focused model tests pass; interactive creation/editing/acceptance and phone-width editor checks passed. Real storage, server-side venue redaction, geocoding, multi-city support, and device verification remain pending. No deployment.

Original preview baseline (superseded by the v2 sandbox above):

- Local interactive sandbox: `http://127.0.0.1:3107`, running from `/private/tmp/notcupid-home-preview-63naAN`. Available on this Mac while the local server is running; not a publicly hosted link.
- Uses a snapshot of the draft Home component and CSS with in-memory sample plans/chat. It has no production credentials or backend routes; it does not fetch live members or send notifications. Refresh resets sample changes.
- Browser-checked: posting, joining, sample chat, passing, undoing a pass, and 390px/320px layout widths without horizontal document overflow. This is browser-layout verification, not physical Android/iOS certification.
- Found and fixed an unreadable primary-button label: the text color referenced a gradient token instead of a solid color. The fix is also in the app draft with a regression assertion; five focused Home tests pass. The isolated preview also passes TypeScript checking.
- Sample date requests are disabled. AI/Love/Friend navigation displays a scope notice rather than opening real app flows. Host acceptance, cancellation, real notification delivery, and production rollout are still pending.
- To restart the sandbox on this Mac: `cd /private/tmp/notcupid-home-preview-63naAN` then `WATCHPACK_POLLING=1000 npm run dev`. Polling avoids the local file-watcher limit encountered during setup.

## Outcome we are building toward

**“I have something I want to do. Help me find the right person or small group nearby to do it with.”**

Members create the invitations. Friendship and dating are explicit choices. Both sides retain control. AI helps with wording, finding relevant plans, and coordination when asked; it is not the mandatory first screen, an invented host, or an autonomous participant.

The repeat-use hypothesis is: a useful invitation leads to a response, a real conversation, a meetup, and another plan together. This is a hypothesis to test, not established product-market fit. We should optimize meaningful weekly connections, not require people to browse daily.

## What is live versus local

- The preceding reliability release was deployed at commit `7bc4d1718d2ae8e1c44ec46c35d3ba9b3a57f2ac`.
- An unpublished, uncommitted local prototype now puts member plans at `/hub`, with the existing concierge at `/hub?view=coach`.
- The draft reuses Friend Scene activities, RSVP, and participant chat. It includes a short form, feed filters, recovery states, and exact-plan push links.
- Typecheck and 248 unit tests passed for the draft. This does **not** certify mobile behavior, production build, permissions, or complete product flows. New Home end-to-end tests and physical-device checks remain.
- No redesign deployment, customer campaign, real-user plan, RSVP, or chat message was performed as part of this prototype.
- The existing AI thesis describes the shipped experience. This document proposes a different front door; update canonical product memory only when the approved design actually ships.

## Research: borrow useful patterns, not another product

| Product / source | Observed positioning or pattern | Implication for NotCupid |
| --- | --- | --- |
| [Meetup event creation](https://help.meetup.com/hc/en-us/articles/39790436736525-Creating-an-event) | Event details and organizer-managed activities | Keep advanced organization optional; everyday invitations should not feel like creating a formal club event. |
| [Timeleft](https://timeleft.com/about/) and [dinners](https://timeleft.com/dinners-with-strangers/) | Matched social experiences, including dinners and other activities, with connection beyond the initial event | “Real people meeting offline” is not unique. Test member choice of activity, timing, and explicit connection intent as our emphasis. |
| [222](https://222.place/) | Organized experiences with matched people | Offer an easy route for a member's own walk, tennis session, lunch, or date invitation, rather than relying entirely on centrally organized experiences. |
| [NiceToMeetYou](https://nicetomeetyou.ai/) | Matched small groups, venue selection, and pre-event coordination | Chat and coordination are essential, not sufficient differentiation. This assumes the user meant NiceToMeetYou.ai; confirm the exact competitor before formal comparisons. |
| [Luma waitlist](https://help.luma.com/p/waitlist) | Waitlisted and admitted attendees are distinct states | Never call an interested or waitlisted person “going,” and never imply a reserved spot before acceptance. |

These are product observations, not claims that competitors lack every proposed feature. There is no evidence here for a retention uplift, unique algorithm, or competitor-beating PMF.

## Proposed experience

### Home: things you can actually do

1. A compact location control and “Make a plan” button.
2. Real, available invitations from eligible members in that location.
3. Filters: For you, Friends, Dating, Your plans. Passed items are recoverable but not dominant.
4. Each card answers: who, what, friendship/date intent, when, approximate public place, available spaces, and the next action.
5. Direct access to existing Love connections, Friend communities, messages, and optional AI help. Do not bury established conversations during the redesign.

Default to the connection types the member explicitly chooses. Someone choosing both sees both with clear labels. A Friend-only user may deliberately explore Dating, but is never silently made visible for romantic discovery. Existing quiz completion is not a durable substitute for explicit intent preferences.

No external event imports or fabricated inventory. If the selected city/filter has nothing available, say so and offer to post a plan or deliberately change filters. Preserve the user's chosen city; do not silently fill NYC with Boston plans.

### Create: one thought, a few optional details

- Required: “What’s the plan?” and a clear friendship/date choice, with a remembered editable default after the first selection.
- Optional details: time, public meeting place, one-on-one or small-group capacity, and a short note.
- Example: “Walk around Boston Common after work?”
- Flexible time is allowed, but shown as “Time to be agreed.” A flexible plan is not a confirmed appointment and still has an expiry policy.
- AI drafting is an optional action. Posting always requires the user's explicit tap.
- Public cards must not disclose home addresses or private contact details.

### Respond: different states mean different things

| Situation | Initial action | When it becomes confirmed | Chat access |
| --- | --- | --- | --- |
| Open social group | Join, subject to available capacity | Server confirms the spot | Confirmed participants and organizer |
| Approval-required group | Request to join | Organizer accepts | Accepted participants and organizer |
| One-on-one date | I'm interested | Host explicitly accepts, with reciprocal eligibility and entitlement checks | Both accepted participants |
| Full plan | Full, or join waitlist if that feature is built | A spot is offered and accepted | Waitlisting alone does not grant room access |

“No thanks” privately dismisses the invitation, is reversible, and does not send a rejection email. Withdrawing after confirmation is a different action: release capacity and notify affected participants appropriately.

The current local prototype has instant RSVP-based group chat. Its dating-friendly label **does not implement host approval or a mutual date**. Public dating-plan rollout must wait for that state machine.

## Ordered implementation checklist

### Batch 0 — lock decisions and release boundaries

- [ ] Confirm feed defaults: explicit selected intents, with an obvious opt-in to explore the other line.
- [ ] Confirm group policy: recommend open joining for ordinary public social plans, optional host approval; mandatory approval for one-on-one dates.
- [ ] Decide how date invitations use the existing three included Love picks / additional-pick entitlement. Recommendation: keep social RSVP free and reuse the Love entitlement ledger for new romantic requests, without double charging an existing pair. Receiving, accepting, and replying remain free.
- [ ] Decide flexible-plan expiry and response deadlines; display them before submission. Never invent interest or silently extend a person's commitment.
- [ ] Add a server-controlled rollout flag and independent kill switch before introducing new routes to real users.

Acceptance: approved state diagram, entitlement behavior, and user-facing labels; no ambiguity between interest, acceptance, and confirmed attendance.

### Batch 1 — finish the plans-first Home

- [x] Local draft: member-plan feed, short composer, filters, Home navigation, optional coach entry.
- [x] Local draft: distinct loading, error/retry, and genuine empty states.
- [ ] Persist explicit feed preferences; validate city selection and travel behavior against existing metro rules.
- [ ] Implement pagination and bounded fetching; do not load the whole social graph or run an AI request on first render.
- [ ] Preserve composer drafts through filtering, navigation, errors, and accidental closure; avoid resetting edits made during an in-flight save.
- [ ] Add visible links to existing chats and incoming decisions without returning to a cluttered dashboard.
- [ ] Verify readable cards, 44px touch targets, text scaling, keyboard behavior, safe areas, and ordinary Android scrolling.

Acceptance: an admin/test user can launch the installed PWA, browse genuine eligible plans, post once, recover a failed request, and return to an existing conversation without losing state.

### Batch 2 — implement the two-way response model

- [ ] Model requested, accepted, declined, withdrawn, cancelled, expired, and completed separately; add waitlist only if its full behavior is implemented.
- [ ] Enforce changes server-side with idempotency, atomic capacity, and authorization. Concurrent final-seat requests must not overbook.
- [ ] Build organizer inbox, accept/decline controls, and clear participant status.
- [ ] Apply mutual Love eligibility and selected intent to date requests; do not reinterpret friendship chat as consent to romance.
- [ ] Check duplicate and existing connections; reuse valid chat/history rather than creating conflicting pairs.
- [ ] Resolve payment/credit treatment before enabling romantic requests through plans.

Acceptance: two synthetic accounts complete interest → host acceptance → correct chat. A pending request cannot read the accepted room or count as a confirmed attendee.

### Batch 3 — make coordination and safety dependable

- [x] Local draft: plan chat and exact-plan push links using existing infrastructure.
- [ ] Add edit/cancel controls for all eligible hosts, including hosts without Friend onboarding.
- [ ] Notify accepted participants of meaningful time/place changes, cancellation, and new messages; distinguish provider acceptance from actual delivery/opening.
- [ ] Keep old Friend plan links and new Home links working through login, expired sessions, installed PWA, and mobile browsers.
- [ ] Test room membership and blocking between participants, not only between a member and the host.
- [ ] Add reporting for plans and unmatched hosts; the existing match-dependent report path is not sufficient.
- [ ] Offer clear reconfirmation and a courteous withdrawal option before a meetup. Do not promise attendance or publicly rate people from missing responses.
- [ ] Collect optional private “Did you meet?” and “Would you do this again?” answers; label them self-reported, not verified attendance.

Acceptance: cancellation releases capacity, prevents new joins, retains appropriate history, and reaches affected users without duplicates. Blocked/deleted/test accounts cannot leak into real inventory or rooms.

### Batch 4 — instrument the connection funnel before expanding

- [ ] Record feed impression, card open, create attempt/success/failure, response request, host decision, confirmed join, first message, reciprocal reply, cancellation, and optional outcome.
- [ ] Include event version, plan intent/type, coarse metro, surface, acquisition source, and server outcome; never log message text or exact private locations for analytics.
- [ ] Count real people as well as actions; exclude admin/test accounts and handle deleted users consistently.
- [ ] Add admin bottlenecks: no local supply, views without response, requests without host decisions, acceptance without conversation, conversation without an agreed plan.
- [ ] Publish before/after cohort comparisons without claiming causality from a small sample.

Acceptance: every displayed funnel number has a defined time range, denominator, and source event. Failures are distinguishable from deliberate passes and unanswered requests.

### Batch 5 — refresh the digest only after the product loop works

- [ ] Update eligibility: current digest branches require Friend opt-in for several plan/chat summaries, which would miss Love-only members participating in app-wide plans.
- [ ] Replace outdated Friend-only labels/links with authorized exact-plan destinations, while keeping existing links backward compatible.
- [ ] Include only actionable, eligible, still-available plans and genuinely unread decisions/messages. Skip empty digests and suppress repeated unchanged content.
- [ ] Revalidate recipient eligibility, deletion, unsubscribe, read state, and plan availability immediately before sending.
- [ ] Preserve the approved 1 PM Eastern scheduling policy, timezone/DST handling, and once-per-recipient/day claim. Late runs skip rather than send outside the authorized window.
- [ ] Present exact new copy, sender, reply-to, links, audience/count, and send type for approval; obtain separate send authorization before activation.

Acceptance: no-delivery preview matches actual inventory, excluded accounts receive nothing, repeated cron attempts do not duplicate delivery, and changed content/audience remains disabled until approved.

### Batch 6 — prove a repeat-use loop in Boston

- [ ] Recruit a small set of willing real hosts; do not manufacture members or post invitations on their behalf without consent.
- [ ] Start with a few repeatable activities and neighborhoods, not a broad empty catalogue.
- [ ] Help hosts publish their next real plan and respond promptly; measure response time instead of assuming notifications produce replies.
- [ ] After a successful plan, offer “Do this again” or “Invite these people,” with a fresh explicit invitation and consent.
- [ ] Promote specific real invitations through founder/community channels, linking directly to the plan with source attribution.
- [ ] Review weekly: where did the loop stop, and what did members actually report?

Acceptance: demonstrate repeat participation and workable host response before increasing acquisition spend. More signups alone do not pass this gate.

### Batch 7 — controlled NYC launch

- [ ] Test existing NYC and nearby-region configuration; this is not a city feature that must be built from scratch.
- [ ] Verify Boston/NYC separation, local time display, travel selection, and what happens when nearby supply is empty.
- [ ] Establish real local supply first. A proposed pilot target is five committed hosts and ten genuine upcoming invitations across two or three neighborhoods; these are trial operating targets, not validated market benchmarks.
- [ ] Make a shareable plan preview that protects private information and restores the selected plan after signup/login.
- [ ] Review each target subreddit's current rules and obtain moderator permission where required before posting. No generic repetitive promotion or fabricated endorsements.
- [ ] Attribute visits → signup → qualified plan response → reciprocal conversation → return, separately for NYC versus Boston.
- [ ] Expand only while local response rates and reliability remain acceptable; pause acquisition if users repeatedly arrive at empty or broken flows.

Acceptance: first NYC visitors can find a genuine local invitation, complete a response, and receive a real reply. No posts, outreach, or email sends are authorized by this checklist itself.

## Measurement contract

| Metric | Definition |
| --- | --- |
| Local supply coverage | Share of eligible feed visitors shown at least one current, eligible member invitation in their chosen metro/intent. |
| First connection activation | New real users obtaining a host acceptance or reciprocal conversation within seven days / new real users with seven days of observation. Report the two outcomes separately too. |
| Host response | Requests explicitly accepted or declined within 24 hours / requests at least 24 hours old; include response-time distribution. |
| Conversation follow-through | Accepted plans with messages from at least two distinct participants / accepted plans old enough for the selected observation window. Exclude automated notices. |
| Meaningful weekly return | Prior-week meaningfully active real users who take another meaningful connection action this week / prior-week meaningfully active real users. Passive opens do not qualify. |
| Repeat participation | Users joining or hosting a second distinct plan within 28 days / first-plan participants with a full 28-day observation window. |
| Reported meetup outcome | Separate both-confirmed, one-sided-confirmed, no, and unknown. Missing feedback is not automatically a no-show. |
| Reliability | Error rate and p50/p95 latency by feed, create, response, and chat route; client crash-free sessions segmented by OS/browser/PWA mode. |

Exact-day retention requires an activity ledger and mature cohorts. A `last_seen_at >= signup + 7 days` query is not exact Day-7 retention. Message joins must not multiply match counts. Small cohorts should show counts alongside percentages; do not apply unverified competitor benchmarks.

## Release sequence and non-negotiable checks

1. Review this proposal and settle Batch 0 decisions.
2. Finish code behind flags; keep existing Love/Friend entry points available.
3. Run typecheck, unit tests, production build, API authorization/state tests, and mobile end-to-end tests.
4. Exercise iPhone Safari/installed PWA and a physical Android installed PWA: scroll, keyboard, back navigation, background/resume, lost network, stale session, and exact email/push links.
5. Admin/synthetic pilot first, with test/real segregation. No unapproved customer messages during testing.
6. Small real-user opt-in pilot, then wider Boston exposure, then limited NYC launch.
7. Compare against the pre-release baseline, inspect errors and unanswered requests, and roll back the flag if regressions appear.

Do not ship the current draft as though all seven batches are complete. Outstanding high-risk work includes mutual date approval, entitlement consistency, participant-level safety, host cancellation, notification eligibility, mobile end-to-end coverage, and feature-flagged rollout.

## Recommended first review decision

Approve **the plans-first direction and the next implementation slice**, not a full rebuild or immediate growth campaign: finish Home, implement reliable social-plan joining/host controls, and prove the two-way loop. Keep date invitations gated until their mutual acceptance and payment rules are complete. AI remains available as a helper throughout.
