export default function RouteLoading({ label = 'loading your NotCupid space' }: { label?: string }) {
  return (
    <main
      role="status"
      aria-live="polite"
      style={{
        minHeight: '60dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'calc(2rem + env(safe-area-inset-top)) 1.25rem calc(2rem + env(safe-area-inset-bottom))',
        background: 'var(--h-bg, #fffdf8)',
        color: 'var(--h-text, #16110d)',
      }}
    >
      <p style={{ fontFamily: 'DM Mono, monospace', letterSpacing: '.12em', textTransform: 'uppercase', fontSize: '.72rem' }}>
        {label}…
      </p>
    </main>
  );
}
