import Wordmark from './wordmark';

export default function CorpFooter() {
  const year = new Date().getFullYear()
  return (
    <footer
      style={{
        marginTop: 'auto', // sticks to the bottom in any flex-column page
        textAlign: 'center',
        padding: '2.4rem 1rem 2.6rem',
        borderTop: '1px solid var(--h-border)',
        background: 'var(--h-surface)',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div style={{ marginBottom: '1rem' }}><Wordmark size={1.5} href="/" /></div>
      <div style={{ marginBottom: '0.7rem', display: 'flex', gap: '1.1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        {[
          { label: 'Instagram', handle: '@notcupidapp', href: 'https://instagram.com/notcupidapp' },
          { label: 'TikTok', handle: '@notcupid11', href: 'https://tiktok.com/@notcupid11' },
          { label: 'X', handle: '@notcupidapp', href: 'https://x.com/notcupidapp' },
        ].map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--h-accent)',
              textDecoration: 'none',
              // 44px-min tap target (Apple HIG) without changing the visual size
              padding: '0.85rem 0.5rem',
              margin: '-0.55rem -0.15rem',
              display: 'inline-block',
            }}
          >
            {s.label} <span aria-hidden>↗</span>
          </a>
        ))}
      </div>
      <div style={{ marginBottom: '0.7rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        {[
          { label: 'About', href: '/about' },
          { label: 'How it works', href: '/how-it-works' },
          { label: 'FAQ', href: '/faq' },
          { label: 'Safety', href: '/safety' },
          { label: 'Privacy', href: '/privacy' },
          { label: 'Terms', href: '/terms' },
          { label: 'Contact', href: 'mailto:match@notcupid.com' },
        ].map((l) => (
          <a
            key={l.label}
            href={l.href}
            style={{
              fontSize: '0.875rem',
              color: 'var(--h-text-dim)',
              textDecoration: 'none',
              // 44px-min tap target (Apple HIG) without changing the visual size
              padding: '0.85rem 0.5rem',
              margin: '-0.55rem -0.2rem',
              display: 'inline-block',
            }}
          >
            {l.label}
          </a>
        ))}
      </div>
      <div
        style={{
          fontSize: '0.8125rem',
          color: 'var(--h-text-faint)',
        }}
      >
        © {year} NotCupid · A Lemon Labs property
      </div>
    </footer>
  )
}
