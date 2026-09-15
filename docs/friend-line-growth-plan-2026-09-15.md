# Friend Line activation and Apple launch plan

Decision brief prepared September 15, 2026. Recommendations are experiments, not
claims of proven lift. No posts, invitations, purchases, enrollments, or email
campaigns have been executed from this plan.

## The current constraint

Production read at 1:10 PM Eastern, September 15, with a trailing seven-day
window starting September 8 at 1:10 PM. Excludes deleted, test and configured
admin/operator accounts from user activity. Stable 500-row pagination was used.

| Measure | Observed |
| --- | ---: |
| Current eligible-for-counting accounts (not Friend weekly actives) | 584 |
| Accounts with a Friend opt-in recorded, all-time | 120 |
| Users with recorded discovery-view actions in seven days | 4 |
| Discovery-view events from those users | 24 |
| Recorded joins/RSVP actions in that ledger | 0 |
| User-created Scene items in seven days | 0 |
| Future-dated, unexpired plans, including operator-hosted plans | 0 |
| Friend DMs / pack messages / club messages / plan comments, seven days | 0 / 0 / 0 / 0 |

Do not divide four weekly discovery users by 120 all-time opt-ins and call it a
funnel conversion rate. Discovery instrumentation is not a census of every visit.
Zero future-dated plans does not mean there are no clubs or evergreen posts.
The newest release did not yet have a usable performance sample in this read.

The evidence supports an activation/supply problem: people need a real, timely
reason to join, then a responsive host and a second reason to return. More AI
features or an App Store listing alone will not create that supply.

## Positioning

Working promise: **Find people to do something with this week.**

Friend Line should lead with the activity, not a personality score or a maze of
packs, circles and clubs. Keep friendship explicitly separate from dating unless
both users opt into another intent. The concierge can ask “what, when, where?”
and recommend one available option with an honest fallback if none exists.

The first useful path should be:

1. Pick an activity and availability.
2. See a small number of actual dated plans near you, with a visible organizer.
3. RSVP and enter that plan's chat; retain the destination through signup/login.
4. See the time, meeting instructions, host reply and cancellation status.
5. After the event, optionally confirm attendance and choose another plan.

Audit first; reuse existing RSVP, plan chat, invitation and deep-link systems.
Do not rewrite working features or invent attendance, organizer commitments or
members. Do not publish precise personal location or private attendee lists.

## Four-week pilot (proposed targets, not current performance)

| Stage | Action | Exit evidence |
| --- | --- | --- |
| Week 1: useful inventory | Recruit three willing hosts. Agree on three small, dated plans in two neighboring areas: coffee/walk, beginner activity, board games. | Real host, venue permission if needed, time, capacity and cancellation policy for each plan. |
| Week 2: concentrated acquisition | Promote each actual plan with its own tracked link through the host, venue, one relevant community and one local listing. | Source-attributed landing → signup → RSVP → first plan-chat reply, with counts/denominators. |
| Week 3: follow-through | Host greeting, opt-in attendance reconfirmation, clear waitlist/cancellation handling, optional post-plan check-in. | Confirmed attendance and reciprocal replies, not just RSVP totals. Messaging changes require the established approvals. |
| Week 4: repeatability | Repeat the best plan category and ask attendees to invite one friend. | At least two completed plans and evidence of repeat participation before increasing spend. |

Suggested pilot learning targets: 20 genuine RSVPs, 10 confirmed attendances,
five repeat participants. These are decision aids for a small cohort, not
statistically validated success thresholds. Track host effort and no-shows too.
If traffic rises but RSVPs do not, fix the offer/landing flow. If RSVPs rise but
attendance does not, fix confirmation and host follow-through before buying reach.

## Acquisition priority

1. **Hosts and venues first.** Cafes, board-game spaces, beginner sports groups,
   walking/running clubs and adult newcomer communities. Offer a specific
   co-hosted plan and organizer tools, not unsolicited bulk app promotion.
2. **Existing Boston audience.** A new Only in Boston placement or creator
   collaboration should advertise a real plan, with a unique source link and an
   agreed budget. Previous exposure is not proof of current conversion.
3. **Local event listings.** [Boston.com event submission](https://www.boston.com/calendar-submission/)
   is a concrete submission channel. [Meet Boston](https://www.meetboston.com/events/submit-an-event/)
   reviews listings and emphasizes visitor-relevant events and partners; it is
   not guaranteed placement for a private hangout. The Boston Calendar also
   exposes [event submission via sign-in](https://www.thebostoncalendar.com/events/new).
   Submit genuine eligible events, not disguised app advertisements.
4. **Relevant Reddit/Facebook communities.** Use moderator-approved posts for a
   specific activity. Recheck each community's rules; prior acceptance is not
   standing approval. Exclude Quincy groups that already prohibit these posts.
5. **Faceless short videos.** Show a real plan card, the RSVP/chat flow, venue
   clips with permission and a clear date/location. Founder-on-camera content
   is not required. Do not reuse people's photos, messages or attendance without
   permission. Evaluate RSVP/attendance attribution, not views alone.
6. **SEO and referrals after repeatable supply.** Index explicitly public,
   consented plan/club pages with accurate availability. Share the specific
   destination, preserve source attribution through login, and label expired
   plans. Do not index private chats or profiles.

Before paid promotion, verify first-touch attribution survives in-app browsers,
cross-domain checkout where relevant, signup, and return visits. Store campaign
codes rather than sensitive data in URLs. Each channel needs a spend cap and
cost-per-activated-user/attendee, not just cost-per-click.

## Apple: enroll now; do not promise a public launch date yet

Recommended: enroll as **Lemon Labs' legal entity**, if registered, rather than
under a trade name. Apple's organization requirements include D-U-N-S, authority
to bind the organization, a domain email and a functioning public website. The
program costs $99 USD/year; the legal entity appears as seller. Start the
verification paperwork, but Sunny must authorize payment and complete agreements.
[Apple enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)

The program provides App Store distribution and TestFlight beta testing. Not
being enrolled delays that testing/distribution path. It does not establish a
measurable current revenue or signup loss, and enrollment itself brings no users.
[Apple Developer Program](https://developer.apple.com/programs/)

The repository already has Capacitor projects. It is not public-review ready:
`capacitor.config.ts` still loads the remote production website. The next native
milestones are a release architecture, native push/deep links, safe digital
purchase/entitlement handling, physical iPhone testing, deletion/moderation,
privacy labels and review access. Keep `docs/app-store-track.md` as the detailed
native checklist; do not blindly expose Stripe digital purchases in every
storefront. Apple payment rules vary by storefront and require review at release.

Apple applies minimum-functionality and crowded-category checks; dating apps
must offer a meaningfully different or improved experience. Demonstrate the
actual concierge → plan → human connection loop. AI branding alone is not the
distinction. Explicit third-party AI data-sharing consent is also required.
[Apple review guidelines: 1.2, 3.1, 4.2, 4.3, 5.1](https://developer.apple.com/app-store/review/guidelines/)

## Scoreboard

Weekly, segmented by acquisition source and metro, excluding operators/tests:

- Eligible landing visitors and signup completion.
- Users shown at least one genuinely available plan.
- Unique RSVPers / eligible plan viewers.
- Host reply rate and time to first reply.
- Two-way plan conversations / RSVP users.
- Optional confirmed attendance / confirmed RSVPs.
- A second meaningful Friend action within seven days, with mature cohorts only.
- Cost per attendee and repeat participant; cancellations, no-shows and reports.

Missing instrumentation must be reported as unknown, not zero. AI should improve
these human outcomes rather than maximizing conversation with the concierge.
