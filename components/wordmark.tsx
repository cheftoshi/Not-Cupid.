// The NotCupid wordmark — single source of truth, matches the social identity.
// "Not" in blue, "Cupid" in orange, italic Playfair serif. Use everywhere a
// brand lockup appears (navs, headers, footers) so it's identical app-wide.
//
// `size` scales the whole lockup; `tagline` shows "MEET PEOPLE. NOT PROFILES."
// underneath in the split-color mono treatment.

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
        fontFamily: "'Playfair Display', Georgia, ui-serif, serif",
        fontStyle: 'italic',
        fontWeight: 700,
        fontSize: `${size}rem`,
        letterSpacing: '-0.01em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: '#2563ff' }}>Not</span>
      <span style={{ color: '#ff6a1f' }}>Cupid</span>
    </span>
  );

  const inner = tagline ? (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.3em' }}>
      {mark}
      <span
        style={{
          fontFamily: "'DM Mono', ui-monospace, monospace",
          fontSize: `${size * 0.34}rem`,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ color: '#2563ff' }}>meet people. </span>
        <span style={{ color: '#ff6a1f' }}>not profiles.</span>
      </span>
    </span>
  ) : (
    mark
  );

  if (href) {
    return (
      <Link href={href} className={className} style={{ textDecoration: 'none', cursor: 'pointer', display: 'inline-block' }}>
        {inner}
      </Link>
    );
  }
  return <span className={className}>{inner}</span>;
}
