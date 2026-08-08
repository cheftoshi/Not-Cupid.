import type { Metadata } from 'next';
import Link from 'next/link';
import { RAFFLE } from '@/lib/raffle';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Dating Experiment FAQ — NotCupid',
  description: 'A simple guide to joining, private previews, compatibility-weighted selection, dinner, video privacy, and safety.',
};

const ORANGE = '#ff6a1f';
const ORANGE_DEEP = '#d2530f';
const BLUE = '#2563ff';

const STEPS = [
  ['1', 'Join for free', `Complete your profile, answer three quick questions, and add a private ${RAFFLE.videoMinSeconds}–${RAFFLE.videoMaxSeconds}-second hello video.`],
  ['2', 'The system pairs', 'Mutual preferences come first. Then compatibility gives stronger qualified pairs a limited boost in a random selection.'],
  ['3', 'Both people decide', `You each get a private preview and ${RAFFLE.respondHours} hours to say yes or pass. A pass stays private.`],
  ['4', 'Dinner is on us', `If you both say yes, NotCupid shares the plan and covers one Boston dinner up to $${RAFFLE.budget}.`],
];

const FAQS = [
  {
    q: 'Is the Dating Experiment open now?',
    a: `Not yet. The first Boston round is in quiet mode while the date, restaurant, safeguards, and operating plan are finalized. If the date says “TBD,” entries are closed. Reading this page or visiting the experiment does not enter you.`,
  },
  {
    q: 'Who will be able to join?',
    a: `The first round is planned for genuine NotCupid members who are 21 or older, live in Massachusetts within about ${RAFFLE.radiusMiles} miles of ZIP ${RAFFLE.centerZip}, have a complete profile, and can attend the fixed Boston dinner. Test accounts cannot enter.`,
  },
  {
    q: 'Does it cost anything?',
    a: 'No. Entry is free. Paying for Pro, an unlock, or anything else on NotCupid never adds entries or improves selection odds.',
  },
  {
    q: 'How is a pair selected?',
    a: 'The system first checks mutual age and gender preferences, local eligibility, prior pairings, and a minimum compatibility score. It then randomly selects from the qualified pairs. Higher compatibility gets a limited 1×–3× weight, so fit matters without turning the result into a guaranteed or hand-picked match.',
  },
  {
    q: 'Why is a short video required?',
    a: `A real ${RAFFLE.videoMinSeconds}–${RAFFLE.videoMaxSeconds}-second hello adds presence and trust that photos alone cannot. Keep it simple: your name and one thing you would enjoy doing or talking about on a Boston date. It is not a public audition.`,
  },
  {
    q: 'Who can see my video and profile?',
    a: 'Only a potential date selected with you and limited NotCupid administrators who operate or safeguard the experiment. Videos are stored privately and played through short-lived links. Joining does not give NotCupid permission to use your name, photos, video, or story in advertising.',
  },
  {
    q: 'How long is the video kept?',
    a: 'You can withdraw before selection and request deletion of the experiment video. Remaining experiment videos are scheduled for deletion about 30 days after the round ends, except when limited retention is reasonably needed for safety, fraud, a dispute, or a legal obligation.',
  },
  {
    q: 'What do we see before deciding?',
    a: `Each selected person privately sees the other person’s first name, age, photos, profile context, short experiment answer, and intro video. Each person decides independently within ${RAFFLE.respondHours} hours. The restaurant details stay private until both people accept.`,
  },
  {
    q: 'What if one person passes or does not respond?',
    a: `The pairing quietly ends. NotCupid does not tell either person who passed. An eligible participant may return to the pool for another compatible selection, with no more than ${RAFFLE.maxAttempts} selections in the round.`,
  },
  {
    q: `What does the $${RAFFLE.budget} dinner cover?`,
    a: `NotCupid plans to cover one dinner for the mutually accepting pair up to $${RAFFLE.budget} total, including ordinary tax and gratuity within that limit. Alcohol, transportation, and spending above the limit are not included. There is no cash alternative.`,
  },
  {
    q: 'Does NotCupid background-check participants?',
    a: 'No. NotCupid does not conduct criminal background checks or guarantee identity, behavior, chemistry, or attendance. The dinner will be at a public venue. Use separate transportation, tell someone you trust where you are going, protect personal information, and leave whenever you want.',
  },
  {
    q: 'How will I know if I am selected?',
    a: 'The app can send an opted-in push notification, and your experiment screen will show the private preview. Participants are responsible for checking the app during the response window. No promotional email campaign is part of joining.',
  },
];

export default function DatingExperimentFaqPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--h-bg)', color: 'var(--h-text)', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dating-experiment" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.2rem', textDecoration: 'none' }}>
            <span style={{ color: BLUE }}>Not</span><span style={{ color: ORANGE }}>Cupid</span>
          </Link>
          <Link href="/dating-experiment" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--h-text-dim)', textDecoration: 'none' }}>← experiment</Link>
        </div>

        <div style={{ marginTop: '2rem', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: ORANGE_DEEP, fontWeight: 700 }}>Dinner on Us · Boston</div>
        <h1 style={{ margin: '0.45rem 0 0.65rem', fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: 'clamp(2.45rem, 9vw, 4rem)', lineHeight: 1 }}>the simple plan.</h1>
        <p style={{ margin: 0, maxWidth: 620, color: 'var(--h-text-dim)', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '1.05rem', lineHeight: 1.55 }}>
          Four steps, two private decisions, one compatibility-led Boston dinner. Here’s exactly how the experiment is intended to work.
        </p>

        {!RAFFLE.entriesOpen && (
          <div style={{ marginTop: '1.25rem', padding: '0.85rem 1rem', border: '1px solid rgba(255,106,31,0.35)', borderRadius: 12, background: 'rgba(255,106,31,0.08)', color: 'var(--h-text-dim)', fontSize: '0.86rem', lineHeight: 1.5 }}>
            <b style={{ color: 'var(--h-text)' }}>Quiet mode:</b> entries and video uploads are paused. The public date and restaurant are still TBD.
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
