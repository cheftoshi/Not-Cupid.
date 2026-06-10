import { ImageResponse } from 'next/og';

// Branded 1200×630 share card — what renders when a NotCupid link is dropped in
// Reddit / iMessage / socials. Generated at the edge, no image asset to ship.
export const runtime = 'edge';
export const alt = "NotCupid — A Connection Experiment";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f6f6f6',
          backgroundImage:
            'radial-gradient(60% 50% at 22% 18%, rgba(37,99,255,0.14), transparent 60%), radial-gradient(60% 50% at 80% 84%, rgba(255,106,31,0.16), transparent 60%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 150, fontWeight: 800, letterSpacing: -3 }}>
          <span style={{ color: '#2563ff' }}>Not</span>
          <span style={{ color: '#ff6a1f' }}>Cupid</span>
        </div>
        <div style={{ fontSize: 50, fontWeight: 600, color: '#0b0b0b', marginTop: 6 }}>
          Meet people. Not profiles.
        </div>
        <div style={{ fontSize: 26, color: '#6b6b76', marginTop: 30, letterSpacing: 6 }}>
          A CONNECTION EXPERIMENT · NEW ENGLAND + NYC
        </div>
      </div>
    ),
    { ...size },
  );
}
