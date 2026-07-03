import { ImageResponse } from 'next/og';
import { ARCHETYPES, typeSlug } from '@/lib/quiz-data';

// The share card for /type/<slug> — what unfurls on iMessage/IG/X when someone
// posts their type. Bold serif name on brand-tinted paper.
export const runtime = 'edge';
export const alt = 'My NotCupid type';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { slug: string } }) {
  const t = ARCHETYPES.find((a) => typeSlug(a.name) === params.slug) || ARCHETYPES[0];
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #f6f6f6 0%, #eef2ff 55%, #fff1e8 100%)',
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', top: 54, display: 'flex', fontSize: 26, letterSpacing: 8, textTransform: 'uppercase', color: '#2563ff', fontWeight: 600 }}>
          ✦ A NOTCUPID TYPE
        </div>
        <div style={{ display: 'flex', fontSize: 92, fontStyle: 'italic', fontWeight: 700, color: '#0b0b0b', textAlign: 'center', padding: '0 80px', lineHeight: 1.05 }}>
          {t.name}
        </div>
        <div style={{ display: 'flex', marginTop: 28, fontSize: 30, letterSpacing: 4, textTransform: 'uppercase', color: '#d2530f', fontWeight: 600 }}>
          {t.tag}
        </div>
        <div style={{ position: 'absolute', bottom: 48, display: 'flex', alignItems: 'center', gap: 14, fontSize: 28, color: '#6b6975' }}>
          <span style={{ color: '#2563ff', fontWeight: 700 }}>Not</span>
          <span style={{ color: '#ff6a1f', fontWeight: 700, marginLeft: -12 }}>Cupid</span>
          <span>· find your type at notcupid.com</span>
        </div>
      </div>
    ),
    size
  );
}
