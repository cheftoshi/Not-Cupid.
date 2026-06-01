import Link from 'next/link';

export const dynamic = 'force-static';
const INK = '#241d12';
const LINE = '#e8842b';
const LINE_DEEP = '#c96a18';
const CREAM = '#f7f1e3';

const STEPS = [
  { n: '1', emoji: '📝', title: 'take a quick friend quiz', body: "a few questions about how you actually like to hang — your scene, your cadence, what you want to do. that's the only step on your end. the algo does the rest." },
  { n: '2', emoji: '🤝', title: 'get clustered into a crew', body: 'behind the scenes we route you into a friend group of people on your wavelength — shared interests, similar energy, same corner of greater boston. no swiping, no endless scroll.' },
  { n: '3', emoji: '🎒', title: 'lock it in — or opt out', body: "say you're in. not feeling the group? opt out of the whole crew in one tap — it's symmetric, no awkward one-on-one rejections. there's no picking people off." },
  { n: '4', emoji: '💬', title: 'open the group chat', body: "your crew shares one thread to make plans. your first crew is free, forever — and if it never fully comes together, that free slot just stays open for your next one. extra crews are a one-time $0.99." },
  { n: '5', emoji: '📣', title: 'ride the scene', body: 'post what you want to do — "trivia thursday?", "anyone for the new A24 movie?" — RSVP to events, and see which neighborhoods are buzzing.' },
];

export default function HowItWorks() {
  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(170deg, ${CREAM} 0%, #f3e7cf 60%, #f7ddc0 100%)`, color: INK, fontFamily: 'ui-sans-serif,system-ui,sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ background: LINE, color: '#fff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.95rem', letterSpacing: '0.1em', padding: '0.15rem 0.6rem', borderRadius: 6, border: `2px solid ${INK}` }}>FRIEND LINE</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: LINE_DEEP }}>route map</span>
          </div>
          <Link href="/friends" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: LINE_DEEP, textDecoration: 'none' }}>my hub →</Link>
        </div>

        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.8rem,11vw,5rem)', lineHeight: 0.86, color: LINE, WebkitTextStroke: `3px ${INK}`, textShadow: `5px 5px 0 rgba(36,29,18,0.18)`, margin: '0 0 0.5rem' }}>
          find your<br /><span style={{ color: '#3f7d57', WebkitTextStroke: `3px ${INK}` }}>next friend.</span>
        </h1>
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: LINE_DEEP, fontSize: '1.05rem', margin: '0 0 2rem' }}>
          five stops to your crew. no swiping, no small talk — the algo routes you.
        </p>

        {/* the line runs down the left of the stops */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 26, top: 24, bottom: 24, width: 5, background: LINE, borderRadius: 999, zIndex: 0 }} />
          {STEPS.map((s) => (
            <div key={s.n} style={{ position: 'relative', zIndex: 1, background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 16, boxShadow: `5px 5px 0 ${INK}`, padding: '1.1rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: CREAM, border: `4px solid ${LINE}`, color: INK, fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0 }}>{s.n}</div>
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem', letterSpacing: '0.02em' }}>{s.emoji} {s.title}</div>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.92rem', lineHeight: 1.55, color: '#3a2c20' }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fffaf0', border: `3px dashed ${LINE}`, borderRadius: 16, padding: '1.25rem', margin: '1.75rem 0', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem' }}>🎟️ your fare</div>
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: LINE_DEEP, margin: '0.4rem 0 0', fontSize: '0.9rem' }}>
your first crew is <b>free, forever</b> — and if it never fully forms, that free slot waits for the next one. each extra crew is a one-time <b>$0.99</b> — no subscription, no catch.
          </p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link href="/friends" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.05em', color: '#fff', background: LINE, border: `3px solid ${INK}`, borderRadius: 14, padding: '0.8rem 2rem', boxShadow: `5px 5px 0 ${INK}`, textDecoration: 'none', display: 'inline-block' }}>
            board the friend line →
          </Link>
        </div>
      </div>
    </div>
  );
}
