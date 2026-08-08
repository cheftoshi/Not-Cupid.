import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';
import { RAFFLE } from '@/lib/raffle';

export const metadata: Metadata = {
  title: 'Dating Experiment Terms — NotCupid',
  description: 'Eligibility, selection, consent, privacy, prize, and safety terms for the NotCupid Dating Experiment.',
};

const CONTACT = 'match@notcupid.com';

export default function DatingExperimentTermsPage() {
  return (
    <LegalPage title="Dating Experiment Terms" subtitle="The complete rules for Dinner on Us: Boston." updated="August 8, 2026">
      {!RAFFLE.entriesOpen && <p><strong>Quiet mode:</strong> entries are not currently open. These terms are published for transparency and may be updated before the entry period begins.</p>}

      <p>These terms apply to the <strong>{RAFFLE.series}</strong>, operated by NotCupid, a Lemon Labs property (the &quot;Sponsor&quot;). By entering, you agree to the version shown at entry: <strong>{RAFFLE.termsVersion}</strong>. For the plain-language plan, read the <a href="/dating-experiment/faq">Dating Experiment FAQ</a>. Questions may be sent to <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>

      <h2>1. Free entry</h2>
      <p>No purchase or payment is necessary to enter or be selected. A purchase, subscription, or NotCupid Pro membership does not improve anyone&apos;s selection odds. Limit one entry per person.</p>

      <h2>2. Eligibility</h2>
      <p>You must be 21 or older, reside in Massachusetts within approximately {RAFFLE.radiusMiles} miles of ZIP {RAFFLE.centerZip}, hold one genuine NotCupid account, complete the required profile and intro-video steps, and be able to attend the stated Boston dinner. Employees, contractors, and members of their immediate households are not eligible. Void where prohibited.</p>

      <h2>3. Entry period</h2>
      <p>The entry period closes at {RAFFLE.entryCloseLabel}, or when the published cap of {RAFFLE.cap} eligible entries is reached, whichever occurs first. NotCupid&apos;s server clock is the official timekeeper. The fixed dinner date is {RAFFLE.dateLabel}. If those fields are marked TBD, entries remain closed.</p>

      <h2>4. How to enter</h2>
      <p>Use the Dating Experiment screen, confirm your match preferences and availability, answer the short experiment questions, submit an original {RAFFLE.videoMinSeconds}–{RAFFLE.videoMaxSeconds}-second introduction video, and accept the required consent notices. Entries that are automated, duplicated, incomplete, misleading, abusive, or use content the entrant does not have the right to share may be disqualified.</p>

      <h2>5. Compatibility and selection</h2>
      <p>The system first applies mutual age and gender preferences, location eligibility, prior-pair exclusions, and a minimum compatibility threshold. Compatibility is calculated primarily from NotCupid&apos;s values, attachment, personality, and lifestyle model, with smaller contributions from shared interests and the experiment questions. One pair is then selected at random from the qualified pair pool, with stronger compatibility receiving a limited additional weight. Every qualified pair has a chance; no human chooses the pair, and payments never affect weighting. Odds depend on the number, preferences, and compatibility of eligible entrants and cannot be known in advance.</p>

      <h2>6. Private preview and mutual acceptance</h2>
      <p>Selected participants privately see one another&apos;s first name, age, photos, profile context, short experiment answer, and introduction video. Each has {RAFFLE.respondHours} hours to accept or decline independently. A decline is private and does not identify who declined. If either participant declines or does not respond, that pair is dissolved and another qualified pair may be selected. A participant may be selected no more than {RAFFLE.maxAttempts} times in a round.</p>

      <h2>7. Dinner</h2>
      <p>If both participants accept, NotCupid will cover one dinner for the pair at a selected Boston restaurant up to a total value of ${RAFFLE.budget}, including ordinary tax and gratuity within that cap. Alcohol, transportation, charges above the cap, and other expenses are not covered. The dinner has no cash alternative, is not transferable, and may be rescheduled, substituted with an equal-or-greater-value experience, or cancelled if the venue becomes unavailable or circumstances make the experiment impracticable.</p>

      <h2>8. Notifications</h2>
      <p>In-app and opted-in push notifications may be used to administer selection and acceptance. Any email notification must follow the email preferences and consent applicable to the account. Participants are responsible for checking the app during the response window.</p>

      <h2>9. Video, profile, and privacy</h2>
      <p>The introduction video must show the entrant and be their original content. It may not include another identifiable person without permission or unlawful, hateful, explicit, or infringing material. The video is stored privately and shown only to a selected potential date and limited NotCupid administrators for operating and safeguarding the experiment. Entry does <strong>not</strong> grant NotCupid permission to use a participant&apos;s name, photos, video, or story in advertising. Any testimonial or promotional use requires separate written consent. Experiment videos are scheduled for deletion approximately 30 days after the round ends, subject to limited retention for safety, fraud, dispute, or legal needs. See the <a href="/privacy">Privacy Policy</a>.</p>

      <h2>10. Safety acknowledgment</h2>
      <p>NotCupid does not conduct criminal background checks and does not guarantee another participant&apos;s identity, conduct, compatibility, or attendance. Participants control whether they accept, may withdraw before selection, and may leave a date at any time. The dinner will be in a public venue. Participants should arrange separate transportation, tell a trusted person their plans, protect personal information, and follow the <a href="/safety">Safety &amp; Community Guidelines</a>. Call 911 in an emergency.</p>

      <h2>11. Conduct and removal</h2>
      <p>The <a href="/terms">NotCupid Terms of Service</a> and Safety &amp; Community Guidelines apply. NotCupid may remove an entrant or end participation for dishonesty, harassment, threats, fraud, manipulation, technical abuse, or conduct that presents a reasonable safety concern.</p>

      <h2>12. Changes, insufficient pool, and technical issues</h2>
      <p>NotCupid may pause, extend, modify, reschedule, or cancel the experiment if there is no mutually compatible pair, insufficient participation, suspected abuse, a security or technical failure, venue unavailability, or circumstances outside reasonable control. We will not force a low-compatibility pairing simply to award the dinner.</p>

      <h2>13. Taxes</h2>
      <p>Participants are responsible for any taxes that legally apply to the value they receive. NotCupid will provide required tax reporting only where applicable.</p>

      <h2>14. Disclaimers and limits</h2>
      <p>Participation and the dinner are voluntary. To the fullest extent permitted by law, NotCupid and Lemon Labs disclaim warranties and are not responsible for indirect or consequential losses arising from participation or another participant&apos;s independent conduct. Nothing in these terms excludes or limits liability that cannot legally be excluded, including liability arising from gross negligence or intentional misconduct.</p>

      <h2>15. Governing law</h2>
      <p>These terms are governed by Massachusetts law, without regard to conflict-of-laws rules. Any proceeding concerning the experiment must be brought in a court of competent jurisdiction in Massachusetts.</p>

      <p style={{ marginTop: '1.5rem', color: 'var(--h-text-dim)', fontSize: '0.85rem' }}>These terms are a working legal document for a recreational project and should receive Massachusetts counsel review before entries open. Contact <a href={`mailto:${CONTACT}`}>{CONTACT}</a> for a copy or question.</p>
    </LegalPage>
  );
}
