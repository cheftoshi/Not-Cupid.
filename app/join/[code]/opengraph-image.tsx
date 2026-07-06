import { ImageResponse } from 'next/og';

// Share card for /join/<code> — the invite link's unfurl. Generic on purpose
// (no DB fetch at the edge; the page metadata handles specifics).
export const runtime = 'edge';
export const alt = 'You’re invited to NotCupid';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #eef2ff 0%, #f6f6f6 50%, #fff1e8 100%)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 54, display: 'flex', fontSize: 26, letterSpacing: 8, textTransform: 'uppercase', color: '#2563ff', fontWeight: 600 }}>✦ YOU&apos;RE INVITED</div>
        <div style={{ display: 'flex', fontSize: 92, fontStyle: 'italic', fontWeight: 700, color: '#0b0b0b', textAlign: 'center', padding: '0 90px', lineHeight: 1.06 }}>
          a friend wants you here.
        </div>
        <div style={{ display: 'flex', marginTop: 28, fontSize: 30, color: '#6b6975' }}>meet people, not profiles — you both get a free friend pack</div>
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
