export default function CorpFooter() {
  const year = new Date().getFullYear()
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '1.5rem 1rem 1.75rem',
        fontFamily: "'DM Mono', ui-monospace, monospace",
        fontSize: '0.5rem',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#c8c4dc',
      }}
    >
      © {year} notcupid · a lemon labs property
    </div>
  )
}
