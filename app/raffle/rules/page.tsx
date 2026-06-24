import Link from 'next/link';
import CorpFooter from '@/components/corp-footer';
import { RAFFLE } from '@/lib/raffle';

export const dynamic = 'force-static';

// Official Rules for the Summer of Connection giveaway. Structured as a NO-
// PURCHASE-NECESSARY sweepstakes (free entry + chance) — NOT a paid raffle/
// lottery. ⚠️ This is a template: have counsel review before each round, and
// fill the Sponsor's legal name + mailing address below.
const ORANGE = '#ff6a1f';
const ORANGE_DEEP = '#d2530f';

const SPONSOR = 'NotCupid (a Lemon Labs property)';
const CONTACT = 'match@notcupid.com';

const SECTIONS: { h: string; b: string }[] = [
  {
    h: '1. No purchase necessary',
    b: `No purchase or payment of any kind is necessary to enter or win. A purchase will not improve your chances of winning. Entry is free. This promotion is a sweepstakes (a prize awarded by chance among eligible entrants) — it is not a lottery or a paid raffle, and no consideration is required to participate.`,
  },
  {
    h: '2. Sponsor',
    b: `This promotion is sponsored by ${SPONSOR} (the “Sponsor”), [Sponsor legal mailing address]. Questions: ${CONTACT}. The Sponsor is solely responsible for the promotion. It is not sponsored, endorsed, or administered by Apple, Google, Meta, or any other platform.`,
  },
  {
    h: '3. Eligibility',
    b: `Open only to legal residents of the ${RAFFLE.city} metropolitan area (Massachusetts) who are 21 years of age or older at the time of entry and who have a complete, genuine NotCupid account. This prize is a restaurant dinner and is restricted to entrants 21 and over; you may be asked to show valid government ID confirming you are 21+ to receive the prize. Employees, contractors, and immediate family/household members of the Sponsor are not eligible. Void outside the eligible area and where prohibited or restricted by law.`,
  },
  {
    h: '4. Promotion period',
    b: `The “${RAFFLE.series}” round runs from the date entries open through ${RAFFLE.entryCloseLabel} (the entry deadline), or until the entry cap of ${RAFFLE.cap} is reached, whichever comes first. The Sponsor’s computer is the official timekeeper. Entries submitted after the entry period are void.`,
  },
  {
    h: '5. How to enter',
    b: `During the entry period, open the raffle in the NotCupid app, complete the required steps (a complete profile, your match basics, and a short intro video), agree to these Official Rules, and submit. Limit one (1) entry per person per round. Entries that are incomplete, fraudulent, automated, or that misrepresent your identity are void. The intro video must be your own original content and must not contain third-party material, other identifiable people without their consent, or anything unlawful, obscene, or offensive.`,
  },
  {
    h: '6. How the winner is selected',
    b: `Selection is automatic and made by chance. Among entrants who are mutually compatible (by the gender and age preferences each entrant provides), the system enumerates every eligible pair and draws one pair at random, weighted by a compatibility score. Every eligible pair has a chance to be drawn; better-matched pairs are weighted to be drawn more often. No human chooses the winner. Both members of a drawn pair must accept within the stated response window for the prize to be awarded. If either declines or does not respond, that pair is dissolved and another eligible pair is drawn (each entrant may be drawn up to two times per round). Odds of being selected depend on the number and compatibility of eligible entrants.`,
  },
  {
    h: '7. Prize',
    b: `One (1) prize per round: a dinner for the two selected participants at a Sponsor-selected restaurant in the ${RAFFLE.city} area, with a total approximate retail value (ARV) of up to $${RAFFLE.budget} USD (covering food and non-alcoholic beverages for two; alcohol, gratuity above the covered amount, transportation, and all other costs are the participants’ responsibility). The prize is for the experience described, is non-transferable, and has no cash equivalent except at the Sponsor’s sole discretion. The Sponsor may substitute a prize of equal or greater value. The date, time, and venue are set by the Sponsor (targeted for ${RAFFLE.dateLabel}) and are subject to availability and change.`,
  },
  {
    h: '8. Taxes',
    b: `Any and all taxes on the prize are the sole responsibility of the prize recipients. The Sponsor will issue tax forms (e.g., IRS Form 1099) where required by law. Recipients may be required to provide tax information before the prize is awarded.`,
  },
  {
    h: '9. Winner notification & acceptance',
    b: `Selected participants will be notified in the app and, where enabled, by push notification and/or email. To claim the prize, each selected participant must accept within the response window shown in the app. Failure to accept in time, an undeliverable notification, or non-compliance with these rules results in forfeiture, and an alternate pair may be drawn.`,
  },
  {
    h: '10. Publicity & likeness release',
    b: `Except where prohibited by law, by entering you grant the Sponsor a non-exclusive, royalty-free, worldwide license to use your name, first initial, city, photo, the intro video you submit, and any statements you make in connection with the promotion, for advertising, marketing, and promotional purposes in any media, without additional notice, compensation, review, or approval. You represent that you own or control all rights in the video you submit and that its use as described will not infringe any third party’s rights.`,
  },
  {
    h: '11. Meeting safety, assumption of risk & release',
    b: `The prize is an in-person meeting between two adults who are strangers. The Sponsor does NOT conduct background checks, is NOT a party to, host of, or chaperone of the meeting, and makes no representation or warranty about any participant. You participate, communicate, and meet entirely AT YOUR OWN RISK. Follow the in-app safety guidance: meet in a public place, arrange your own transportation, tell a friend where you’ll be, and trust your instincts. To the fullest extent permitted by law, you — on behalf of yourself, your heirs, and your representatives — hereby release, waive, and forever discharge the Sponsor, its parent, affiliates, partners, restaurants/venues, and their respective officers, directors, employees, and agents (the “Released Parties”) from any and all claims, demands, liabilities, injuries, losses, costs, or damages of any kind, whether known or unknown, arising out of or relating to your entry, the promotion, the prize, the venue, or any meeting, communication, or interaction with another participant.`,
  },
  {
    h: '12. Conduct & disqualification',
    b: `The Sponsor may disqualify any entrant who tampers with the promotion, violates these rules or the NotCupid Terms, behaves abusively, or acts in bad faith. The Sponsor may pause, modify, or cancel the promotion if fraud, technical failure, or any factor beyond its control compromises its integrity.`,
  },
  {
    h: '13. Privacy',
    b: `Information you submit is handled in accordance with the NotCupid Privacy Policy. By entering, you consent to the Sponsor using your information to administer the promotion and contact you about it.`,
  },
  {
    h: '14. Limitation of liability & indemnification',
    b: `The promotion and prize are provided “AS IS” and “AS AVAILABLE” without warranty of any kind, express or implied. The Released Parties are not responsible for the food, beverages, service, premises, or conduct of any third party, including the restaurant/venue. To the fullest extent permitted by law, the Released Parties will not be liable for any indirect, incidental, special, punitive, or consequential damages, or for any personal injury, property damage, or loss, arising out of or relating to the promotion, the prize, or any meeting. You agree to indemnify, defend, and hold harmless the Released Parties from and against any claim, loss, liability, or expense (including reasonable attorneys’ fees) arising out of or relating to your participation, your conduct, your intro video, your interactions with another participant, or your breach of these Official Rules. Nothing in these rules limits any liability that cannot be limited under applicable law.`,
  },
  {
    h: '15. Governing law & disputes',
    b: `These Official Rules are governed by the laws of the Commonwealth of Massachusetts, without regard to conflict-of-laws principles. Any dispute will be resolved exclusively in the state or federal courts located in Massachusetts.`,
  },
  {
    h: '16. Winners & rules requests',
    b: `For the name of a prize recipient or a copy of these Official Rules, contact ${CONTACT} during or within 30 days after the entry period.`,
  },
];

export default function RaffleRules() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--h-bg)', color: 'var(--h-text)', fontFamily: 'ui-sans-serif,system-ui,sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <span style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.15rem', color: '#2563ff' }}>not<span style={{ color: ORANGE }}>cupid</span></span>
          <Link href="/raffle" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--h-text-dim)', textDecoration: 'none' }}>← back to the raffle</Link>
        </div>

        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: ORANGE_DEEP, marginBottom: '0.5rem', fontWeight: 700 }}>🎟️ {RAFFLE.series} · {RAFFLE.city}</div>
        <h1 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: 'clamp(2rem,7vw,3rem)', lineHeight: 1.05, margin: '0 0 0.5rem' }}>Official Rules</h1>
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '1rem', margin: '0 0 1.5rem' }}>
          No purchase necessary. Open to {RAFFLE.city}-area residents 21+. A sweepstakes — free to enter, winner by chance.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {SECTIONS.map((s) => (
            <div key={s.h}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', letterSpacing: '0.04em', color: 'var(--h-text)', fontWeight: 700, marginBottom: '0.3rem' }}>{s.h}</div>
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--h-text-dim)' }}>{s.b}</p>
            </div>
          ))}
        </div>

        <p style={{ marginTop: '2rem', fontSize: '0.78rem', lineHeight: 1.6, color: 'var(--h-text-faint)', fontStyle: 'italic' }}>
          By entering, you confirm that you are 21 or older, eligible, and agree to these Official Rules and the{' '}
          <Link href="/terms" style={{ color: ORANGE_DEEP }}>NotCupid Terms</Link> and{' '}
          <Link href="/privacy" style={{ color: ORANGE_DEEP }}>Privacy Policy</Link>.
        </p>
      </div>
      <CorpFooter />
    </div>
  );
}
