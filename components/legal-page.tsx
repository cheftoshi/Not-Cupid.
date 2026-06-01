import CorpFooter from '@/components/corp-footer';

// Shared, branded shell for the trust pages (privacy / terms / safety / about).
// Server component — plain content, readable, on-brand.
export default function LegalPage({ title, subtitle, updated, children }: {
  title: string; subtitle?: string; updated?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f6f6f6', color: '#0b0b0b' }}>
      <header style={{ borderBottom: '1px solid rgba(11,11,11,0.08)', padding: '1.1rem 1.25rem' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <a href="/" style={{ textDecoration: 'none', fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.4rem' }}>
            <span style={{ color: '#2563ff' }}>Not</span><span style={{ color: '#ff6a1f' }}>Cupid</span>
          </a>
          <a href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6b6b76', textDecoration: 'none' }}>← back home</a>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 760, margin: '0 auto', padding: '2.5rem 1.25rem 1rem', width: '100%' }}>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.2rem, 7vw, 3.2rem)', lineHeight: 1, margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#4a4a55', margin: '0.5rem 0 0', fontSize: '1.05rem' }}>{subtitle}</p>}
        {updated && <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9a96a8', margin: '0.9rem 0 0' }}>last updated · {updated}</p>}
        <div className="legalBody" style={{ marginTop: '2rem', fontFamily: 'system-ui, sans-serif', fontSize: '0.98rem', lineHeight: 1.65, color: '#26262e' }}>
          {children}
        </div>
        <style>{`
          .legalBody h2 { font-family: 'Bebas Neue', sans-serif; font-size: 1.5rem; letter-spacing: 0.02em; margin: 2.2rem 0 0.6rem; color: #0b0b0b; }
          .legalBody h3 { font-weight: 700; font-size: 1rem; margin: 1.4rem 0 0.4rem; }
          .legalBody p { margin: 0 0 0.9rem; }
          .legalBody ul { margin: 0 0 1rem; padding-left: 1.2rem; }
          .legalBody li { margin: 0 0 0.4rem; }
          .legalBody a { color: #2563ff; }
          .legalBody strong { color: #0b0b0b; }
        `}</style>
      </main>

      <CorpFooter />
    </div>
  );
}
