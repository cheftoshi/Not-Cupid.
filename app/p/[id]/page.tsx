import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { publicPlans } from '@/lib/public-plans';
import { planWhen } from '@/lib/plan-discovery';

export const dynamic = 'force-dynamic';

// Public, shareable view of a Scene plan — the acquisition surface. A member
// shares "who's down for pickleball?" to a group chat; the recipient lands here
// and the only door in is signup. Deliberately minimal: title, when, area, host
// FIRST NAME + count — no photos of others, no exact venue, no test content.

async function loadPlan(id: string) {
  return (await publicPlans({ id }))[0] || null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const plan = await loadPlan(id);
  if (!plan) return { title: 'NotCupid — A Connection Experiment' };
  return {
    title: `${plan.title} — NotCupid`,
    description: `${plan.hostFirst} is organizing this on NotCupid${plan.area ? ` in ${plan.area}` : ''}. Join the connection experiment to RSVP.`,
  };
}

const CAT_EMOJI: Record<string, string> = {
  fitness: '💪', gym: '🏋️', running: '🏃', tennis: '🎾', pickleball: '🏓', sports: '⚽', outdoors: '🥾',
  food: '🍜', coffee: '☕', drinks: '🍸', movies: '🎬', concerts: '🎫', music: '🎵', arts: '🎨',
  books: '📚', games: '🎲', chill: '🛋️', hang: '🧡',
};

export default async function PublicPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await loadPlan(id);
  if (!plan) return <main style={{ maxWidth: 600, margin: '3rem auto', padding: 24 }}><h1>This invitation isn’t available.</h1><p>It may have ended, been removed, or be limited to eligible members. No response has been sent.</p><a href="/hub">Explore current plans</a></main>;

  const when = planWhen(plan.happens_at);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem', background: 'radial-gradient(900px 480px at 12% -5%, rgba(255,106,31,0.09), transparent 55%), radial-gradient(760px 420px at 96% 8%, rgba(37,99,255,0.06), transparent 52%), var(--h-bg)', color: 'var(--h-text)' }}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        <div style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#d2530f', marginBottom: '1rem' }}>🧡 a plan on the friend line</div>
        <div style={{ background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 20, padding: '1.8rem 1.6rem', boxShadow: 'var(--shadow-lg)', textAlign: 'center' }}>
          <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>{CAT_EMOJI[plan.category] || '🧡'}</div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontSize: 'clamp(1.6rem, 6vw, 2.2rem)', lineHeight: 1.1, margin: '0 0 0.8rem' }}>{plan.title}</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontFamily: "'DM Mono', monospace", fontSize: '0.66rem', letterSpacing: '0.05em', color: 'var(--h-text-dim)', marginBottom: '1.2rem' }}>
            {when && <span>🗓 {when}</span>}
            {plan.area && <span>📍 {plan.area}</span>}
            <span>👥 {plan.hostFirst} is organizing</span>
          </div>
          <p style={{ fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '0.9rem', lineHeight: 1.55, color: 'var(--h-text-dim)', margin: '0 0 1.4rem' }}>
            NotCupid is a connection experiment — real plans with real people, no swiping. Join to RSVP and see who&apos;s going.
          </p>
          <a href={`/login?next=${encodeURIComponent(`/hub?plan=${plan.id}`)}`} className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>join this plan →</a>
          <div style={{ marginTop: '0.9rem', fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-text-faint)' }}>free to join · notcupid.com</div>
        </div>
      </div>
    </div>
  );
}
