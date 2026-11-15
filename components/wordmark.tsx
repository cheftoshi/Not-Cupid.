// Shared Tide + saffron wordmark; display font is self-hosted in the root layout.
import Link from 'next/link';

export default function Wordmark({
  size = 1.15,
  href,
  tagline = false,
  className,
}: {
  size?: number; // rem for the wordmark
  href?: string; // if set, wraps in a Link
  tagline?: boolean;
  className?: string;
}) {
  const mark = (
    <span
      style={{
        fontFamily: "'Space Grotesk', Georgia, ui-serif, serif",
        fontStyle: 'normal',
        fontWeight: 700,
        fontSize: `${size}rem`,
        letterSpacing: '-0.06em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: 'var(--h-text)' }}>notcupid</span><span style={{ color: 'var(--h-accent-2)' }}>.</span>
    </span>
  );

  const inner = tagline ? (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.3em' }}>
      {mark}
      <span
        style={{
          fontFamily: "'DM Sans', ui-monospace, monospace",
          fontSize: `${size * 0.34}rem`,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ color: '#064c48' }}>your connection </span>
        <span style={{ color: '#8a6500' }}>destination.</span>
      </span>
    </span>
  ) : (
    mark
  );

  // Brand navigation is on demand. A speculative Home fetch can outlive a
  // quick login/page transition and surface as a cancelled-fetch error in WebKit.
  if (href) {
    return (
      <Link href={href} prefetch={false} className={className} style={{ textDecoration: 'none', cursor: 'pointer', display: 'inline-block' }}>
        {inner}
      </Link>
    );
  }
  return <span className={className}>{inner}</span>;
}
