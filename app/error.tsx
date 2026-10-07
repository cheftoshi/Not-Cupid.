'use client';

// Branded 500 / runtime-error boundary (reads far more "real product" than the
// default Next error screen).
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: 'var(--h-bg)', color: 'var(--h-text)', padding: '2rem 1.25rem' }}>
      <div style={{ fontFamily: "'Space Grotesk', Georgia, serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.6rem', marginBottom: '1.5rem' }}>
        <span style={{ color: '#064c48' }}>Not</span><span style={{ color: '#8a6500' }}>Cupid</span>
      </div>
      <div style={{ fontSize: '2.6rem', marginBottom: '0.4rem' }}>🚧</div>
      <h1 style={{ fontFamily: 'Space Grotesk, serif', fontStyle: 'italic', fontSize: '1.5rem', margin: '0 0 0.4rem' }}>something glitched on our end.</h1>
      <p style={{ color: 'var(--h-text-dim)', maxWidth: 400, lineHeight: 1.55, margin: '0 0 1.6rem' }}>
        that&apos;s on us, not you. give it another go — if it keeps happening, email{' '}
        <a href="mailto:match@notcupid.com" style={{ color: '#064c48' }}>match@notcupid.com</a> and we&apos;ll fix it.
      </p>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={reset} style={{ background: '#064c48', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 999, padding: '0.8rem 1.6rem', fontFamily: "'DM Sans', monospace", fontSize: '0.66rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          try again
        </button>
        <a href="/" style={{ background: 'transparent', color: '#064c48', textDecoration: 'none', border: '1.5px solid #064c48', borderRadius: 999, padding: '0.8rem 1.6rem', fontFamily: "'DM Sans', monospace", fontSize: '0.66rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          back home
        </a>
      </div>
    </div>
  );
}
