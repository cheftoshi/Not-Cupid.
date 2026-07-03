'use client';

// Shared shimmer skeletons — shown while data loads so surfaces never flash
// blank or shift when content pops in. Theme-aware (uses the --h-* tokens).
// Usage: <Skeleton h={16} w="60%" />, <SkeletonCard />, or wrap a custom shape
// with className="ncShimmer".

export function SkeletonStyles() {
  return (
    <style>{`
      @keyframes ncShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
      .ncShimmer {
        background: linear-gradient(90deg, var(--h-surface-2) 25%, var(--h-surface-3) 50%, var(--h-surface-2) 75%);
        background-size: 200% 100%;
        animation: ncShimmer 1.6s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) { .ncShimmer { animation: none; } }
    `}</style>
  );
}

export function Skeleton({ h = 14, w = '100%', r = 8, style }: { h?: number | string; w?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div className="ncShimmer" aria-hidden style={{ height: h, width: w, borderRadius: r, ...style }} />;
}

// A person/candidate card silhouette (photo block + name + meta + button).
export function SkeletonCard({ width }: { width?: number | string }) {
  return (
    <div aria-hidden style={{ width: width ?? 'auto', flexShrink: 0, background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="ncShimmer" style={{ aspectRatio: '4 / 5' }} />
      <div style={{ padding: '0.9rem 0.95rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Skeleton h={18} w="55%" />
        <Skeleton h={10} w="75%" />
        <Skeleton h={10} w="45%" />
        <Skeleton h={34} r={11} style={{ marginTop: '0.4rem' }} />
      </div>
    </div>
  );
}

// A compact row silhouette (avatar + two lines) for list-y sections.
export function SkeletonRow() {
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.55rem 0.2rem' }}>
      <Skeleton h={38} w={38} r={19} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <Skeleton h={12} w="45%" />
        <Skeleton h={9} w="70%" />
      </div>
    </div>
  );
}
