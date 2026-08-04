import { ImageResponse } from 'next/og';

// Share card for /p/<id> — what unfurls when someone drops a plan link in a
// group chat. Kept generic (no DB fetch at the edge): the page title metadata
// already carries the plan's specifics.
export const alt = 'A plan on NotCupid';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fff6ee 0%, #ffe9d6 55%, #eef2ff 100%)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 54, display: 'flex', fontSize: 26, letterSpacing: 8, textTransform: 'uppercase', color: '#d2530f', fontWeight: 600 }}>🧡 A PLAN ON THE FRIEND LINE</div>
        <div style={{ display: 'flex', fontSize: 88, fontStyle: 'italic', fontWeight: 700, color: '#0b0b0b', textAlign: 'center', padding: '0 90px', lineHeight: 1.08 }}>
          you&apos;re invited to something real.
        </div>
        <div style={{ display: 'flex', marginTop: 28, fontSize: 30, color: '#6b6975' }}>join to rsvp — real plans with real people, no swiping</div>
        <div style={{ position: 'absolute', bottom: 48, display: 'flex', alignItems: 'center', gap: 14, fontSize: 28, color: '#6b6975' }}>
          <span style={{ color: '#2563ff', fontWeight: 700 }}>Not</span>
          <span style={{ color: '#ff6a1f', fontWeight: 700, marginLeft: -12 }}>Cupid</span>
          <span>· notcupid.com</span>
        </div>
      </div>
    ),
    size
  );
}
