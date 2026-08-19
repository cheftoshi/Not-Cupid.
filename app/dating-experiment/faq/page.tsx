import type { Metadata } from 'next';
import Link from 'next/link';
import { RAFFLE, raffleEntriesOpen } from '@/lib/raffle';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Dating Experiment FAQ — NotCupid',
  description: 'A simple guide to joining, private previews, compatibility-weighted selection, dinner, optional video privacy, and safety.',
};

const ORANGE = '#ff6a1f';
const ORANGE_DEEP = '#d2530f';
const BLUE = '#2563ff';

const STEPS = [
  ['1', 'Join for free', `Complete your profile and answer four quick experiment prompts. A private ${RAFFLE.videoMinSeconds}–${RAFFLE.videoMaxSeconds}-second hello video is optional.`],
  ['2', 'Meet up to two', 'The system prioritizes broad coverage, then gives each qualified participant up to two strong reciprocal options.'],
  ['3', 'Choose privately', `You have up to ${RAFFLE.respondHours} hours to say yes to either, both, or neither—and optionally favorite one. Every choice stays sealed.`],
  ['4', 'Mutual wins', `Only mutual yes pairs qualify. Up to ${RAFFLE.winnerPairCount} disjoint pairs are selected, with each dinner covered up to $${RAFFLE.budget}.`],
];

const FAQS = [
  {
    q: 'Is the Dating Experiment open now?',
    a: `The experiment screen always shows the live entry status. The two planned dinner slots are ${RAFFLE.dateLabel}. Reading this page, reviewing the rules, or visiting the experiment does not enter you.`,
  },
  {
    q: 'Who will be able to join?',
    a: `The first round is for genuine NotCupid members who are 21 or older, live in Massachusetts within about ${RAFFLE.radiusMiles} miles of ZIP ${RAFFLE.centerZip}, have a complete profile, and can attend at least one August 20 dinner slot. Test accounts cannot enter.`,
  },
  {
    q: 'Does it cost anything?',
    a: 'No. Entry is free. Paying for Pro, an unlock, or anything else on NotCupid never adds entries or improves selection odds.',
  },
  {
    q: 'How is a pair selected?',
    a: `Mutual gender, age, location, and dinner-time availability are hard gates. Eligible pairs then receive a fit score: 75% the core NotCupid personality, values, attachment, and lifestyle model; 15% shared interests; and 10% the experiment questionnaire. Pairs below the minimum score are removed. The system first tries to give as many people as possible one strong reciprocal option, then fills second slots where the pool supports it. You may say yes to one, both, or neither. Only mutual yes pairs enter the final selection. Compatibility gets a limited 1×–3× weight, and favorites add a small disclosed boost. The system selects up to ${RAFFLE.winnerPairCount} pairs without replacement and assigns different shared time slots, so nobody can win twice and nobody is assigned a time they did not choose.`,
  },
  {
    q: 'Can all genders and orientations participate?',
    a: 'Yes. Orientation is an explicit choice: straight, bisexual, gay, lesbian, pansexual, queer, asexual / ace-spectrum, questioning, or prefer not to label. Participants can identify as a man, woman, or non-binary / another identity and select any one-or-more combination of those genders they would meet. Everyone receives the same shortlist cap, and actual options depend on the compatible local pool.',
  },
  {
    q: 'Is bisexual a main choice?',
    a: 'Yes. Bisexual is a first-class orientation choice, shown directly alongside the other orientation options rather than inferred from selecting more than one gender. Your selected genders still control who can be considered, so a label never makes assumptions about your current dating preferences.',
  },
  {
    q: 'How do age and gender preferences work?',
    a: 'They are reciprocal and saved with your experiment entry. You choose an inclusive range from 21 through 99 because this experiment is 21+. Someone can appear only if their identity is among the genders you selected, your identity is among the genders they selected, their age is inside your range, and your age is inside theirs. These experiment choices do not change your general Love Line settings, and editing your general profile later does not silently change this entry.',
  },
  {
    q: 'Do women and men receive different numbers of options?',
    a: `No. Everyone has the same cap of up to ${RAFFLE.shortlistMaxOptions} options. Actual shortlist size depends on reciprocal age and gender preferences, compatibility, prior pairings, and pool supply. The coverage-first system gives people a first option before it starts giving others a second.`,
  },
  {
    q: 'Is a short video required?',
    a: `No. The ${RAFFLE.videoMinSeconds}–${RAFFLE.videoMaxSeconds}-second hello is completely optional. It can add personality if you want it, but skipping it never changes eligibility, fit score, shortlist priority, or selection odds. If you add one, keep it simple: your name and one thing you would enjoy doing or talking about on a Boston date. It is not a public audition.`,
  },
  {
    q: 'What if I can make only one dinner time?',
    a: 'Choose only that time. You can choose 6:30 PM, 8:30 PM, or both. A person can appear in your shortlist only when you both marked at least one of the same slots available, and a winning pair is assigned only to a shared slot.',
  },
  {
    q: 'Who can see my video and profile?',
    a: `Only the people placed on reciprocal shortlists with you—no more than ${RAFFLE.shortlistMaxOptions} in a round—and limited NotCupid administrators who operate or safeguard the experiment. A disclosed orientation label is included in that private preview; “prefer not to label” shows no label. Videos are stored privately and played through short-lived links. Joining does not give NotCupid permission to use your name, photos, video, or story in advertising.`,
  },
  {
    q: 'How long is the video kept?',
    a: 'You can withdraw before selection and request deletion of the experiment video. Remaining experiment videos are scheduled for deletion about 30 days after the round ends, except when limited retention is reasonably needed for safety, fraud, a dispute, or a legal obligation.',
  },
  {
    q: 'What do we see before deciding?',
    a: `You privately see each shortlist option’s first name, age, photos, bio, archetype, disclosed orientation, shared interests, experiment answers, conversation prompt, fit score, and an intro video when they chose to add one. You decide independently within the deadline shown in the app, with up to ${RAFFLE.respondHours} hours. You cannot see anyone else’s decisions, and restaurant details stay private until the winning mutual pairs are selected.`,
  },
  {
    q: 'What if one person passes or does not respond?',
    a: `That offer cannot become a mutual pair. NotCupid does not tell either person who passed or failed to respond. If the round produces no mutual pair, eligible participants may receive another shortlist, up to ${RAFFLE.maxAttempts} shortlist rounds in the experiment.`,
  },
  {
    q: `What do the $${RAFFLE.budget} dinner prizes cover?`,
    a: `Up to ${RAFFLE.winnerPairCount} winning pairs can each receive one prepaid dinner valued up to $${RAFFLE.budget}, for a maximum aggregate prize value of $${RAFFLE.budget * RAFFLE.winnerPairCount}. Ordinary tax and gratuity count toward each limit. Alcohol, parking, valet charges or tips, transportation, and spending outside the prepaid arrangement are not included. There is no cash alternative.`,
  },
  {
    q: 'Does NotCupid background-check participants?',
    a: 'No. NotCupid does not conduct criminal background checks or guarantee identity, behavior, chemistry, or attendance. The dinner will be at a public venue. Use separate transportation, tell someone you trust where you are going, protect personal information, and leave whenever you want.',
  },
  {
    q: 'How will I know if I am selected?',
    a: 'If you opt in, the app can send a transactional email and push when your shortlist is ready, one reminder near its deadline, a confirmation when a winning mutual pair is selected, and final dinner reminders. The app remains the source of truth. No promotional email campaign is part of joining.',
  },
];

export default function DatingExperimentFaqPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--h-bg)', color: 'var(--h-text)', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <main style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: 'calc(1.5rem + env(safe-area-inset-top, 0px)) calc(1.25rem + env(safe-area-inset-right, 0px)) calc(4rem + env(safe-area-inset-bottom, 0px)) calc(1.25rem + env(safe-area-inset-left, 0px))',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dating-experiment" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.2rem', textDecoration: 'none' }}>
            <span style={{ color: BLUE }}>Not</span><span style={{ color: ORANGE }}>Cupid</span>
          </Link>
          <Link href="/dating-experiment" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--h-text-dim)', textDecoration: 'none' }}>← experiment</Link>
        </div>

        <div style={{ marginTop: '2rem', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: ORANGE_DEEP, fontWeight: 700 }}>Dinner on Us · Boston</div>
        <h1 style={{ margin: '0.45rem 0 0.65rem', fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: 'clamp(2.45rem, 9vw, 4rem)', lineHeight: 1 }}>the simple plan.</h1>
        <p style={{ margin: 0, maxWidth: 620, color: 'var(--h-text-dim)', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '1.05rem', lineHeight: 1.55 }}>
          Four steps, two private decisions, and up to two compatibility-led Boston dinner pairs. Here’s exactly how the experiment is intended to work.
        </p>

        {raffleEntriesOpen() && (
          <div style={{ marginTop: '1.25rem', padding: '0.85rem 1rem', border: '1px solid rgba(255,106,31,0.35)', borderRadius: 12, background: 'rgba(255,106,31,0.08)', color: 'var(--h-text-dim)', fontSize: '0.86rem', lineHeight: 1.5 }}>
            <b style={{ color: 'var(--h-text)' }}>Entries are open:</b> join free before {RAFFLE.entryCloseLabel} or before the {RAFFLE.cap}-person cap is reached. The two dinner slots are Thursday, August 20 at 6:30 PM and 8:30 PM ET; the restaurant is revealed privately to selected pairs.
          </div>
        )}
        {!raffleEntriesOpen() && (
          <div style={{ marginTop: '1.25rem', padding: '0.85rem 1rem', border: '1px solid var(--h-border)', borderRadius: 12, background: 'var(--h-surface)', color: 'var(--h-text-dim)', fontSize: '0.86rem', lineHeight: 1.5 }}>
            <b style={{ color: 'var(--h-text)' }}>Entries are closed.</b> Private shortlists and mutual dinner selection now continue inside the Dating Experiment screen.
          </div>
        )}

        <section aria-labelledby="plan-heading" style={{ marginTop: '2rem' }}>
          <h2 id="plan-heading" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.17em', textTransform: 'uppercase', color: 'var(--h-text-faint)' }}>how it works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.75rem' }}>
            {STEPS.map(([number, title, body]) => (
              <article key={number} style={{ padding: '1rem', background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 15 }}>
                <div style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 999, background: ORANGE, color: '#fff', fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', fontWeight: 700 }}>{number}</div>
                <h3 style={{ margin: '0.65rem 0 0.3rem', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '1.15rem' }}>{title}</h3>
                <p style={{ margin: 0, color: 'var(--h-text-dim)', fontSize: '0.86rem', lineHeight: 1.55 }}>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="faq-heading" style={{ marginTop: '2.4rem' }}>
          <h2 id="faq-heading" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '1.8rem', margin: '0 0 0.8rem' }}>questions, answered.</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {FAQS.map((item, index) => (
              <details key={item.q} open={index === 0} style={{ background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 14, padding: '0.9rem 1rem' }}>
                <summary style={{ cursor: 'pointer', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 700, fontSize: '1.03rem', color: 'var(--h-text)' }}>{item.q}</summary>
                <p style={{ margin: '0.65rem 0 0', color: 'var(--h-text-dim)', fontSize: '0.89rem', lineHeight: 1.6 }}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid var(--h-border)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem 1.2rem' }}>
          <Link href="/dating-experiment" style={{ color: ORANGE_DEEP, fontWeight: 700, textDecoration: 'none' }}>← Back to the experiment</Link>
          <Link href="/dating-experiment/terms" style={{ color: 'var(--h-text-dim)' }}>Read the full Experiment Terms</Link>
          <Link href="/safety" style={{ color: 'var(--h-text-dim)' }}>Safety guidelines</Link>
        </div>
        <p style={{ marginTop: '1rem', color: 'var(--h-text-faint)', fontSize: '0.74rem', lineHeight: 1.5 }}>This FAQ is a plain-language summary. The Dating Experiment Terms control if there is a conflict.</p>
      </main>
    </div>
  );
}
