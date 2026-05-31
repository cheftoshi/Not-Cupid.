export default function CorpFooter() {
  const year = new Date().getFullYear()
  return (
    <footer
      style={{
        marginTop: 'auto', // sticks to the bottom in any flex-column page
        textAlign: 'center',
        padding: '2rem 1rem 2.25rem',
        borderTop: '1px solid rgba(11,11,11,0.06)',
        fontFamily: "'DM Mono', ui-monospace, monospace",
      }}
    >
      <div
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '0.95rem',
          letterSpacing: '0.16em',
          color: '#2563ff',
          marginBottom: '0.5rem',
        }}
      >
        NOT<span style={{ color: '#ff6a1f' }}>CUPID</span>
      </div>
      <div style={{ marginBottom: '0.7rem', display: 'flex', gap: '1.1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        {[
          { label: 'instagram', handle: '@notcupidapp', href: 'https://instagram.com/notcupidapp' },
          { label: 'tiktok', handle: '@notcupid11', href: 'https://tiktok.com/@notcupid11' },
          { label: 'x', handle: '@notcupidapp', href: 'https://x.com/notcupidapp' },
        ].map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "'DM Mono', ui-monospace, monospace",
              fontSize: '0.6rem',
              letterSpacing: '0.14em',
              textTransform: 'lowercase',
              color: '#2563ff',
              textDecoration: 'none',
            }}
          >
            ↗ {s.label}
          </a>
        ))}
      </div>
      <div
        style={{
          fontSize: '0.5rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#9a96a8',
        }}
      >
        © {year} notcupid · a lemon labs property
      </div>
    </footer>
  )
}
