import { ImageResponse } from 'next/og';

export const alt = 'NotCupid — A place to find your people.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#064c48', color: '#fff', padding: '64px 80px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, marginBottom: 45 }}>notcupid<span style={{ color: '#f4c542' }}>.</span></div>
      <div style={{ color: '#f4c542', fontSize: 18, letterSpacing: 3, marginBottom: 20 }}>YOUR CONNECTION DESTINATION.</div>
      <div style={{ fontSize: 78, fontWeight: 700, letterSpacing: -4 }}>A place to find</div>
      <div style={{ fontSize: 78, fontWeight: 700, letterSpacing: -4, color: '#f4c542' }}>your people.</div>
      <div style={{ fontSize: 27, marginTop: 30 }}>Dating and friendship, with more in common.</div>
    </div>,
    { ...size },
  );
}
