export const dynamic = 'force-static';

// MOCK B — "transit-card deck": crew as horizontal swipeable line cards on a
// route, chat below as a full-width 'platform'. Punchier type, ticket aesthetic.
const INK = '#241d12', LINE = '#e8842b', DEEP = '#c96a18', GREEN = '#3f7d57', CREAM = '#f7f1e3', GOLD = '#ffce4d';
const CREW = [
  { name: 'Ayan', age: 22, score: 88, img: 'https://i.pravatar.cc/300?img=12', tags: ['outdoors', 'gaming'], live: true },
  { name: 'Madeline', age: 30, score: 84, img: 'https://i.pravatar.cc/300?img=45', tags: ['food', 'gaming'], live: true },
  { name: 'Priya', age: 27, score: 80, img: 'https://i.pravatar.cc/300?img=5', tags: ['art', 'coffee'], live: false },
];
const MSGS = [
  { who: 'Ayan', img: 'https://i.pravatar.cc/80?img=12', t: 'trivia at trident thursday?? 🍻', me: false },
  { who: 'you', img: '', t: 'iiii am so in', me: true },
  { who: 'Madeline', img: 'https://i.pravatar.cc/80?img=45', t: 'down. i carry the music round', me: false },
];

export default function MockB() {
  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(170deg, ${CREAM}, #f3e7cf 60%, #f7ddc0)`, color: INK, fontFamily: 'ui-sans-serif,system-ui,sans-serif', padding: '1.5rem 1.25rem 4rem' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: DEEP, marginBottom: '0.5rem' }}>mock B · transit-card deck</div>
        <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(2.6rem,8vw,4rem)', lineHeight: 0.85, color: GREEN, WebkitTextStroke: `2px ${INK}`, textShadow: `5px 5px 0 ${LINE}`, margin: '0 0 0.3rem' }}>YOUR CREW.</h1>
        <p style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', color: DEEP, margin: '0 0 1.25rem' }}>3 stops on your line — swipe through, then hit the platform chat.</p>

        {/* horizontal ticket cards on a route line */}
        <div style={{ position: 'relative', paddingTop: 18 }}>
          <div style={{ position: 'absolute', top: 8, left: 0, right: 0, height: 5, background: LINE, borderRadius: 999 }} />
          <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {CREW.map((c) => (
              <div key={c.name} style={{ flex: '0 0 200px', position: 'relative' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: CREAM, border: `4px solid ${LINE}`, margin: '0 auto -7px', position: 'relative', zIndex: 2 }} />
                <div style={{ background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 16, boxShadow: `5px 5px 0 ${INK}`, overflow: 'hidden' }}>
                  <img src={c.img} alt="" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderBottom: `3px solid ${INK}` }} />
                  <div style={{ padding: '0.6rem 0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.3rem' }}>{c.name} · {c.age}</span>
                      <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1rem', color: DEEP }}>{c.score}%</span>
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: c.live ? GREEN : DEEP }}>● {c.live ? 'in your crew' : 'waiting'}</div>
                    <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                      {c.tags.map((t) => <span key={t} style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.52rem', background: '#fbe6cf', border: `2px solid ${INK}`, borderRadius: 999, padding: '0.12rem 0.45rem' }}>{t}</span>)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* full-width platform chat */}
        <div style={{ marginTop: '1.75rem', background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 18, boxShadow: `6px 6px 0 ${INK}`, overflow: 'hidden' }}>
          <div style={{ background: LINE, color: '#fff', padding: '0.75rem 1.1rem', fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.3rem', borderBottom: `3px solid ${INK}`, display: 'flex', justifyContent: 'space-between' }}>
            <span>💬 the platform · crew chat</span><span style={{ fontSize: '0.9rem' }}>3 aboard</span>
          </div>
          <div style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {MSGS.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: m.me ? 'row-reverse' : 'row', gap: '0.5rem', alignItems: 'flex-end' }}>
                {m.img ? <img src={m.img} alt="" style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${INK}` }} /> : <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${INK}`, background: GOLD }} />}
                <div style={{ background: m.me ? GOLD : '#fbe6cf', border: `2px solid ${INK}`, borderRadius: 14, padding: '0.45rem 0.7rem', fontSize: '0.88rem', maxWidth: 420 }}>{m.t}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.8rem 1.1rem', borderTop: `3px dashed rgba(36,29,18,0.25)` }}>
            <input placeholder="say something to the crew…" readOnly style={{ flex: 1, border: `2.5px solid ${INK}`, borderRadius: 999, padding: '0.5rem 1rem', fontSize: '0.85rem' }} />
            <button style={{ background: LINE, color: '#fff', border: `3px solid ${INK}`, borderRadius: 999, padding: '0 1.1rem', fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.1rem', cursor: 'pointer' }}>→</button>
          </div>
        </div>
      </div>
    </div>
  );
}
