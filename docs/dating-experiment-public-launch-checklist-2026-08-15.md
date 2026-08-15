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
- Fit model: mutual age, gender, location, and slot availability are hard gates. Qualified-pair score is 75% core NotCupid compatibility, 15% shared interests, and 10% event questionnaire. Every gender and orientation has the same maximum of two private options.

## Hard launch gates

- [x] Prize ceiling funded: $200 per pair / $400 aggregate. Confirmed by operator August 15, 2026.
- [ ] Sponsor legal name confirmed.
- [ ] Sponsor valid public physical postal address confirmed. An email address alone is not sufficient for commercial email or the public rules.
- [x] Intended venue recorded privately: The Berkeley, 154 Berkeley Street, Boston, MA 02116.
- [x] Operator confirmed both Berkeley reservations are booked and prepaid for August 20 at 6:30 PM and 8:30 PM ET on August 15.
- [x] Reservation confirmation recorded as an operator attestation for both slots. External booking identifiers were not supplied and remain private if added later.
- [x] Fulfillment method: NotCupid prepaid The Berkeley directly; participants do not pay or seek reimbursement for the included dinner. The $200-per-pair cap includes ordinary tax and gratuity. Alcohol, parking, valet costs/tips, transportation, and items outside the prepaid arrangement are excluded.
- [ ] Massachusetts promotions counsel approves the exact published terms version and provides a written reference/date.
- [ ] Production database sign-off fields populated; event status changed from `draft` to `entry_open` only after every item above.
- [ ] `RAFFLE.entriesOpen` changed to `true`, reviewed, tested, committed, deployed, and production entry/upload endpoints verified.

## Restaurant operating plan

- Put both reservations under a clear host name and give the restaurant a day-of contact.
- NotCupid has prepaid the restaurant directly. Retain the payment confirmation privately and verify that the $200 includes ordinary tax and gratuity; alcohol, parking, valet costs/tips, transportation, and charges outside the prepaid arrangement remain the participants' responsibility.
- Record allergy/accommodation contact instructions without promising an accommodation the venue has not confirmed.
- Establish a no-show and late-arrival cutoff, a private participant support contact, and a backup/reschedule plan.
- Share the venue only with selected participants. Do not put private reservation references in a public API, client bundle, post, or email.

## Required public-post footer

Use the following prize-promotion footer in every promotional post, close to the call to action. Because NotCupid is paying Only in Boston $200 for distribution, its post must begin with a conspicuous `Paid advertisement for NotCupid` or an equally clear Instagram advertising disclosure; do not describe Only in Boston as a partner, Sponsor, administrator, or selector.

> NO PURCHASE NECESSARY. Open to eligible Massachusetts residents 21+ within approximately 20 miles of 02116. Entry closes August 18 at 12 PM ET or at 100 eligible entries. Up to two dinner prizes; maximum $200 per selected pair / $400 total. Odds depend on eligible entries, reciprocal preferences, compatibility weighting, mutual choices, and shared availability. Official Rules: https://notcupid.com/dating-experiment/terms. Apple and Reddit do not sponsor or administer the experiment. Only in Boston is not the prize sponsor or administrator.

Internal publisher record: NotCupid is paying Only in Boston $200 to promote the experiment on its social channels. Only in Boston is a paid promotional publisher, not the prize Sponsor or administrator. Use `Paid advertisement for NotCupid` if the operator does not want partnership language, and place it where viewers see it before expanding the caption. Do not rely on comments or a disclosure after “more.”

## Campaign email

- Treat the comeback/experiment message as commercial marketing, not a transactional match email.
- Exact subject, preview text, body, audience, sender, reply-to, CTA, physical postal address, and unsubscribe behavior require operator content approval.
- A separate explicit send approval is required after the final recipient count and test render are shown.
- Use accurate headers and subject, identify the promotional nature, include a valid physical postal address and working unsubscribe, suppress opted-out users, and honor opt-outs.
- Never combine the campaign approval with permission to send. No email or related promotional push is part of opening the event.

## Safety, privacy, and proof

- Re-test that test accounts cannot enter, private videos use signed access, withdrawals delete the experiment video, preferences are frozen per event, and no selected person can occupy both dinner slots.
- Verify shortlist cards show only reciprocal candidates and include first name, age, photos, bio, archetype, disclosed orientation, shared interests, event answers, fit score, and signed intro video. Decisions must remain sealed.
- Verify opted-out entrants receive no experiment push. Verify winner reminders atomically send no more than once in the 24-hour window and once in the three-hour window.
- Verify the rules modal and all four separate consents on a real iPhone PWA viewport.
- Keep intro videos private; no advertising/testimonial use without separate written consent. Confirm the scheduled deletion path and incident hold process.
- Record production URL, deployment ID, database migration version, signed rules version, reviewer reference, restaurant confirmations, operator approval, and opening timestamp in this file or the private launch record.
- Do not imply background checks, guaranteed identity, guaranteed safety, guaranteed compatibility, a guaranteed award of both prizes, or restaurant sponsorship.

## Opening record

- Sponsor legal name:
- Sponsor public postal address:
- Venue and address: The Berkeley, 154 Berkeley Street, Boston, MA 02116 (confirmed and prepaid; reveal privately to selected pairs)
- 6:30 PM reservation reference: Operator attestation, August 15, 2026
- 8:30 PM reservation reference: Operator attestation, August 15, 2026
- Prize fulfillment method: NotCupid prepaid The Berkeley directly; no guest reimbursement step; $200 per pair including ordinary tax and gratuity; parking/valet/transport excluded
- Legal reviewer and written reference:
- Terms version reviewed:
- Only in Boston relationship/disclosure: Paid promotional publisher; $200 fee; use “Paid advertisement for NotCupid”; no partnership, Sponsor, administrator, data, matching, or selection role
- Operator approval timestamp:
- Production deployment ID:
- Production opening verification:
