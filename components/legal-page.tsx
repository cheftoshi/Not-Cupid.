
// Shared, branded shell for the trust pages (privacy / terms / safety / about).
// Server component — plain content, readable, on-brand.
export default function LegalPage({ title, subtitle, updated, children }: {
  title: string; subtitle?: string; updated?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--h-bg)', color: 'var(--h-text)' }}>
      <header style={{ borderBottom: '1px solid var(--h-border)', padding: '1.1rem 1.25rem' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <a href="/" style={{ textDecoration: 'none', fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.4rem' }}>
            <span style={{ color: '#2563ff' }}>Not</span><span style={{ color: '#ff6a1f' }}>Cupid</span>
          </a>
          <a href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--h-text-dim)', textDecoration: 'none' }}>← back home</a>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 760, margin: '0 auto', padding: '2.5rem 1.25rem 1rem', width: '100%' }}>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.2rem, 7vw, 3.2rem)', lineHeight: 1, margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--h-text-dim)', margin: '0.5rem 0 0', fontSize: '1.05rem' }}>{subtitle}</p>}
        {updated && <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-text-faint)', margin: '0.9rem 0 0' }}>last updated · {updated}</p>}
        <div className="legalBody" style={{ marginTop: '2rem', fontFamily: 'system-ui, sans-serif', fontSize: '0.98rem', lineHeight: 1.65, color: 'var(--h-text)' }}>
          {children}
        </div>
        <style>{`
          .legalBody h2 { font-family: 'Bebas Neue', sans-serif; font-size: 1.5rem; letter-spacing: 0.02em; margin: 2.2rem 0 0.6rem; color: var(--h-text); }
          .legalBody h3 { font-weight: 700; font-size: 1rem; margin: 1.4rem 0 0.4rem; }
          .legalBody p { margin: 0 0 0.9rem; }
          .legalBody ul { margin: 0 0 1rem; padding-left: 1.2rem; }
          .legalBody li { margin: 0 0 0.4rem; }
          .legalBody a { color: #2563ff; }
          .legalBody strong { color: var(--h-text); }
        `}</style>
      </main>

    </div>
  );
}
