import Link from 'next/link';
import CorpFooter from '@/components/corp-footer';

export const dynamic = 'force-static';

// FAQ — linked from the landing header. Same palette/voice as /how-it-works.
const INK = '#0a0a0a';
const BLUE = '#2563ff';
const BLUE_DEEP = '#1b46c9';
const ORANGE = '#ff6a1f';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is NotCupid?',
    a: 'The anti–dating-app. No swiping, no scrolling a catalog of strangers. You take a short personality quiz, the algorithm curates a small roster of your most compatible people, and you choose who to meet. Two lines: Love (dating) and Friend (platonic crews).',
  },
  {
    q: 'How does the matching actually work?',
    a: 'A personality quiz — HEXACO traits, your attachment style, what you value, and a rapid-fire round — powers it. We score real compatibility on who you are and what you want, not photos or a swipe count, then hand you a curated roster. You pick. You can run up to two conversations at once.',
  },
  {
    q: 'No swiping — really?',
    a: 'Really. Endless swiping is what burns people out and turns dating into a numbers game. We show you a few people who actually fit and let you choose. That’s the whole point.',
  },
  {
    q: 'Is it free?',
    a: 'The quiz and your matches are free. On the Love Line, unlock a match’s full profile — bio, gallery and personality — for a one-time $0.99. On the Friend Line, your first friendship pack (up to 10 friends) is free; more packs are $1.99 each, and group chats are always free. Want everything? Pro is $3.99/mo — every love unlock, unlimited packs, and events.',
  },
  {
    q: 'Where is NotCupid available?',
    a: 'Born in Boston, now open across all of New England plus the New York City metro. Matching stays local — within a range you control — so you can actually meet up.',
  },
  {
    q: 'What’s the Friend Line?',
    a: 'The platonic side, same personality engine. It’s for finding your people — small crews, a group chat, and a board of real plans and events happening around the city.',
  },
  {
    q: 'What’s the quiz like?',
    a: 'About four minutes, chaptered like an experience: who you are (personality), the day-to-day (lifestyle), and a rapid-fire round. No photos, no performing — the algorithm clocks when you’re not being honest.',
  },
  {
    q: 'Can I do both Love and Friend?',
    a: 'Yes. Your core quiz powers both lines — board whichever you want, or both.',
  },
  {
    q: 'What if I don’t respond to my matches?',
    a: 'Please do — someone chose you. If you keep letting matches expire without ever responding, we’ll quietly pause you from new rosters until you re-engage; accepting any match brings you straight back. It keeps the pool fair for the people who actually show up — silence wastes more of someone’s time than an honest no.',
  },
  {
    q: 'How do you keep things safe?',
    a: 'You can block and report anyone, we never show your exact location (just a fuzzy metro and distance band), and date-safety tips are built into your matches. People who repeatedly ghost get paused.',
  },
  {
    q: 'How do I install the app — and turn on notifications?',
    a: 'NotCupid runs in your browser, but you can install it like a real app. On iPhone: open notcupid.com in Safari, tap the Share icon (the square with an arrow), scroll to “Add to Home Screen,” then open NotCupid from your Home Screen. On Android / desktop Chrome: tap “install the app” when the prompt appears, or use the browser menu → Install. Notifications: Android and desktop can turn them on right in the browser, but iPhone only allows notifications once you’ve installed the app to your Home Screen (iOS 16.4+) — they don’t work in the Safari tab. So on iPhone: install first, open the app from your Home Screen, then tap “🔔 get pinged when you match.” A native App Store version is on the way.',
  },
  {
    q: 'How do I delete my account?',
    a: 'From your profile settings, any time — full account deletion, no hoops.',
  },
];

export default function FAQ() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--h-bg)', color: 'var(--h-text)', fontFamily: 'ui-sans-serif,system-ui,sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.15rem', color: BLUE }}>not<span style={{ color: ORANGE }}>cupid</span></span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--h-accent)' }}>faq</span>
          </div>
          <Link href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--h-accent)', textDecoration: 'none' }}>← back</Link>
        </div>

        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginBottom: '0.6rem' }}>a connection experiment</div>
        <h1 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: 'clamp(2.6rem,9vw,3.8rem)', lineHeight: 1, color: 'var(--h-text)', margin: '0 0 0.5rem' }}>
          questions? <span style={{ color: BLUE }}>answers.</span>
        </h1>
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', fontSize: '1.05rem', margin: '0 0 2rem' }}>
          everything you’d want to know before you sign up.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {FAQS.map((f) => (
            <div key={f.q} style={{ background: 'var(--h-surface)', border: '1px solid rgba(37,99,255,0.18)', borderRadius: 16, boxShadow: '0 10px 30px -22px rgba(27,70,201,0.45)', padding: '1.1rem 1.25rem' }}>
              <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.2rem', color: 'var(--h-text)', marginBottom: '0.35rem' }}>{f.q}</div>
              <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--h-text-dim)' }}>{f.a}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <Link href="/how-it-works" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--h-accent)', textDecoration: 'none', borderBottom: `1px dashed ${BLUE}`, paddingBottom: '0.15rem' }}>
            still curious? see how it works →
          </Link>
          <Link href="/quiz" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.05em', color: '#fff', background: INK, border: 'none', borderRadius: 14, padding: '0.8rem 2rem', boxShadow: '0 14px 30px -12px rgba(0,0,0,0.5)', textDecoration: 'none', display: 'inline-block' }}>
            get started →
          </Link>
        </div>
      </div>
      <CorpFooter />
    </div>
  );
}
