# Dating Experiment public launch checklist

This is the operating record for the August 20, 2026 Boston event. It is not legal advice and it does not replace Massachusetts counsel review. The code and database stay fail-closed until each required fact below is recorded.

## Public offer

- Public name: The NotCupid Dating Experiment — never call it a raffle in public copy.
- Free entry; no purchase, subscription, payment, or donation changes selection.
- Eligibility: age 21+, Massachusetts resident within approximately 20 miles of ZIP 02116, genuine non-test account, complete profile and private 5–15 second intro video.
- Entry closes Tuesday, August 18, 2026 at 12:00 PM ET or at 100 eligible entrants, whichever is earlier.
- Dinner slots: Thursday, August 20 at 6:30 PM ET and 8:30 PM ET. Entrants choose every date/time slot they can attend. A pair needs shared availability.
- Prize quantity/value: up to two dinner prizes, one per selected pair, up to $200 per pair and $400 aggregate.
- Selection: reciprocal preferences and minimum compatibility first; sealed mutual choices second; payment-neutral weighted random selection without replacement last. Exact odds depend on the eligible pool, preferences, scores, mutual choices, favorites, and shared availability.

## Hard launch gates

- [x] Prize ceiling funded: $200 per pair / $400 aggregate. Confirmed by operator August 15, 2026.
- [ ] Sponsor legal name confirmed.
- [ ] Sponsor valid public physical postal address confirmed. An email address alone is not sufficient for commercial email or the public rules.
- [ ] Restaurant name and address confirmed for both reservations.
- [ ] Reservation confirmation/reference recorded for 6:30 PM.
- [ ] Reservation confirmation/reference recorded for 8:30 PM.
- [ ] Fulfillment method confirmed in writing: who pays the restaurant, when, how the $200 cap is applied, and treatment of tax, gratuity, alcohol, transportation, excess charges, cancellation, no-show, and venue failure.
- [ ] Massachusetts promotions counsel approves the exact published terms version and provides a written reference/date.
- [ ] Production database sign-off fields populated; event status changed from `draft` to `entry_open` only after every item above.
- [ ] `RAFFLE.entriesOpen` changed to `true`, reviewed, tested, committed, deployed, and production entry/upload endpoints verified.

## Restaurant operating plan

- Put both reservations under a clear host name and give the restaurant a day-of contact.
- Prefer Sponsor payment directly to the restaurant. Confirm in writing whether the $200 includes tax and gratuity and exclude alcohol, transportation, and charges above the cap unless the final rules say otherwise.
- Record allergy/accommodation contact instructions without promising an accommodation the venue has not confirmed.
- Establish a no-show and late-arrival cutoff, a private participant support contact, and a backup/reschedule plan.
- Share the venue only with selected participants. Do not put private reservation references in a public API, client bundle, post, or email.

## Required public-post footer

Use this in the Only in Boston post and every promotional Reddit post, close to the call to action:

> NO PURCHASE NECESSARY. Open to eligible Massachusetts residents 21+ within approximately 20 miles of 02116. Entry closes August 18 at 12 PM ET or at 100 eligible entries. Up to two dinner prizes; maximum $200 per selected pair / $400 total. Odds depend on eligible entries, reciprocal preferences, compatibility weighting, mutual choices, and shared availability. Official Rules: https://notcupid.com/dating-experiment/terms. Not sponsored or administered by Apple, Reddit, or Only in Boston.

If Only in Boston receives money, a free meal, services, equity, reciprocal promotion, or anything else of value, place `Paid partnership with NotCupid` or `Sponsored by NotCupid` conspicuously at the beginning of the post. Do not rely only on a platform tag, the comments, or a disclosure after “more.” If there is no material connection, do not falsely label the independent post as sponsored.

## Campaign email

- Treat the comeback/experiment message as commercial marketing, not a transactional match email.
- Exact subject, preview text, body, audience, sender, reply-to, CTA, physical postal address, and unsubscribe behavior require operator content approval.
- A separate explicit send approval is required after the final recipient count and test render are shown.
- Use accurate headers and subject, identify the promotional nature, include a valid physical postal address and working unsubscribe, suppress opted-out users, and honor opt-outs.
- Never combine the campaign approval with permission to send. No email or related promotional push is part of opening the event.

## Safety, privacy, and proof

- Re-test that test accounts cannot enter, private videos use signed access, withdrawals delete the experiment video, preferences are frozen per event, and no selected person can occupy both dinner slots.
- Verify the rules modal and all four separate consents on a real iPhone PWA viewport.
- Keep intro videos private; no advertising/testimonial use without separate written consent. Confirm the scheduled deletion path and incident hold process.
- Record production URL, deployment ID, database migration version, signed rules version, reviewer reference, restaurant confirmations, operator approval, and opening timestamp in this file or the private launch record.
- Do not imply background checks, guaranteed identity, guaranteed safety, guaranteed compatibility, a guaranteed award of both prizes, or restaurant sponsorship.

## Opening record

- Sponsor legal name:
- Sponsor public postal address:
- Venue and address:
- 6:30 PM reservation reference:
- 8:30 PM reservation reference:
- Prize fulfillment method:
- Legal reviewer and written reference:
- Terms version reviewed:
- Only in Boston relationship/disclosure:
- Operator approval timestamp:
- Production deployment ID:
- Production opening verification:
