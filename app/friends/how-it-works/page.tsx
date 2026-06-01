import Link from 'next/link';

export const dynamic = 'force-static';
const INK = '#1a1410';

const STEPS = [
  { n: '1', emoji: '📝', title: 'take the find-a-friend quiz', body: "we already know your personality from your NotCupid profile — this quick round is about how you actually like to hang: your scene, your cadence, what you want to do." },
  { n: '2', emoji: '🤝', title: 'get matched with 5 of your vibe', body: 'the algo finds five people on your wavelength — shared interests, similar energy, same corner of greater boston. no swiping, no endless scroll.' },
  { n: '3', emoji: '🎒', title: 'lock in your crew', body: "say you're in. anyone you don't vibe with, just opt out — it's symmetric, no awkwardness. your accepted matches become your crew." },
  { n: '4', emoji: '💬', title: 'open the group chat', body: 'your crew shares one group thread to actually make plans. (this is the founding-member part — one-time $2.99, founding forever.)' },
  { n: '5', emoji: '📣', title: 'find the move', body: 'post what you want to do — "trivia thursday?", "anyone for the new A24 movie?" — and see what your city is up to, neighborhood by neighborhood.' },
];

export default function HowItWorks() {
  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 12% 18%,rgba(255,180,90,0.3),transparent 30%),radial-gradient(circle at 88% 8%,rgba(255,120,160,0.25),transparent 28%),linear-gradient(160deg,#fff3df,#ffe6c7 55%,#ffd9e0)', color: INK, fontFamily: 'ui-sans-serif,system-ui,sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', letterSpacing: '0.12em', color: '#d2530f' }}>FRIEND<span style={{ color: INK }}>MAXXIN</span></div>
          <Link href="/friends" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#d2530f', textDecoration: 'none' }}>my hub →</Link>
        </div>

        <div style={{ display: 'inline-block', fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#d2530f', background: '#fff', border: `2px solid ${INK}`, borderRadius: 999, padding: '0.35rem 0.9rem', transform: 'rotate(-2deg)', boxShadow: `3px 3px 0 ${INK}`, marginBottom: '1rem' }}>✦ how it works</div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.8rem,11vw,5rem)', lineHeight: 0.86, color: '#ff7a1f', WebkitTextStroke: `3px ${INK}`, textShadow: `5px 5px 0 rgba(26,20,16,0.18)`, margin: '0 0 0.5rem' }}>
          make friends,<br /><span style={{ color: '#ff3d77', WebkitTextStroke: `3px ${INK}` }}>not small talk.</span>
        </h1>
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#6b4a2f', fontSize: '1.05rem', margin: '0 0 2rem' }}>
          boston&apos;s friendship algorithm. five people your speed, a group chat, and a city full of plans.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ background: '#fff', border: `3px solid ${INK}`, borderRadius: 20, boxShadow: `5px 5px 0 rgba(26,20,16,0.85)`, padding: '1.1rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.2rem', color: '#ff7a1f', WebkitTextStroke: `1.5px ${INK}`, lineHeight: 1, flexShrink: 0 }}>{s.n}</div>
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem', letterSpacing: '0.02em' }}>{s.emoji} {s.title}</div>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.92rem', lineHeight: 1.55, color: '#3a2c20' }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fffaf0', border: `3px dashed rgba(26,20,16,0.4)`, borderRadius: 18, padding: '1.25rem', margin: '1.75rem 0', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem' }}>✦ founding member · $2.99</div>
          <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#6b4a2f', margin: '0.4rem 0 0', fontSize: '0.9rem' }}>
            free for 7 days to match + explore. the group chat is founding-only — one-time $2.99, yours forever, no subscription.
          </p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link href="/friends" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.05em', color: '#fff', background: 'linear-gradient(135deg,#ff7a1f,#ff3d77)', border: `3px solid ${INK}`, borderRadius: 16, padding: '0.8rem 2rem', boxShadow: `5px 5px 0 ${INK}`, textDecoration: 'none', display: 'inline-block' }}>
            find my crew →
          </Link>
        </div>
      </div>
    </div>
  );
}
