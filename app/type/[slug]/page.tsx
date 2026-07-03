import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ARCHETYPES, typeSlug } from '@/lib/quiz-data';

// Public archetype pages — the shareable quiz result ("I'm The Grounded
// Optimist"). Personality types are self-expression; every share is an
// acquisition surface (dynamic OG card next to this file).

function bySlug(slug: string) {
  return ARCHETYPES.find((a) => typeSlug(a.name) === slug) || null;
}

export function generateStaticParams() {
  return ARCHETYPES.map((a) => ({ slug: typeSlug(a.name) }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const t = bySlug(params.slug);
  if (!t) return { title: 'NotCupid — A Connection Experiment' };
  return {
    title: `${t.name} — my NotCupid type`,
    description: `${t.tag}. ${t.desc} Take the quiz and find yours.`,
  };
}

export default function TypePage({ params }: { params: { slug: string } }) {
  const t = bySlug(params.slug);
  if (!t) redirect('/quiz');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem', background: 'radial-gradient(900px 480px at 15% -5%, rgba(37,99,255,0.10), transparent 55%), radial-gradient(760px 420px at 95% 8%, rgba(255,106,31,0.07), transparent 52%), var(--h-bg)', color: 'var(--h-text)' }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--blue)', marginBottom: '1rem' }}>✦ a notcupid type</div>
        <div style={{ background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 22, padding: '2.2rem 1.8rem', boxShadow: 'var(--shadow-lg)' }}>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontSize: 'clamp(1.9rem, 7vw, 2.6rem)', lineHeight: 1.05, margin: '0 0 0.7rem' }}>{t.name}</h1>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--h-accent)', marginBottom: '1rem' }}>{t.tag}</div>
          <p style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '0.98rem', lineHeight: 1.6, color: 'var(--h-text-dim)', margin: '0 0 1.6rem' }}>{t.desc}</p>
          <a href="/quiz" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>find your type →</a>
          <div style={{ marginTop: '1rem', fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-text-faint)' }}>
            a 4-minute quiz built on actual psychology · notcupid.com
          </div>
        </div>
      </div>
    </div>
  );
}
