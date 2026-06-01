export const dynamic = 'force-static';

// OPTION B — 70s/80s analog. Sunburst color-blocks, heavy grain, chunky
// condensed type, retro pill buttons. Static mock.
const BG = '#1f1a2e', CREAM = '#f4e9d8', ORANGE = '#ff7a3d', PINK = '#ff5d8f', GOLD = '#ffc24b', TEAL = '#3fb8af';
export default function RetroB() {
  return (
    <div style={{ minHeight: '100vh', background: BG, color: CREAM, fontFamily: "'Bebas Neue', sans-serif", position: 'relative', overflow: 'hidden' }}>
      {/* retro sun-rays */}
      <div style={{ position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)', width: 900, height: 900, background: `conic-gradient(${ORANGE} 0 12deg, transparent 12deg 24deg, ${GOLD} 24deg 36deg, transparent 36deg 48deg)`, opacity: 0.18, borderRadius: '50%' }} />
      {/* sunset bands */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 180 }}>
        {[ORANGE, PINK, GOLD, TEAL].map((c, i) => <div key={c} style={{ height: 45, background: c, opacity: 0.85 - i * 0.12 }} />)}
      </div>
      {/* grain */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 760, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: GOLD }}>
          <span>NOTCUPID</span><span>★ boston ★</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: '3.5rem' }}>
          <span style={{ display: 'inline-block', background: PINK, color: BG, padding: '0.3rem 1rem', fontSize: '1rem', letterSpacing: '0.2em', transform: 'rotate(-3deg)', border: `2px solid ${CREAM}` }}>BOSTON&apos;S SOCIAL EXPERIMENT</span>
          <h1 style={{ fontSize: 'clamp(4rem,16vw,9rem)', lineHeight: 0.82, margin: '1.25rem 0 0', letterSpacing: '0.02em' }}>
            <span style={{ color: GOLD, textShadow: `4px 4px 0 ${ORANGE}` }}>MEET</span>{' '}
            <span style={{ color: TEAL, textShadow: `4px 4px 0 ${BG}` }}>PEOPLE.</span><br />
            <span style={{ color: PINK, fontStyle: 'italic', textShadow: `4px 4px 0 ${BG}` }}>NOT PROFILES.</span>
          </h1>
          <p style={{ fontFamily: "Georgia,serif", fontStyle: 'italic', fontSize: '1.1rem', color: CREAM, opacity: 0.85, marginTop: '1.25rem' }}>
            two algorithms. one city. zero swiping.
          </p>
          <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', marginTop: '2rem', flexWrap: 'wrap' }}>
            <span style={{ background: `linear-gradient(135deg,${ORANGE},${PINK})`, color: BG, padding: '0.9rem 2rem', borderRadius: 999, fontSize: '1.3rem', letterSpacing: '0.06em', border: `3px solid ${CREAM}`, boxShadow: `4px 4px 0 ${CREAM}` }}>SIGN UP →</span>
            <span style={{ background: 'transparent', color: GOLD, padding: '0.9rem 2rem', borderRadius: 999, fontSize: '1.3rem', letterSpacing: '0.06em', border: `3px solid ${GOLD}` }}>LOG IN</span>
          </div>
        </div>
      </div>
    </div>
  );
}
