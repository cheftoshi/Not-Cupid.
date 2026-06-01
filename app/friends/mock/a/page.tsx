export const dynamic = 'force-static';

// MOCK A — "bold blocks": punchy color, two-column (crew main + chat rail),
// chunky cards with photo-forward framing + match ring. Static sample.
const INK = '#241d12', LINE = '#e8842b', DEEP = '#c96a18', GREEN = '#3f7d57', CREAM = '#f7f1e3', GOLD = '#ffce4d';
const CREW = [
  { name: 'Ayan', age: 22, score: 88, img: 'https://i.pravatar.cc/300?img=12', tags: ['outdoors', 'gaming', 'food'], status: 'in your crew' },
  { name: 'Madeline', age: 30, score: 84, img: 'https://i.pravatar.cc/300?img=45', tags: ['food', 'gaming'], status: 'in your crew' },
  { name: 'Priya', age: 27, score: 80, img: 'https://i.pravatar.cc/300?img=5', tags: ['art', 'coffee'], status: 'waiting on them' },
];
const MSGS = [
  { who: 'Ayan', img: 'https://i.pravatar.cc/80?img=12', t: 'trivia at trident thursday?? 🍻', me: false },
  { who: 'you', img: '', t: 'iiii am so in', me: true },
  { who: 'Madeline', img: 'https://i.pravatar.cc/80?img=45', t: 'down. i carry the music round', me: false },
];

export default function MockA() {
  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(170deg, ${CREAM}, #f3e7cf 60%, #f7ddc0)`, color: INK, fontFamily: 'ui-sans-serif,system-ui,sans-serif', padding: '1.5rem 1.25rem 4rem' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: DEEP, marginBottom: '0.5rem' }}>mock A · bold blocks</div>
        <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(2.6rem,8vw,4rem)', lineHeight: 0.85, color: LINE, WebkitTextStroke: `2px ${INK}`, textShadow: `5px 5px 0 ${GREEN}`, margin: 0 }}>YOUR CREW.</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.25rem', alignItems: 'start', marginTop: '1.5rem' }}>
          {/* crew main */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '1rem' }}>
            {CREW.map((c) => (
              <div key={c.name} style={{ background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 18, boxShadow: `6px 6px 0 ${INK}`, overflow: 'hidden' }}>
                <div style={{ position: 'relative' }}>
                  <img src={c.img} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', borderBottom: `3px solid ${INK}` }} />
                  <span style={{ position: 'absolute', top: 8, left: 8, background: GOLD, border: `2.5px solid ${INK}`, borderRadius: 999, padding: '0.1rem 0.5rem', fontFamily: "'Bebas Neue',sans-serif", fontSize: '1rem', transform: 'rotate(-6deg)', boxShadow: `2px 2px 0 ${INK}` }}>{c.score}%</span>
                </div>
                <div style={{ padding: '0.7rem 0.8rem' }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.4rem' }}>{c.name} <span style={{ color: DEEP, fontSize: '0.85rem' }}>· {c.age}</span></div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: c.status === 'in your crew' ? GREEN : DEEP, marginBottom: '0.4rem' }}>● {c.status}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {c.tags.map((t) => <span key={t} style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.55rem', background: '#fbe6cf', border: `2px solid ${INK}`, borderRadius: 999, padding: '0.15rem 0.5rem' }}>{t}</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* chat rail — ALWAYS shown */}
          <div style={{ background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 18, boxShadow: `6px 6px 0 ${INK}`, overflow: 'hidden', position: 'sticky', top: '1rem' }}>
            <div style={{ background: LINE, color: '#fff', padding: '0.7rem 1rem', fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.2rem', borderBottom: `3px solid ${INK}` }}>💬 crew chat · 3</div>
            <div style={{ padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {MSGS.map((m, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: m.me ? 'row-reverse' : 'row', gap: '0.45rem', alignItems: 'flex-end' }}>
                  {m.img ? <img src={m.img} alt="" style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${INK}` }} /> : <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${INK}`, background: GOLD }} />}
                  <div style={{ background: m.me ? GOLD : '#fbe6cf', border: `2px solid ${INK}`, borderRadius: 12, padding: '0.4rem 0.6rem', fontSize: '0.82rem', maxWidth: 200 }}>{m.t}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', padding: '0.7rem', borderTop: `3px dashed rgba(36,29,18,0.25)` }}>
              <input placeholder="say something…" readOnly style={{ flex: 1, border: `2px solid ${INK}`, borderRadius: 999, padding: '0.4rem 0.7rem', fontSize: '0.8rem' }} />
              <button style={{ background: LINE, color: '#fff', border: `2px solid ${INK}`, borderRadius: 999, padding: '0 0.8rem', fontFamily: "'Bebas Neue',sans-serif", cursor: 'pointer' }}>→</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
