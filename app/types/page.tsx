import type { Metadata } from 'next';
import { ARCHETYPES, typeSlug } from '@/lib/quiz-data';

// The archetype glossary — every NotCupid type in one place (user-requested:
// "what are the other types?"). Each card links to its shareable /type page.
export const metadata: Metadata = {
  title: 'The NotCupid types — every archetype',
  description: 'Every NotCupid personality archetype, from the quiz built on actual psychology. Find yours.',
};

export default function TypesPage() {
  return (
    <div style={{ minHeight: '100vh', padding: '4.5rem 1.5rem 4rem', background: 'radial-gradient(900px 480px at 15% -5%, rgba(37,99,255,0.09), transparent 55%), radial-gradient(760px 420px at 95% 8%, rgba(255,106,31,0.07), transparent 52%), var(--h-bg)', color: 'var(--h-text)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--blue)', marginBottom: '0.9rem' }}>✦ the glossary</div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontSize: 'clamp(2rem, 7vw, 2.8rem)', lineHeight: 1.05, margin: '0 0 0.7rem' }}>every <span style={{ color: 'var(--blue)', fontWeight: 700 }}>type.</span></h1>
          <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--h-text-dim)', margin: 0 }}>the archetypes the quiz can hand you — each one a real HEXACO profile shape, not a horoscope.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {ARCHETYPES.map((t) => (
            <a key={t.name} href={`/type/${typeSlug(t.name)}`} style={{ display: 'block', background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 18, padding: '1.2rem 1.3rem', textDecoration: 'none', color: 'var(--h-text)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.25rem' }}>{t.name}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-accent)', marginBottom: '0.45rem' }}>{t.tag}</div>
              <p style={{ margin: 0, fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '0.88rem', lineHeight: 1.5, color: 'var(--h-text-dim)' }}>{t.desc}</p>
            </a>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <a href="/quiz" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>find your type →</a>
        </div>
      </div>
    </div>
  );
}
