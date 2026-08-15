import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';
import { RAFFLE } from '@/lib/raffle';
import { datingExperimentEntriesOpen, getDatingExperimentEvent } from '@/lib/dating-experiment-event';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dating Experiment Official Rules & Terms — NotCupid',
  description: 'Official eligibility, selection, prize, privacy, and safety rules for the NotCupid Dating Experiment.',
};

const CONTACT = 'match@notcupid.com';

export default async function DatingExperimentTermsPage() {
  const event = await getDatingExperimentEvent();
  const entriesOpen = datingExperimentEntriesOpen(event);
  const sponsorConfirmed = event?.sponsor_details_confirmed === true
    && !!event.sponsor_legal_name?.trim()
    && !!event.sponsor_public_mailing_address?.trim();

  return (
    <LegalPage title="Dating Experiment Official Rules & Terms" subtitle="No purchase necessary. The complete rules for Dinner on Us: Boston." updated="August 15, 2026">
      {!entriesOpen && <p><strong>Quiet mode:</strong> entries are not currently open. These rules are published for transparency and may be updated before the entry period begins.</p>}

      <p><strong>NO PURCHASE OR PAYMENT IS NECESSARY TO ENTER OR WIN. A PURCHASE WILL NOT IMPROVE THE CHANCE OF RECEIVING A SHORTLIST OR PRIZE. VOID WHERE PROHIBITED.</strong></p>
      <p>These Official Rules and Terms apply to the <strong>{RAFFLE.series}</strong>. By entering, you agree to the version shown at entry: <strong>{RAFFLE.termsVersion}</strong>. For the plain-language plan, read the <a href="/dating-experiment/faq">Dating Experiment FAQ</a>. Questions may be sent to <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      {sponsorConfirmed ? (
        <p><strong>Sponsor:</strong> {event!.sponsor_legal_name}. <strong>Public mailing address:</strong> <span style={{ whiteSpace: 'pre-line' }}>{event!.sponsor_public_mailing_address}</span>. NotCupid operates the experiment for the Sponsor.</p>
      ) : (
        <p><strong>Draft Sponsor notice:</strong> NotCupid is the intended operator. The Sponsor&apos;s exact legal name and valid public postal address are pending final confirmation and must appear here before entries open.</p>
      )}

      <h2>1. Free entry</h2>
      <p>Entry is free through the Dating Experiment screen. No purchase or payment is necessary to enter, receive a shortlist, or be selected. A purchase, subscription, donation, profile unlock, or NotCupid Pro membership does not add entries, change shortlist priority, or improve selection odds. Limit one entry per person.</p>

      <h2>2. Eligibility</h2>
      <p>You must be 21 or older, reside in Massachusetts within approximately {RAFFLE.radiusMiles} miles of ZIP {RAFFLE.centerZip}, hold one genuine NotCupid account, complete the required profile and intro-video steps, and be able to attend the stated Boston dinner. Employees, contractors, and members of their immediate households are not eligible. Test, duplicate, automated, and fraudulent accounts are excluded. The experiment includes explicit straight, bisexual, gay, lesbian, pansexual, queer, asexual / ace-spectrum, questioning, and prefer-not-to-label orientation choices. It supports reciprocal preferences involving men, women, and non-binary / another-identity participants, including different-gender and same-gender pairings; no pairing is guaranteed. Void where prohibited.</p>

      <h2>3. Entry period</h2>
      <p>The entry period opens only when the Dating Experiment screen states that entries are open and closes at {RAFFLE.entryCloseLabel}, or when the published cap of {RAFFLE.cap} eligible entries is reached, whichever occurs first. NotCupid&apos;s server clock is the official timekeeper. Reciprocal shortlists are scheduled to begin {RAFFLE.drawLabel}. The two intended dinners are Thursday, August 20, 2026, at 6:30 PM and 8:30 PM Eastern Time, with one selected pair assigned to each slot. Restaurant details and final slot assignments will be shared privately with selected pairs.</p>

      <h2>4. How to enter</h2>
      <p>Use the Dating Experiment screen, choose how you identify, choose the orientation label that feels closest, select one or more genders you would be open to meeting, choose an inclusive minimum and maximum age from 21 through 99, select every listed dinner time you can actually attend, answer four short experiment prompts about intent, dinner energy, planning style, and a conversation starter, submit an original {RAFFLE.videoMinSeconds}–{RAFFLE.videoMaxSeconds}-second introduction video, and accept the required consent notices. These preferences and time availability are saved with the entry, do not alter the entrant&apos;s general Love Line settings, and control this experiment even if the entrant later edits their general NotCupid profile. The orientation label is shown only to private shortlist participants; selecting &quot;prefer not to label&quot; displays no orientation label. Entries that are automated, duplicated, incomplete, misleading, abusive, or use content the entrant does not have the right to share may be disqualified.</p>

      <h2>5. Compatibility and selection</h2>
      <p>The system first applies mutual age and gender preferences, shared dinner-slot availability, location eligibility, prior-pair exclusions, and a minimum compatibility threshold. A pair can be considered only when each person&apos;s selected genders include the other person&apos;s identity, each person&apos;s age falls inside the other person&apos;s inclusive age range, and both marked at least one of the same dinner times available. The orientation label is self-described context, not a substitute for the selected-gender rules, and does not independently add or remove a candidate. For qualified pairs, compatibility is calculated as 75% NotCupid&apos;s values, attachment, personality, and lifestyle model; 15% shared interests; and 10% the experiment questionnaire.</p>
      <p>The system then builds reciprocal shortlists of up to {RAFFLE.shortlistMaxOptions} people. It prioritizes giving as many qualified participants as possible one strong option before assigning anyone a second, and applies the same option cap regardless of gender, gender identity, or sexual orientation. A participant may privately say yes to either, both, or neither and may mark at most one favorite. Only pairs in which both participants say yes enter the final dinner selection.</p>
      <p>From the mutual-yes pool, the system selects up to {RAFFLE.winnerPairCount} winning pairs by weighted random selection without replacement. When at least two disjoint mutual pairs exist, the first selection is limited to pairs that leave a second pair possible; this prevents one overlapping edge from unnecessarily reducing two available prizes to one. Compatibility receives a bounded 1×–3× weight; one person marking the other as a favorite multiplies that pair&apos;s weight by 1.2, and both marking each other as favorites multiplies it by 1.5. After a pair is selected, both people and every other pair containing either person are removed before the next selection, so nobody can win twice. If fewer than {RAFFLE.winnerPairCount} disjoint mutual pairs exist, fewer prizes may be awarded. These weights affect relative odds but never guarantee selection. No human chooses the pairs, and purchases or subscriptions never affect offers, choices, or weighting.</p>
      <p>Exact odds cannot be calculated in advance. They depend on the number and preferences of eligible entrants, compatibility scores, the reciprocal shortlist graph, private yes/pass decisions, favorite choices, and whether disjoint mutual pairs remain after the first selection.</p>

      <h2>6. Private preview and mutual acceptance</h2>
      <p>A participant privately sees each person on their shortlist&apos;s first name, age, disclosed orientation label (unless they prefer not to label), photos, profile context, short experiment answer, and introduction video. Each participant has {RAFFLE.respondHours} hours to submit all choices independently. Choices are sealed: another participant cannot see whether they were accepted, passed, or favorited. A missing response is treated as no mutual choice. If no mutual pair forms, eligible participants may enter another shortlist round; no participant receives shortlists in more than {RAFFLE.maxAttempts} rounds for this experiment.</p>

      <h2>7. Dinner</h2>
      <p>Up to {RAFFLE.winnerPairCount} dinner prizes are available, one for each selected pair: one reservation on Thursday, August 20, 2026, at 6:30 PM Eastern Time and one at 8:30 PM Eastern Time. The restaurant and final slot assignment will be shared privately after selection. Each prize is one prepaid dinner at a selected Boston restaurant with a maximum approximate retail value of ${RAFFLE.budget} per pair, including ordinary tax and gratuity within that cap. Selected participants do not pay or request reimbursement for the included dinner. The maximum aggregate value of all prizes is ${RAFFLE.budget * RAFFLE.winnerPairCount}. Alcohol, parking, valet charges or tips, transportation, charges above the prepaid arrangement, and other expenses are not covered. A prize has no cash alternative, is not transferable, and may be rescheduled or substituted only with an equal-or-greater-value experience if the venue becomes unavailable or circumstances make fulfillment impracticable.</p>
      {entriesOpen && event?.prize_fulfillment_method && <p><strong>Confirmed fulfillment method:</strong> {event.prize_fulfillment_method}</p>}

      <h2>8. Winner confirmation and list</h2>
      <p>A potential winning participant may be required to confirm eligibility, identity, availability, and compliance with these rules before the prize is finalized. Failure to respond by a stated deadline, false information, or inability to attend may result in disqualification where permitted, but Sponsor will not reveal another participant&apos;s private yes/pass/favorite choice. Where required by law, a written request sent to <a href={`mailto:${CONTACT}`}>{CONTACT}</a> within 90 days after the dinner date may request the winners&apos; names, cities or towns, prize-receipt dates, and prize values. Required winner-list disclosure is separate from advertising or testimonial permission.</p>

      <h2>9. Notifications</h2>
      <p>In-app and opted-in push notifications may be used to administer selection and acceptance. An opted-in winning participant may also receive one reminder during the final 24 hours and one during the final three hours before the assigned dinner. Any email notification must follow the email preferences and consent applicable to the account. Participants are responsible for checking the app during the response window.</p>

      <h2>10. Video, profile, and privacy</h2>
      <p>The introduction video must show the entrant and be their original content. It may not include another identifiable person without permission or unlawful, hateful, explicit, or infringing material. The video is stored privately and shown only to up to {RAFFLE.shortlistMaxOptions} potential dates placed on a reciprocal shortlist with the participant, plus limited NotCupid administrators for operating and safeguarding the experiment. Entry does <strong>not</strong> grant NotCupid permission to use a participant&apos;s name, photos, video, or story in advertising. Any testimonial or promotional use requires separate written consent. Experiment videos are scheduled for deletion approximately 30 days after the round ends, subject to limited retention for safety, fraud, dispute, or legal needs. See the <a href="/privacy">Privacy Policy</a>.</p>

      <h2>11. Safety acknowledgment</h2>
      <p>NotCupid does not conduct criminal background checks and does not guarantee another participant&apos;s identity, conduct, compatibility, or attendance. Participants control whether they accept, may withdraw before selection, and may leave a date at any time. The dinner will be in a public venue. Participants should arrange separate transportation, tell a trusted person their plans, protect personal information, and follow the <a href="/safety">Safety &amp; Community Guidelines</a>. Call 911 in an emergency.</p>

      <h2>12. Conduct and removal</h2>
      <p>The <a href="/terms">NotCupid Terms of Service</a> and Safety &amp; Community Guidelines apply. NotCupid may remove an entrant or end participation for dishonesty, harassment, threats, fraud, manipulation, technical abuse, or conduct that presents a reasonable safety concern.</p>

      <h2>13. Changes, insufficient pool, and technical issues</h2>
      <p>NotCupid may pause, extend, modify, reschedule, or cancel the experiment if there is no mutually compatible pair, insufficient participation, suspected abuse, a security or technical failure, venue unavailability, or circumstances outside reasonable control. We will not force a low-compatibility pairing simply to award the dinner.</p>

      <h2>14. Taxes</h2>
      <p>Participants are responsible for any taxes that legally apply to the value they receive. NotCupid will provide required tax reporting only where applicable.</p>

      <h2>15. Disclaimers and limits</h2>
      <p>Participation and the dinner are voluntary. To the fullest extent permitted by law, NotCupid and Lemon Labs disclaim warranties and are not responsible for indirect or consequential losses arising from participation or another participant&apos;s independent conduct. Nothing in these terms excludes or limits liability that cannot legally be excluded, including liability arising from gross negligence or intentional misconduct.</p>

      <h2>16. Governing law</h2>
      <p>These terms are governed by Massachusetts law, without regard to conflict-of-laws rules. Any proceeding concerning the experiment must be brought in a court of competent jurisdiction in Massachusetts.</p>

      <h2>17. Platform disclosure</h2>
      <p>Apple Inc., Google LLC, and Reddit do not sponsor, endorse, administer, or have any association with this promotion. Entrants release those platforms from responsibility to the extent permitted by law. Sponsor, not Apple or another platform, is solely responsible for operating the experiment and fulfilling any dinner prize.</p>
      <p style={{ marginTop: '1.5rem', color: 'var(--h-text-dim)', fontSize: '0.85rem' }}>{entriesOpen ? 'These are the rules version accepted at entry.' : 'These Official Rules are a working legal document for a recreational project and must receive Massachusetts counsel review, along with confirmation of Sponsor legal details, before entries open.'} Contact <a href={`mailto:${CONTACT}`}>{CONTACT}</a> for a copy or question.</p>
    </LegalPage>
  );
}
