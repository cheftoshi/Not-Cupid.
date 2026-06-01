export const dynamic = 'force-static';

// OPTION A — Vintage travel-poster / WPA Boston. Muted screen-print palette,
// halftone sky, skyline silhouette, old-postcard framing. Static mock.
const CREAM = '#f0e6d2', INK = '#26211a', RUST = '#b5532a', TEAL = '#2f6b66', MUST = '#caa23c';
export default function RetroA() {
  return (
    <div style={{ minHeight: '100vh', background: '#e9dcc0', color: INK, fontFamily: "Georgia, 'Times New Roman', serif", position: 'relative', overflow: 'hidden' }}>
      {/* halftone wash */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.12, backgroundImage: 'radial-gradient(#26211a 1px, transparent 1.4px)', backgroundSize: '7px 7px', pointerEvents: 'none' }} />
      {/* sun */}
      <div style={{ position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, #e6a23c 0%, #d98730 70%, transparent 72%)', opacity: 0.85 }} />
      {/* skyline silhouette */}
      <svg viewBox="0 0 1200 200" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 200, display: 'block' }}>
        <g fill={TEAL} opacity="0.9">
          <rect x="60" y="90" width="50" height="110" /><rect x="130" y="60" width="36" height="140" /><polygon points="166,60 184,30 202,60" />
          <rect x="240" y="110" width="70" height="90" /><rect x="340" y="40" width="44" height="160" /><rect x="384" y="70" width="30" height="130" />
          <rect x="470" y="100" width="60" height="100" /><rect x="560" y="55" width="40" height="145" />
          {/* Citgo-ish sign block */}
          <rect x="650" y="80" width="80" height="120" /><rect x="672" y="60" width="36" height="22" fill={RUST} />
          <rect x="780" y="105" width="64" height="95" /><rect x="870" y="45" width="46" height="155" /><polygon points="916,45 939,18 962,45" />
          <rect x="1010" y="95" width="70" height="105" /><rect x="1100" y="65" width="40" height="135" />
        </g>
      </svg>

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 760, margin: '0 auto', padding: '2rem 1.5rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: RUST }}>
          <span>NotCupid</span><span>est. Boston</span>
        </div>
        <div style={{ marginTop: '3rem', border: `3px double ${INK}`, padding: '2.5rem 1.5rem', background: 'rgba(240,230,210,0.55)' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: TEAL, marginBottom: '1rem' }}>greetings from</div>
          <h1 style={{ fontSize: 'clamp(3rem,9vw,5.5rem)', lineHeight: 0.95, margin: 0, fontWeight: 900, letterSpacing: '-0.02em', color: RUST, textShadow: `2px 2px 0 ${MUST}` }}>
            BOSTON&apos;S<br /><span style={{ fontStyle: 'italic', color: TEAL }}>date experiment</span>
          </h1>
          <p style={{ fontStyle: 'italic', fontSize: '1.05rem', color: '#5c4a36', margin: '1.25rem auto 0', maxWidth: 420 }}>
            one match. no swiping. built on personality, the old-fashioned way.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.75rem', flexWrap: 'wrap' }}>
            <span style={{ background: RUST, color: CREAM, padding: '0.8rem 1.6rem', fontFamily: "'DM Mono',monospace", fontSize: '0.7rem', letterSpacing: '0.16em', textTransform: 'uppercase', border: `2px solid ${INK}` }}>take the quiz →</span>
            <span style={{ background: 'transparent', color: TEAL, padding: '0.8rem 1.6rem', fontFamily: "'DM Mono',monospace", fontSize: '0.7rem', letterSpacing: '0.16em', textTransform: 'uppercase', border: `2px solid ${TEAL}` }}>i have an account</span>
          </div>
        </div>
      </div>
    </div>
  );
}
