# Dating Experiment public launch checklist

This is the operating record for the August 20, 2026 Boston event. It is not legal advice. All launch gates below were completed, and public entry is open in the deployed code and production event record.

## Public offer

- Public name: The NotCupid Dating Experiment — never call it a raffle in public copy.
- Free entry; no purchase, subscription, payment, or donation changes selection.
- Eligibility: age 21+, Massachusetts resident within approximately 20 miles of ZIP 02116, genuine non-test account, and complete profile. A private 5–15 second intro video is optional and selection-neutral.
- Entry closes Tuesday, August 18, 2026 at 11:59 PM ET or at 400 eligible entrants, whichever is earlier. The exact server boundary is midnight starting Wednesday (`2026-08-19T04:00:00Z`). This is one shared cap, not a gender quota.
- Dinner slots: Thursday, August 20 at 6:30 PM ET and 8:30 PM ET. Entrants choose every date/time slot they can attend. A pair needs shared availability.
- Prize quantity/value: up to two dinner prizes, one per selected pair, up to $200 per pair and $400 aggregate.
- Selection: reciprocal preferences and minimum compatibility first; sealed mutual choices second; payment-neutral weighted random selection without replacement last. Exact odds depend on the eligible pool, preferences, scores, mutual choices, favorites, and shared availability.
- Fit model: mutual age, gender, location, and slot availability are hard gates. Qualified-pair score is 75% core NotCupid compatibility, 15% shared interests, and 10% event questionnaire. Every gender and orientation has the same maximum of two private options.

## Hard launch gates

- [x] Prize ceiling funded: $200 per pair / $400 aggregate. Confirmed by operator August 15, 2026.
- [x] Public Sponsor/operator name confirmed as NotCupid by the operator on August 15, 2026. Lemon Labs owns NotCupid but is not separately presented as the public prize Sponsor.
- [x] Sponsor public physical postal address confirmed as 109 California Ave, Quincy, MA 02169 by the operator on August 15, 2026.
- [x] Intended venue recorded privately: The Berkeley, 154 Berkeley Street, Boston, MA 02116.
- [x] Operator confirmed both Berkeley reservations are booked and prepaid for August 20 at 6:30 PM and 8:30 PM ET on August 15.
- [x] Reservation confirmation recorded as an operator attestation for both slots. External booking identifiers were not supplied and remain private if added later.
- [x] Fulfillment method: NotCupid prepaid The Berkeley directly; participants do not pay or seek reimbursement for the included dinner. The $200-per-pair cap includes ordinary tax and gratuity. Alcohol, parking, valet costs/tips, transportation, and items outside the prepaid arrangement are excluded.
- [x] Operator compliance approval recorded for exact published terms version `boston-v13-2026-08-15` on August 15, 2026, including the optional-video rule and 400-entry cap.
- [x] Production database sign-off fields populated; event status is `entry_open`, and the public code gate was approved after the device rehearsal.
- [x] Final iPhone/PWA rehearsal passed on August 15, 2026. The operator confirmed the quiz, mobile layout, UI, and UX were seamless and approved opening the public code gate.

## Restaurant operating plan

- Put both reservations under a clear host name and give the restaurant a day-of contact.
- NotCupid has prepaid the restaurant directly. Retain the payment confirmation privately and verify that the $200 includes ordinary tax and gratuity; alcohol, parking, valet costs/tips, transportation, and charges outside the prepaid arrangement remain the participants' responsibility.
- Record allergy/accommodation contact instructions without promising an accommodation the venue has not confirmed.
- Establish a no-show and late-arrival cutoff, a private participant support contact, and a backup/reschedule plan.
- Share the venue only with selected participants. Do not put private reservation references in a public API, client bundle, post, or email.

## Required public-post footer

Use the following prize-promotion footer in every promotional post, close to the call to action. On the specific paid Only in Boston post, place a compact, conspicuous disclosure such as `Ad · NotCupid Dating Experiment` or `#ad` before the caption expands. Do not call the account a partner, Sponsor, administrator, or selector, and do not add the publisher to the NotCupid FAQ or Official Rules.

> NO PURCHASE NECESSARY. Open to eligible Massachusetts residents 21+ within approximately 20 miles of 02116. Entry closes August 18 at 11:59 PM ET or at 400 eligible entries. Up to two dinner prizes; maximum $200 per selected pair / $400 total. Odds depend on eligible entries, reciprocal preferences, compatibility weighting, mutual choices, and shared availability. Official Rules: https://notcupid.com/dating-experiment/terms. Apple and Reddit do not sponsor or administer the experiment.

Private internal publisher record: NotCupid is paying Only in Boston $200 to distribute the promotion on its social channels. This does not make it a partner, prize Sponsor, or administrator. The disclosure belongs on that paid post itself—not on NotCupid's product pages—and must be visible before “more,” not buried in comments.

## Campaign email

- Treat the comeback/experiment message as commercial marketing, not a transactional match email.
- Exact subject, preview text, body, audience, sender, reply-to, CTA, physical postal address, and unsubscribe behavior require operator content approval.
- A separate explicit send approval is required after the final recipient count and test render are shown.
- Use accurate headers and subject, identify the promotional nature, include a valid physical postal address and working unsubscribe, suppress opted-out users, and honor opt-outs.
- Never combine the campaign approval with permission to send. No email or related promotional push is part of opening the event.

## Safety, privacy, and proof

- Re-test that test accounts cannot enter, an entry can be completed without video, optional private videos use signed access, withdrawals delete any experiment video, preferences are frozen per event, and no selected person can occupy both dinner slots.
- Verify shortlist cards show only reciprocal candidates and include first name, age, photos, bio, archetype, disclosed orientation, shared interests, event answers, fit score, and a signed intro video only when one was provided. Decisions must remain sealed.
- Verify opted-out entrants receive no experiment push. Verify winner reminders atomically send no more than once in the 24-hour window and once in the three-hour window.
- The completed launch rehearsal verified the rules modal, all four separate consents, entry without a video, and optional-video upload on a real iPhone PWA viewport using the private admin account.
- Keep optional intro videos private; no advertising/testimonial use without separate written consent. Confirm the scheduled deletion path and incident hold process.
- Record production URL, deployment ID, database migration version, signed rules version, reviewer reference, restaurant confirmations, operator approval, and opening timestamp in this file or the private launch record.
- Do not imply background checks, guaranteed identity, guaranteed safety, guaranteed compatibility, a guaranteed award of both prizes, or restaurant sponsorship.

## Opening record

- Public Sponsor/operator name: NotCupid (operator-confirmed August 15, 2026)
- Owner company: Lemon Labs; owns and operates the NotCupid product, not separately presented as the public prize Sponsor
- Sponsor public postal address: 109 California Ave, Quincy, MA 02169
- Venue and address: The Berkeley, 154 Berkeley Street, Boston, MA 02116 (confirmed and prepaid; reveal privately to selected pairs)
- 6:30 PM reservation reference: Operator attestation, August 15, 2026
- 8:30 PM reservation reference: Operator attestation, August 15, 2026
- Prize fulfillment method: NotCupid prepaid The Berkeley directly; no guest reimbursement step; $200 per pair including ordinary tax and gratuity; parking/valet/transport excluded
- Operator compliance reviewer/reference: NotCupid operator approval of the optional-video, 400-entry public-launch v13 after the iPhone/PWA walkthrough, recorded August 15, 2026
- Terms version reviewed: `boston-v13-2026-08-15`
- Production rehearsal migration: `20260816004500_dating_experiment_operator_rehearsal.sql` applied and linked ledger verified August 15, 2026
- Optional-video migration: `20260816011500_dating_experiment_optional_video_v12.sql` applied; linked ledger and database lint verified August 15, 2026
- Public-launch migration: `20260816013000_dating_experiment_public_launch_v13.sql` applied; linked ledger and database lint verified August 15, 2026. It raises the shared entry cap to 400, makes capacity counts current-terms-only, and records the completed iPhone/PWA walkthrough approval.
- Deadline-extension migration: `20260816160000_dating_experiment_extend_entry_deadline.sql` applied August 16, 2026. It supersedes the earlier noon deadline and keeps entries open through all of Tuesday, August 18.
- Only in Boston relationship/disclosure: Private internal record—paid promotional publisher; $200 fee; paid post uses a clear `Ad`/`#ad` disclosure; no public FAQ/rules mention and no partnership, Sponsor, administrator, data, matching, or selection role
- Operator approval timestamp: August 15, 2026 at 7:50:37 PM ET
- Original public-opening deployment ID: `dpl_ZqaBNkPCkDpgez6psKs3uTDJyfiH`. This is an audit record, not the current deployment pointer; use the `https://notcupid.com` production alias or Vercel CLI for the active deployment.
- Production opening verification: August 15, 2026 — live FAQ and Official Rules show entries open, the 400-person v13 cap, and no rehearsal copy; unauthenticated status, entry, and upload endpoints return `401`; linked database reports `entry_open`, 400 spots, two confirmed dinner slots, all sign-offs true, current-terms capacity accounting, and zero test entries.
