import { ImageResponse } from 'next/og';
import { METRO_CENTERS } from '@/lib/quiz-data';

// Share card for /city/<metro> — unfurls when a city page is posted.
export const alt = 'Meet people on NotCupid';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ metro: string }> }) {
  const { metro } = await params;
  const m = METRO_CENTERS[metro];
  const city = m ? m.city : 'your city';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f6f6f6 0%, #eef2ff 55%, #fff1e8 100%)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 54, display: 'flex', fontSize: 26, letterSpacing: 8, textTransform: 'uppercase', color: '#2563ff', fontWeight: 600 }}>✦ A CONNECTION EXPERIMENT</div>
        <div style={{ display: 'flex', fontSize: 96, fontStyle: 'italic', fontWeight: 700, color: '#0b0b0b', textAlign: 'center', padding: '0 80px', lineHeight: 1.05 }}>
          meet people in {city}.
        </div>
        <div style={{ display: 'flex', marginTop: 28, fontSize: 30, color: '#6b6975' }}>dates + real friends · no swiping · you choose who to meet</div>
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
