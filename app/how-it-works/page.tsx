import Link from 'next/link';

export const dynamic = 'force-static';

// "How NotCupid works" — the overall app flow (linked from the landing page).
// Covers the shared core quiz + the two lines (Love = blue, Friend = orange).
const INK = '#0a0a0a';
const BLUE = '#2563ff';
const BLUE_DEEP = '#1b46c9';
const LAV = '#e8edff';
const ORANGE = '#ff6a1f';
const ORANGE_DEEP = '#d2530f';

const STEPS = [
  { n: '1', emoji: '📝', title: 'sign up', body: 'name, email, a 6-digit code to prove it’s you. born in Boston, now open across the Northeast — all of New England, the NYC metro, and North Jersey.' },
  { n: '2', emoji: '🧠', title: 'take the core quiz', body: 'a short, chaptered run — who you are (personality), the day-to-day (lifestyle), and a rapid-fire round. ~4 minutes, no photos, no performing.' },
  { n: '3', emoji: '🚉', title: 'pick your line', body: 'board the Love Line (dating), the Friend Line (platonic crews), or both. your core quiz powers both sides.' },
  { n: '4', emoji: '🎯', title: 'go a little deeper', body: 'each line asks a few questions of its own — Love: what you want in a partner, how you connect, what matters. Friend: how you like to hang. that’s what the matching actually weighs.' },
  { n: '5', emoji: '💘', title: 'meet people, not profiles', body: 'the algo curates a small roster of your most compatible people. you pick. no swiping, no endless feed — just someone worth the first message.' },
];

export default function HowItWorks() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f6f6f6 0%, #eef1ff 100%)', color: INK, fontFamily: 'ui-sans-serif,system-ui,sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.15rem', color: BLUE }}>not<span style={{ color: ORANGE }}>cupid</span></span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: BLUE_DEEP }}>how it works</span>
          </div>
          <Link href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: BLUE_DEEP, textDecoration: 'none' }}>← back</Link>
        </div>

        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#6b6975', marginBottom: '0.6rem' }}>a connection experiment</div>
        <h1 style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: 'clamp(2.6rem,9vw,3.8rem)', lineHeight: 1, color: INK, margin: '0 0 0.5rem' }}>
          meet people. <span style={{ color: BLUE }}>not profiles.</span>
        </h1>
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#6b6975', fontSize: '1.05rem', margin: '0 0 2rem' }}>
          one quiz, two lines, real connection — the algo does the heavy lifting.
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

        {/* the two lines */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', margin: '1.75rem 0' }}>
          <div style={{ background: '#fff', border: `1.5px solid ${BLUE}`, borderRadius: 16, padding: '1.1rem 1.15rem' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', letterSpacing: '0.02em', color: BLUE_DEEP }}>💘 love line</div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', lineHeight: 1.5, color: '#4a4754' }}>pick from your 5 most compatible. personality-first dating, no swiping.</p>
          </div>
          <div style={{ background: '#fff', border: `1.5px solid ${ORANGE}`, borderRadius: 16, padding: '1.1rem 1.15rem' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', letterSpacing: '0.02em', color: ORANGE_DEEP }}>🧡 friend line</div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', lineHeight: 1.5, color: '#4a4754' }}>open <b>friendship packs</b> — up to 10 friends each, a group chat, and a city full of plans.</p>
          </div>
        </div>

        <div style={{ background: '#fff', border: `2px dashed ${BLUE}`, borderRadius: 16, padding: '1.25rem', margin: '0 0 1.75rem', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem' }}>🎟️ your fare</div>
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: BLUE_DEEP, margin: '0.4rem 0 0', fontSize: '0.9rem' }}>
            the quiz and your matches are <b>free</b>. on Love, unlock a match’s full profile for a one-time <b>$0.99</b>. on Friend, your first <b>friendship pack</b> (up to 10 friends) is free — more packs are <b>$1.99</b> each, and group chats are always free.
          </p>
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: ORANGE_DEEP, margin: '0.6rem 0 0', fontSize: '0.9rem' }}>
            or go <b>All-Access</b> — every love unlock, unlimited friendship packs, and events, all for <b>$3.99/mo</b>. no swiping, ever.
          </p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link href="/quiz" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.05em', color: '#fff', background: INK, border: 'none', borderRadius: 14, padding: '0.8rem 2rem', boxShadow: '0 14px 30px -12px rgba(0,0,0,0.5)', textDecoration: 'none', display: 'inline-block' }}>
            get started →
          </Link>
        </div>
      </div>
    </div>
  );
}
