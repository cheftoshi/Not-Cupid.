import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';
import { RAFFLE, raffleEntriesOpen } from '@/lib/raffle';

export const metadata: Metadata = {
  title: 'Dating Experiment Official Rules & Terms — NotCupid',
  description: 'Official eligibility, selection, prize, privacy, and safety rules for the NotCupid Dating Experiment.',
};

const CONTACT = 'match@notcupid.com';

export default function DatingExperimentTermsPage() {
  return (
    <LegalPage title="Dating Experiment Official Rules & Terms" subtitle="No purchase necessary. The complete rules for Dinner on Us: Boston." updated="August 8, 2026">
      {!raffleEntriesOpen() && <p><strong>Quiet mode:</strong> entries are not currently open. These rules are published for transparency and may be updated before the entry period begins.</p>}

      <p><strong>NO PURCHASE OR PAYMENT IS NECESSARY TO ENTER OR WIN. A PURCHASE WILL NOT IMPROVE THE CHANCE OF RECEIVING A SHORTLIST OR PRIZE. VOID WHERE PROHIBITED.</strong></p>
      <p>These Official Rules and Terms apply to the <strong>{RAFFLE.series}</strong>, operated by NotCupid, a Lemon Labs property (the &quot;Sponsor&quot;). By entering, you agree to the version shown at entry: <strong>{RAFFLE.termsVersion}</strong>. For the plain-language plan, read the <a href="/dating-experiment/faq">Dating Experiment FAQ</a>. Questions may be sent to <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>

      <h2>1. Free entry</h2>
      <p>Entry is free through the Dating Experiment screen. No purchase or payment is necessary to enter, receive a shortlist, or be selected. A purchase, subscription, donation, profile unlock, or NotCupid Pro membership does not add entries, change shortlist priority, or improve selection odds. Limit one entry per person.</p>

      <h2>2. Eligibility</h2>
      <p>You must be 21 or older, reside in Massachusetts within approximately {RAFFLE.radiusMiles} miles of ZIP {RAFFLE.centerZip}, hold one genuine NotCupid account, complete the required profile and intro-video steps, and be able to attend the stated Boston dinner. Employees, contractors, and members of their immediate households are not eligible. Test, duplicate, automated, and fraudulent accounts are excluded. The experiment supports reciprocal preferences involving men, women, and non-binary participants, including different-gender and same-gender pairings; no pairing is guaranteed. Void where prohibited.</p>

      <h2>3. Entry period</h2>
      <p>The entry period opens only when the Dating Experiment screen states that entries are open and closes at {RAFFLE.entryCloseLabel}, or when the published cap of {RAFFLE.cap} eligible entries is reached, whichever occurs first. NotCupid&apos;s server clock is the official timekeeper. The fixed dinner date is {RAFFLE.dateLabel}. If any date is marked TBD, entries remain closed.</p>

      <h2>4. How to enter</h2>
      <p>Use the Dating Experiment screen, confirm your match preferences and availability, answer the short experiment questions, submit an original {RAFFLE.videoMinSeconds}–{RAFFLE.videoMaxSeconds}-second introduction video, and accept the required consent notices. Entries that are automated, duplicated, incomplete, misleading, abusive, or use content the entrant does not have the right to share may be disqualified.</p>

      <h2>5. Compatibility and selection</h2>
      <p>The system first applies mutual age and gender preferences, location eligibility, prior-pair exclusions, and a minimum compatibility threshold. Compatibility is calculated primarily from NotCupid&apos;s values, attachment, personality, and lifestyle model, with smaller contributions from shared interests and the experiment questions.</p>
      <p>The system then builds reciprocal shortlists of up to {RAFFLE.shortlistMaxOptions} people. It prioritizes giving as many qualified participants as possible one strong option before assigning anyone a second, and applies the same option cap regardless of gender, gender identity, or sexual orientation. A participant may privately say yes to either, both, or neither and may mark at most one favorite. Only pairs in which both participants say yes enter the final dinner selection.</p>
      <p>From the mutual-yes pool, the system selects up to {RAFFLE.winnerPairCount} winning pairs by weighted random selection without replacement. When at least two disjoint mutual pairs exist, the first selection is limited to pairs that leave a second pair possible; this prevents one overlapping edge from unnecessarily reducing two available prizes to one. Compatibility receives a bounded 1×–3× weight; one person marking the other as a favorite multiplies that pair&apos;s weight by 1.2, and both marking each other as favorites multiplies it by 1.5. After a pair is selected, both people and every other pair containing either person are removed before the next selection, so nobody can win twice. If fewer than {RAFFLE.winnerPairCount} disjoint mutual pairs exist, fewer prizes may be awarded. These weights affect relative odds but never guarantee selection. No human chooses the pairs, and purchases or subscriptions never affect offers, choices, or weighting.</p>
      <p>Exact odds cannot be calculated in advance. They depend on the number and preferences of eligible entrants, compatibility scores, the reciprocal shortlist graph, private yes/pass decisions, favorite choices, and whether disjoint mutual pairs remain after the first selection.</p>

      <h2>6. Private preview and mutual acceptance</h2>
      <p>A participant privately sees each person on their shortlist&apos;s first name, age, photos, profile context, short experiment answer, and introduction video. Each participant has {RAFFLE.respondHours} hours to submit all choices independently. Choices are sealed: another participant cannot see whether they were accepted, passed, or favorited. A missing response is treated as no mutual choice. If no mutual pair forms, eligible participants may enter another shortlist round; no participant receives shortlists in more than {RAFFLE.maxAttempts} rounds for this experiment.</p>

      <h2>7. Dinner</h2>
      <p>Up to {RAFFLE.winnerPairCount} dinner prizes are available, one for each selected pair. Each prize is one dinner at a selected Boston restaurant with a maximum approximate retail value of ${RAFFLE.budget}, including ordinary tax and gratuity within that cap. The maximum aggregate value of all prizes is ${RAFFLE.budget * RAFFLE.winnerPairCount}. Alcohol, transportation, charges above the cap, and other expenses are not covered. A prize has no cash alternative, is not transferable, and may be rescheduled or substituted only with an equal-or-greater-value experience if the venue becomes unavailable or circumstances make fulfillment impracticable.</p>

      <h2>8. Winner confirmation and list</h2>
      <p>A potential winning participant may be required to confirm eligibility, identity, availability, and compliance with these rules before the prize is finalized. Failure to respond by a stated deadline, false information, or inability to attend may result in disqualification where permitted, but Sponsor will not reveal another participant&apos;s private yes/pass/favorite choice. Where required by law, a written request sent to <a href={`mailto:${CONTACT}`}>{CONTACT}</a> within 90 days after the dinner date may request the winners&apos; names, cities or towns, prize-receipt dates, and prize values. Required winner-list disclosure is separate from advertising or testimonial permission.</p>

      <h2>9. Notifications</h2>
      <p>In-app and opted-in push notifications may be used to administer selection and acceptance. Any email notification must follow the email preferences and consent applicable to the account. Participants are responsible for checking the app during the response window.</p>

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

      <p style={{ marginTop: '1.5rem', color: 'var(--h-text-dim)', fontSize: '0.85rem' }}>These Official Rules are a working legal document for a recreational project and must receive Massachusetts counsel review, along with confirmation of Sponsor details, dates, venue, and prize funding, before entries open. Contact <a href={`mailto:${CONTACT}`}>{CONTACT}</a> for a copy or question.</p>
    </LegalPage>
  );
}
