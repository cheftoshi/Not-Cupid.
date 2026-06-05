import Link from 'next/link';

export const dynamic = 'force-static';

// Love Line "how it works" — mirror of /friends/how-it-works, in the dating
// palette (blue, Georgia italic). Personality-first dating, no swiping.
const INK = '#0a0a0a';
const BLUE = '#2563ff';
const BLUE_DEEP = '#1b46c9';
const LAV = '#e8edff';

const STEPS = [
  { n: '1', emoji: '📝', title: 'take the quiz', body: "24 personality questions + a few lifestyle vibes — your chronotype, how you date, what you're after. ~5 minutes, and Boston-flavored." },
  { n: '2', emoji: '🧠', title: 'the algo reads you', body: 'we score real compatibility on who you actually are — HEXACO personality + how you live — not photos, hot-takes, or a swipe count.' },
  { n: '3', emoji: '💘', title: 'meet your match', body: 'your most compatible person in greater boston, one at a time. no swiping, no endless feed — just someone worth the first message.' },
  { n: '4', emoji: '💬', title: 'say hi', body: "a real chat (lead with more than “hey” — we'll gently roast you if you don't). want the full picture? unlock their bio, interests & HEXACO for a one-time $1.99." },
  { n: '5', emoji: '✦', title: 'set your date vibes', body: "tap the things you'd actually do together — when you both pick the same one, it locks in. then get off the app and onto the date." },
];

export default function LoveHowItWorks() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f6f6f6 0%, #eef1ff 100%)', color: INK, fontFamily: 'ui-sans-serif,system-ui,sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ background: BLUE, color: '#fff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.95rem', letterSpacing: '0.1em', padding: '0.15rem 0.6rem', borderRadius: 6 }}>LOVE LINE</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: BLUE_DEEP }}>how it works</span>
          </div>
          <Link href="/hub" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: BLUE_DEEP, textDecoration: 'none' }}>← back to hub</Link>
        </div>

        <h1 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: 'clamp(2.6rem,9vw,3.8rem)', lineHeight: 1, color: INK, margin: '0 0 0.5rem' }}>
          find your <span style={{ color: BLUE }}>person.</span>
        </h1>
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#6b6975', fontSize: '1.05rem', margin: '0 0 2rem' }}>
          personality first, no swiping — the algo does the heavy lifting.
        </p>

        {/* the line runs down the left of the stops */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 26, top: 24, bottom: 24, width: 4, background: LAV, borderRadius: 999, zIndex: 0 }} />
          {STEPS.map((s) => (
            <div key={s.n} style={{ position: 'relative', zIndex: 1, background: '#fff', border: '1px solid rgba(37,99,255,0.18)', borderRadius: 16, boxShadow: '0 10px 30px -20px rgba(27,70,201,0.45)', padding: '1.1rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: LAV, border: `3px solid ${BLUE}`, color: BLUE_DEEP, fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0 }}>{s.n}</div>
              <div>
                <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '1.3rem' }}>{s.emoji} {s.title}</div>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.92rem', lineHeight: 1.55, color: '#4a4754' }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', border: `2px dashed ${BLUE}`, borderRadius: 16, padding: '1.25rem', margin: '1.75rem 0', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem' }}>🎟️ your fare</div>
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: BLUE_DEEP, margin: '0.4rem 0 0', fontSize: '0.9rem' }}>
            the quiz and your match are <b>free</b>. when you want the full picture on someone, unlock their profile — bio, interests &amp; HEXACO — for a one-time <b>$1.99</b>. no subscription, no swiping.
          </p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link href="/quiz" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.05em', color: '#fff', background: BLUE, border: 'none', borderRadius: 14, padding: '0.8rem 2rem', boxShadow: '0 14px 30px -12px rgba(27,70,201,0.6)', textDecoration: 'none', display: 'inline-block' }}>
            take the quiz →
          </Link>
        </div>
      </div>
    </div>
  );
}
