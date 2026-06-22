import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: 'var(--h-bg)', color: 'var(--h-text)', padding: '2rem 1.25rem' }}>
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.6rem', marginBottom: '1.5rem' }}>
        <span style={{ color: '#2563ff' }}>Not</span><span style={{ color: '#ff6a1f' }}>Cupid</span>
      </div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(3rem, 12vw, 6rem)', lineHeight: 0.9, color: '#2563ff' }}>404</div>
      <h1 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '1.5rem', margin: '0.5rem 0 0.4rem' }}>this stop isn&apos;t on the line.</h1>
      <p style={{ color: 'var(--h-text-dim)', maxWidth: 380, lineHeight: 1.55, margin: '0 0 1.6rem' }}>
        the page you&apos;re after moved, closed, or never existed. let&apos;s get you back on track.
      </p>
      <Link href="/" style={{ background: '#2563ff', color: '#fff', textDecoration: 'none', borderRadius: 999, padding: '0.8rem 1.6rem', fontFamily: "'DM Mono', monospace", fontSize: '0.66rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        ← back home
      </Link>
    </div>
  );
}
