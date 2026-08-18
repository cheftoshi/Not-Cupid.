# NotCupid — AI connection product thesis

Updated August 18, 2026.

## The thesis

**NotCupid is an AI connection concierge that helps people move from “I want
connection” to one useful action with another real person.** It supports love,
friendship, local activities, communities, and travel from one human profile.

The AI is not the relationship, a fake companion, an autonomous matchmaker, or
an auto-message bot. Its job is to reduce four kinds of friction:

1. **Understanding:** turn a person's stated intent, preferences, profile, and
   bounded behavioral signals into useful connection context.
2. **Curation:** reduce an overwhelming marketplace to a small reciprocal set
   of people, plans, or communities.
3. **Action:** recommend one next move and help the user express it in their own
   voice.
4. **Learning:** ask what happened, then improve future recommendations from
   explicit outcomes rather than screen time.

The product promise is: **AI helps humans meet humans.** Success is a reply, a
mutual decision, a plan, a joined group, or a real-world meeting—not another
minute spent scrolling.

## The shared connection loop

Every surface should use the same loop:

1. **Tell us what you want now.** Love, friends, something to do, a community,
   or people in a city the user is visiting.
2. **Receive a small plan.** The concierge selects one primary person, plan, or
   group, with a concise explanation and a safe fallback.
3. **Choose the action.** Connect, Yes/Pass, reply, RSVP, join, create a plan,
   or dismiss. The user always decides and sends.
4. **Close the loop.** Record whether the other person answered, conversation
   became two-sided, a plan formed, or people met.
5. **Adapt carefully.** Use explicit outcomes and evidence-shrunk response
   behavior to improve future ranking without punishing a user for a small
   sample or inferring sensitive traits.

## What is already live

- One profile supports Love and Friend Line.
- Deterministic, reciprocal Love eligibility and ranking protect gender, age,
  location, capacity, cooldown, and test/real boundaries.
- Love rosters provide a limited choice instead of an infinite swipe feed.
- AI Connect Coach can interpret broad six-signal compatibility context without
  exposing raw answers or exact scores.
- Love conversation coaching recommends a stage-appropriate next move without
  reading chat contents or sending on the user's behalf.
- Friend “today's move” selects one real plan, connection, pack, or creation
  action from inventory the app can actually render.
- Scene, clubs, community links, travel mode, plan chat, push, and the daily
  activity drop provide action surfaces after a recommendation.
- Admin analytics measure Love actions, performance, acquisition, payments,
  and now rank active product bottlenecks on every snapshot.

These are strong primitives, but today they appear as separate features. The
next product phase makes them feel like one concierge with one memory, one
decision language, and one measurable outcome loop.

## System architecture

Use three distinct layers. Do not let an LLM silently replace the deterministic
parts.

### 1. Trust and eligibility — deterministic

- account/test realm, blocks and reports;
- reciprocal gender and age preferences;
- location/travel window;
- activity, capacity, cooldown and duplicate-pair prevention;
- event availability and safety constraints.

If a pair or plan fails a hard gate, AI never sees it as an option.

### 2. Ranking and exploration — measurable

- existing structured compatibility and interests;
- freshness, exposure fairness, response propensity with small-sample
  shrinkage, and repeated-group continuity;
- explicit outcome signals such as chose, passed, replied, planned, met, and
  would-meet-again;
- bounded exploration so new people are not buried by historical popularity.

Every ranking version must be logged and evaluated by reciprocal outcomes,
demographic/metro cohorts with minimum sample sizes, and safety guardrails.

### 3. Explanation and action coaching — generative AI

- explain why a person, plan, or community fits now;
- summarize broad compatibility signals;
- help improve a profile while preserving the person's real voice;
- suggest an opener, reply shape, or concrete public plan;
- ask a short outcome check-in.

Generation is structured, bounded, cached when appropriate, disclosed, and
always has a curated fallback. It never accepts, rejects, posts, joins, books,
or sends without a user's explicit action.

## Roadmap

### Phase 0 — Measurement operating system (now)

Goal: every snapshot answers “where is the largest leak and what should we test
next?”

- Keep the ranked admin bottleneck diagnosis as the first operational view.
- Complete event coverage for recommendation shown, explanation opened, action
  attempted, action completed, reciprocal response, plan formed, met, and
  would-meet-again.
- Add funnel dimensions for surface, algorithm version, treatment, metro,
  gender/orientation cohort, device, and acquisition source. Suppress small
  cohorts in admin reporting.
- Repair notification-provider reconciliation and campaign attribution before
  using either to judge copy or paid promotion.
- Create weekly cohort baselines. Page views remain context, not success.

Exit gate: at least 95% of important user actions are attributable to a funnel
stage, and sent notifications reach a delivered/failed terminal state.

### Phase 1 — One concierge shell

Goal: make the three existing AI capabilities feel like one product.

- Put a single **Your move today** card on the main Hub. It selects across Love,
  Friend, a plan, a club/community, and travel—not one unrelated card per tab.
- Let the user set a lightweight current intent: “meet someone,” “make a plan,”
  “find my people,” or “explore this city.”
- Show one recommendation, one reason, and one CTA, plus a transparent “not for
  me” action that improves future curation.
- Preserve direct access to each line; the concierge is a useful front door,
  not a gate.
- Add a small AI/data disclosure before the first third-party AI request and a
  settings control to revoke it.

Exit gate: concierge-assisted users complete a meaningful connection action at
least 20% more often than a randomized control, without higher block/report
rates.

### Phase 2 — Love concierge from roster to real plan

Goal: improve the weak roster → decision → mutual → conversation sequence.

- Add one AI-recommended roster candidate with an evidence-based “why this
  person now,” while all ten profiles remain browseable and the user chooses.
- Use the existing compatibility read as optional depth, not a claim of a
  perfect match.
- Make Yes/Pass a one-tap decision from notification deep links.
- After mutual connection, open into one personalized first move; compare
  coached and uncoached cohorts.
- Once both people participate, suggest one specific, public, low-pressure plan
  based on shared interests and stated availability.
- Ask both people a private post-connection outcome: replied, planned, met,
  would meet again, or safety concern.

Exit gates: fewer than 25% of one-sided connections remain unanswered at 24
hours; at least 75% of mutuals start a conversation; two-sided conversation and
plan-formation rates improve without increasing unwanted-contact reports.

### Phase 3 — Friend concierge and recurring crews

Goal: differentiate from an event directory by forming repeated human
relationships.

- Convert compatible Friend packs and Scene interest into small, activity-led
  crews—not a bigger feed.
- Recommend a real plan from stated interests, time, metro, and existing group
  momentum.
- Let a successful group choose **keep this crew going** and establish a light
  weekly/monthly ritual.
- Suggest a public place and time window, but require organizer confirmation.
- Use community/Discord links as a route into real belonging, not the product's
  final destination.
- Extend the same concierge to visitors: “I will be in Boston next week; give me
  one group or plan I can realistically join.”

Exit gates: at least 20% of Friend opt-ins take a connection action monthly;
measure RSVP-to-attendance and the share of crews that meet again within 30
days.

### Phase 4 — Trust intelligence

Goal: make AI increase confidence and safety without pretending it can certify
a stranger.

- Improve spam/scam and duplicate-profile signals with human review and appeal.
- Keep video optional; offer lightweight authenticity prompts and clear profile
  provenance instead of mandatory performance.
- Add image/content safety filtering while preserving free block/report and
  timely operator review.
- Never display a hidden “trust score,” diagnose personality, infer protected
  traits, or label a person dangerous from weak behavioral evidence.
- Audit outcomes by cohort so popularity bias does not systematically hide or
  paywall one group.

Exit gate: lower spam/fake-account exposure and faster report resolution with no
meaningful increase in false positives or cohort disparity.

### Phase 5 — Native/TestFlight and sustainable revenue

Goal: prove the AI connection loop before paying native complexity forever.

- Enroll Lemon Labs as an Apple Developer organization and ship a small
  TestFlight cohort after Phase 1 proves measurable lift.
- Replace the remote-web test wrapper with a release-safe local/native shell,
  add APNs and universal links, and test every connection action on physical
  compact/notched iPhones.
- Use StoreKit for digital AI reads, extra connection capacity, and Pro inside
  the iOS app; reconcile entitlements and refunds server-side.
- Keep basic profiles, acceptance, replies, safety, and the fundamental human
  connection path free. Monetize added decision support, capacity, convenience,
  and repeated curated experiences.
- Complete App Store AI-data consent, privacy labels, age rating, UGC filtering,
  reports, blocks, and review/demo access before public submission.

Exit gate: a stable TestFlight cohort demonstrates better D7 retention and
meaningful-action rate than the PWA baseline, with a working purchase/restore
path and no critical review blockers.

## North-star and guardrails

### North-star

**Weekly users who complete a meaningful reciprocal connection action.** A
meaningful action is a mutual Love decision, two-sided conversation, plan
formed, Friend connection, club/community join, RSVP, or confirmed repeat crew.

### Funnel metrics

- intent set → recommendation shown;
- recommendation shown → profile/plan opened;
- opened → action attempted → action completed;
- outgoing choice → reciprocal decision within 24/48/72 hours;
- mutual → first message → reply → two-sided conversation;
- conversation → plan formed → met → would meet again;
- AI suggestion shown → used/edited/dismissed and incremental lift versus
  control;
- free value experienced → paywall → checkout → purchase → retained value.

### Guardrails

- block, report, unmatch, complaint, and refund rates;
- cohort coverage and response disparities;
- notification fatigue and unsubscribe rates;
- AI fallback/error rate, latency, and cost per meaningful action;
- no raw chat contents in AI prompts under the current product promise;
- no autonomous communication or fabricated people, plans, or facts.

## App Store positioning

Lead with:

> **NotCupid is an AI connection concierge for love, friendship, and real-life
> plans. It learns what kind of connection you want, curates a small reciprocal
> set, and gives you one useful next move—so you spend less time browsing and
> more time meeting real people.**

This is stronger than “AI dating.” It explains the dual-line product, the
no-infinite-feed design, and the real-world outcome in one story. Apple's dating
category is crowded, so the review build and screenshots must demonstrate this
workflow immediately rather than presenting a generic profile stack.

## Platform and market evidence

- Apple requires clear disclosure and explicit permission before personal data
  is shared with third-party AI. It also requires filtering, reporting,
  blocking, and reachable contact information for social/UGC apps:
  https://developer.apple.com/app-store/review/guidelines/
- Digital feature unlocks inside an iOS app generally require In-App Purchase;
  restorable entitlements need a restore path:
  https://developer.apple.com/in-app-purchase/
- Tinder now describes AI matching based on profile/questionnaire information
  and optional photo-derived interests, showing that “AI matching” alone is not
  a durable differentiator:
  https://www.help.tinder.com/hc/en-us/articles/34723594883213-AI-powered-matching
- Bumble uses AI for scam prevention and human-backed moderation, reinforcing
  that safety intelligence is part of an AI connection product, not a separate
  afterthought:
  https://support.bumble.com/hc/articles/28537051467293-Our-safety-features

The defensible difference is the complete cross-context loop: one authentic
profile, Love plus Friend plus real plans, one bounded concierge action, and an
outcome-learning system that optimizes for human connection instead of swipes.
