import Link from 'next/link';

export const dynamic = 'force-static';

// Index for the 3 retro-direction mocks. Throwaway design review only.
const OPTS = [
  { slug: 'a', name: 'Vintage travel-poster / WPA', desc: 'muted screen-print palette, old-Boston motifs, warm nostalgic' },
  { slug: 'b', name: '70s/80s analog', desc: 'film grain, chunky condensed type, retro color blocks, halftone' },
  { slug: 'c', name: 'MBTA transit-map', desc: 'line colors, station dots, route-map layout' },
];

export default function RetroIndex() {
  return (
    <div style={{ minHeight: '100vh', background: '#f3eee4', fontFamily: 'ui-sans-serif,system-ui,sans-serif', padding: '3rem 1.5rem', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '2rem', marginBottom: '0.5rem' }}>retro direction mocks</h1>
      <p style={{ color: '#6b6660', marginBottom: '2rem' }}>three takes on &quot;retro Boston scenery.&quot; open each, pick a winner — then I&apos;ll build it for real.</p>
      {OPTS.map((o) => (
        <Link key={o.slug} href={`/retro/${o.slug}`} style={{ display: 'block', background: '#fff', border: '2px solid #1a1814', borderRadius: 12, padding: '1.1rem 1.25rem', marginBottom: '0.9rem', textDecoration: 'none', color: '#1a1814', boxShadow: '4px 4px 0 #1a1814' }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Option {o.slug.toUpperCase()} — {o.name}</div>
          <div style={{ color: '#6b6660', fontSize: '0.9rem', marginTop: '0.2rem' }}>{o.desc}</div>
        </Link>
      ))}
    </div>
  );
}
