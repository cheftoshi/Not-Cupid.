# NotCupid: city readiness and Friend Line reboot

## Decision

Not ready for a broad NYC acquisition push yet. Providence is configured, but
city configuration is not evidence of local supply or a working end-to-end
activation funnel. Fix city discovery and acquisition routing first, then
preview the Friend redesign before changing the live experience.

This is a code review and local verification, not a production traffic snapshot.
No production accounts, messages, payments, invitations, or emails were created.
Authenticated real-device journeys and city inventory have not been verified.

## Findings, in implementation order

| Priority | Evidence | Problem | Required change / acceptance check |
|---|---|---|---|
| P1 | lib/quiz-data.ts: metroOf; lib/neighborhoods.ts: planAreasForMetro | Nearest-center classification maps 10301 (Staten Island) to northjersey and 11691 (Far Rockaway) to longisland. NYC's neighborhood selector omits Staten Island. | Explicit city/borough membership rules before proximity fallback. Test all five boroughs, Rockaways, city-switch ZIPs, and separate NYC/NJ boundary policy. Reconcile persisted plan/trip metro values through a new migration; do not blindly rewrite historical venue locations from current host ZIPs. |
| P1 | app/city/[metro]/page.tsx: cityStats | First 24 plans are fetched globally, then filtered by host ZIP. Other cities can look empty; traveling hosts are classified by home rather than plan city. | Filter by plan metro before limits. Apply realm, deletion, blocking, and public audience rules. Test a city with over 24 plans elsewhere. |
| P1 | app/city/[metro]/page.tsx; app/p/[id]/page.tsx | Public previews incompletely screen blocked/deleted hosts and test content. City previews fetch private-targeted event titles without an explicit public-sharing policy. | One public-plan projection used by metadata, city cards, share pages and previews; fail closed on unavailable eligibility checks. Decide whether restricted-audience titles should ever be public. |
| P1 | app/p/[id]/page.tsx: join CTA | Shared plan sends visitors to plain /quiz, losing the originating plan. City signup also does not carry city context. | Persist a validated relative return destination through signup/OTP/setup; restore the exact plan, with an honest full/expired/cancelled state. Test signed-out share → signup → join → chat. |
| P1 | app/api/admin/metro-health/route.ts | Unpaginated user fetch can hit Supabase's response ceiling. “Active” counts status, not recent use; blocked users are not excluded. | Paginated or SQL aggregate metrics; separate registered, recently active, eligible, hosting, joined, reciprocal chat and repeat attendance. Query errors must not look like zero traction. |
| P2 | app/api/profile/set-city/route.ts | Changing discovery city overwrites home ZIP. Trips independently override Friend context, so city labels and discovery may disagree. | Separate home location, discovery city and dated travel intent. Use one location context for Home/Friend/date plans; preserve existing chats. Do not infer a relocation from exploring NYC. |
| P2 | lib/neighborhoods.ts: neighborhoodOf | Missing/unknown ZIP renders Greater Boston, even when metro is null. | Neutral unknown-location state with a choose-city action; no invented Boston location. |
| P2 | app/api/friend/activities/route.ts | Friend plans allow far-future dates and up to 1000 participants/unlimited, unlike the intended small-group experience and date-plan 60-day cap. | Agree a small-group default and maximum; define whether host occupies a seat. Apply server validation on create/edit and retain atomic RSVP capacity. Add full-group and last-seat concurrency tests. |
| P2 | app/p/[id]/page.tsx; app/city/[metro]/page.tsx | Server-rendered dates do not specify a timezone. | Store venue-city timezone, render it consistently on cards, share pages, chat and reminders. Test Eastern daylight-saving changes and viewers elsewhere. |
| P2 | app/hub/plans-home.tsx; app/friends/friend-hub-client.tsx | Two Home experiences and overlapping Scene, Pulse, pack, crew, club and plan terminology. Friend client is 2526 lines. | One navigational model and reusable plan/chat components. Split data loading, discovery, people, composer and conversations into testable modules. Preserve existing deep links. |
| P2 | FAQ / How it works / About / city pages | Copy drift: lie-detection claim, no-feeds claim, vague cancellation/deletion, old experiment emphasis and changing meanings of “local.” | Immediate FAQ correction is staged locally. Follow with a shared product-copy inventory for all surfaces, separating live features from future plans. |

### Local location probes

| Input ZIP | Current metro | Current area label |
|---|---|---|
| 10001 | nyc | West Village / Chelsea |
| 11201 | nyc | Downtown Brooklyn / Heights |
| 11375 | nyc | Forest Hills / Central Queens |
| 10301 | northjersey | Staten Island |
| 11691 | longisland | Hempstead |
| 07302 | northjersey | Jersey City |
| 02903 | providence | Providence |
| 02860 | providence | Pawtucket |
| 99999 | null | Greater Boston |

All current METRO_ZIP city-switch representatives round-trip to their configured
metro. That passes a narrow configuration check, not full coverage.

NYC geographic reference: [NYPD identifies 11691 as Far Rockaway, Queens](https://www.nyc.gov/site/nypd/bureaus/patrol/precincts/101st-precinct.page);
[NYC Flood Maps lists 10301 under Staten Island](https://www.nyc.gov/site/floodmaps/maps/your-risk.page).

## Why plans feel weak — design hypothesis, not user-research proof

The current Home leads with a generic greeting, abstract highlight cards,
location controls, five filters and dating preferences. Concrete invitations
are further down. Friend Line repeats discovery with its own Home, Scene,
Crew and Pulse. That makes an immediate social action feel like navigating
several tools.

“Around you” also suggests precise proximity while unknown distances and
metro boundaries can hide relevant inventory. Changing city sends users to
another section. An empty city puts most of the creation effort on the visitor.

The fix should be clearer people and participation, not more decorative cards.
Plain, visible action labels reduce memory burden; see
[Nielsen Norman Group's recognition-versus-recall guidance](https://www.nngroup.com/articles/recognition-and-recall/).

## Proposed Friend Line v2

Promise: **Find someone to do something with—and a reason to meet again.**

- **Do something:** real member invitations for today, this weekend, or flexible
  plans. City selector in the header. Use time chips first; distance/preferences
  in a compact filter sheet. No external event imports or invented activity.
- **Meet people:** optional curated introductions. Show an honest shared interest
  and a concrete invitation action. Packs remain behind this section rather than
  becoming the concept everyone must learn first.
- **Your chats:** joined plans, private friendships and groups in one clearly
  labeled inbox. Desktop conversation panel on the right; a dedicated mobile
  screen with a visible back action and preserved draft.

Friend-only users keep platonic discovery. Date invitations are an explicit
mode, never inferred from joining a social plan. Keep dates free and two-person;
the host accepts one requester and only then unlocks their private conversation.
Do not change Love's existing paid-pick rules or Friend pack pricing in this
redesign without a separate decision.

### Invitation card

Show host identity where permitted, the actual activity, neighborhood, time,
group size/seats, and one primary action:

- Open friendship plan: Join plan.
- Joined friendship plan: Open chat.
- Open date: Request to join.
- Pending date: Request sent.
- Accepted date: Open your date chat.
- Full/closed/cancelled: explain the state; do not leave a dead CTA.

Avoid fabricated “popular,” “active now,” attendance, or compatibility claims.
Blind-date identity and venue privacy must survive every card/notification/share
surface. No profile photo/identity preview leak in the redesign.

### Creation and follow-through

1. “What would you like to do?” with optional editable starter ideas: a walk,
   coffee, tennis, or lunch. Starter ideas are not fake posted plans.
2. Social or date, time/flexible, area, public meeting place, group size.
3. Progressive options: audience and venue visibility; explain them next to the
   control rather than adding a wall of help text.
4. After publication: show requests/participants, conversation and cancellation
   in the same place.
5. After joining: make the next action “Say hello” or confirm details—not another
   discovery feed.
6. After the plan: optional “Did you meet?” and “Would you meet again?” feedback.
   No attendance inferred from opening a link; no automatic invitations.

## Delivery batches and go/no-go checks

### A. City correctness and truthful acquisition

- [ ] Fix NYC geographic membership with boundary fixtures.
- [ ] Decide whether nearby NJ is an explicitly selectable neighboring pool.
- [ ] Fix city filtering before limits and shared public-plan safety.
- [ ] Preserve plan/city context through onboarding.
- [ ] Correct city analytics pagination, eligibility and activity definitions.
- [ ] Neutral unknown-location state and consistent city/timezone display.
- [ ] Review FAQ, How it works, About, city SEO, safety and notifications together.

Go/no-go: Boston, NYC and Providence fixture accounts each complete discovery,
posting, join/request, host decision, chat, cancel and report without leaking
across city, realm or safety boundaries. Cover no inventory and a full plan.

### B. Reviewable Friend and Home preview

- [ ] Produce mobile and desktop previews with the three choices above.
- [ ] Show empty, populated, joined, full, waiting, cancelled and error states.
- [ ] Keep existing app colors; reduce competing headings, borders and empty cards.
- [ ] Validate chat placement and keyboard/scroll behavior on Android and iPhone.
- [ ] Review the preview with the operator before replacing live navigation.

### C. Controlled release and learning

- [ ] Feature flag with rollback; do not discard existing connections or chats.
- [ ] Track per-city invitation views → joins/requests → host responses →
  first message → reciprocal reply → optional confirmed meetup → repeat action.
- [ ] Recruit real hosts before promoting a new city's inventory.
- [ ] Set go/no-go supply thresholds from current measured data, not arbitrary
  sign-up totals. Do not promise a packed city based on dormant accounts.
- [ ] City-specific digest only when there is relevant real inventory, with
  suppression/deduplication and existing approval rules. No send is authorized
  by this plan.

## Implementation update — September 27 release

The checklists above are the original audit/acceptance plan, not a statement
that every operational launch gate has passed. This release implements:

1. City foundation: five-borough NYC ZIP coverage including Staten Island and
   Rockaways; separate discovery city vs home ZIP; public city filtering before
   limits; safe public projections; preserved plan/city onboarding destinations;
   neutral unknown-location display; Eastern plan input/display and DST checks.
2. Home: invitation-led heading, less empty chrome, time filters, clearer join
   and chat actions, explicit city selection, retained desktop conversation rail
   and mobile conversation sheet. New social plans are 2–10 people and within
   60 days or flexible. Existing plans/connections are preserved.
3. Friend: Do something / Meet people / Your chats / Clubs entry points with a
   friend-only discovery surface. Existing DM/pack/club interfaces remain, not
   a claim that every legacy panel was rewritten. Private optional post-plan
   follow-through records member-reported outcomes without automatic outreach.
4. Copy and measurement: FAQ, About and How it works corrections; paginated
   city user metrics and service-only 30-day plan/participation/chat/outcome
   aggregates. Home-view instrumentation starts with this release. Metrics are
   activity counts, not cohort conversion or verified attendance.

Rollout defaults to Boston, NYC and Providence. `CONNECTION_HOME_V2=off`
restores prior navigation; `CONNECTION_HOME_V2_METROS` changes the enabled list.
The additive migration is `20260928003058_city_expansion_and_plan_followthrough.sql`.
No prices, Love quotas, email templates, send approvals or cron schedules change.

Verification: 312/312 unit tests and typecheck passed; production build passed
in an isolated copy with dummy credentials. A local SQL fixture checked the
actual migration, borough repair, aggregate counts, blocked-user exclusion,
service-only privileges and feedback deletion. Browser fixture inspection
confirmed the invitation/join state and participant conversation rail. Fixture
data is local-only and is excluded from release sources.
All 48 public mobile browser regressions passed using the documented local
HTTPS runner (iPhone WebKit and Pixel Chromium). Client bundle budgets passed.
The migration was applied and confirmed in the linked production ledger.

Outstanding operational gates: real installed Android/iPhone keyboard, scroll
and device-push checks; authenticated full journeys in each city; real host
recruitment and measured local supply before marketing. A city-specific digest
is not activated or sent. Further friend-panel redesign can follow measured
usage; no invented inventory or attendance claims are introduced.
