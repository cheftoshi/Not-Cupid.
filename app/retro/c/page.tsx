export const dynamic = 'force-static';

// OPTION C — MBTA transit-map aesthetic. Line colors, station dots, route
// lines, clean Helvetica-ish system type on cream. Static mock.
const CREAM = '#f5f3ee', INK = '#1a1a1a', RED = '#da291c', BLUE = '#003da5', GREEN = '#00843d', ORANGE = '#ed8b00';
export default function RetroC() {
  return (
    <div style={{ minHeight: '100vh', background: CREAM, color: INK, fontFamily: "Helvetica, Arial, system-ui, sans-serif", position: 'relative', overflow: 'hidden' }}>
      {/* transit lines crossing the page */}
      <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 }}>
        <g fill="none" strokeWidth="8" strokeLinecap="round">
          <path d="M-50 150 L300 150 L450 300 L450 700" stroke={RED} />
          <path d="M-50 320 L500 320 L650 470 L1250 470" stroke={BLUE} />
          <path d="M120 -50 L120 400 L320 600 L320 850" stroke={GREEN} />
          <path d="M1250 200 L850 200 L700 350 L700 850" stroke={ORANGE} />
        </g>
        {/* station dots */}
        {[[300,150,RED],[450,300,RED],[500,320,BLUE],[650,470,BLUE],[120,400,GREEN],[320,600,GREEN],[850,200,ORANGE],[700,350,ORANGE]].map(([x,y,c],i)=>(
          <circle key={i} cx={x as number} cy={y as number} r="11" fill={CREAM} stroke={c as string} strokeWidth="5" />
        ))}
      </svg>

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 760, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: '1.1rem' }}>NotCupid</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6b6660' }}>greater boston transit of the heart</span>
        </div>

        <div style={{ marginTop: '4rem', background: 'rgba(245,243,238,0.82)', backdropFilter: 'blur(2px)', border: `3px solid ${INK}`, borderRadius: 16, padding: '2.5rem 2rem' }}>
          {/* line legend */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {[['LOVE LINE',RED],['FRIEND LINE',ORANGE]].map(([t,c])=>(
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', letterSpacing: '0.12em', background: '#fff', border: `2px solid ${INK}`, borderRadius: 999, padding: '0.25rem 0.7rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: c as string }} />{t}
              </span>
            ))}
          </div>
          <h1 style={{ fontSize: 'clamp(2.6rem,8vw,4.5rem)', lineHeight: 0.95, margin: 0, fontWeight: 800, letterSpacing: '-0.03em' }}>
            Find your<br /><span style={{ color: BLUE }}>next stop.</span>
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#4a463f', marginTop: '1.1rem', maxWidth: 440, lineHeight: 1.5 }}>
            two lines, one city. dates on the <span style={{ color: RED, fontWeight: 700 }}>love line</span>, friends on the <span style={{ color: ORANGE, fontWeight: 700 }}>friend line</span>. the algo routes you.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.75rem', flexWrap: 'wrap' }}>
            <span style={{ background: RED, color: '#fff', padding: '0.85rem 1.75rem', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.04em' }}>BOARD THE LOVE LINE →</span>
            <span style={{ background: ORANGE, color: '#fff', padding: '0.85rem 1.75rem', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.04em' }}>BOARD THE FRIEND LINE →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
