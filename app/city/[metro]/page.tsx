import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { publicPlans } from '@/lib/public-plans';
import { planWhen } from '@/lib/plan-discovery';
import { METRO_CENTERS, metroOf } from '@/lib/quiz-data';

export const dynamic = 'force-dynamic';

// Per-metro landing pages — the SEO surface for "meet friends in boston" /
// "dating in providence" searches. Live pool count + real upcoming plans make
// the page feel alive; the only door in is the quiz.

export function generateStaticParams() {
  return Object.keys(METRO_CENTERS).map((metro) => ({ metro }));
}

export async function generateMetadata({ params }: { params: Promise<{ metro: string }> }): Promise<Metadata> {
  const { metro } = await params;
  const m = METRO_CENTERS[metro];
  if (!m) return { title: 'NotCupid — A Connection Experiment' };
  return {
    title: `Meet people in ${m.city} — NotCupid`,
    description: `Dates and real friends in ${m.city}, ${m.state} — no swiping. Real member plans and curated introductions; you choose who to meet. Free to join.`,
  };
}

async function cityStats(metro: string) {
  // Do not advertise registered accounts as available people.
  return { plans: await publicPlans({ metro }) };
}

export default async function CityPage({ params }: { params: Promise<{ metro: string }> }) {
  const { metro } = await params;
  const m = METRO_CENTERS[metro];
  if (!m) redirect('/');
  const { plans } = await cityStats(metro);

  return (
    <div style={{ minHeight: '100vh', padding: '4.5rem 1.5rem 4rem', background: 'radial-gradient(900px 480px at 15% -5%, rgba(37,99,255,0.09), transparent 55%), radial-gradient(760px 420px at 95% 8%, rgba(255,106,31,0.07), transparent 52%), var(--h-bg)', color: 'var(--h-text)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <a href="/" style={{ display: 'inline-block', marginBottom: '1.3rem', textDecoration: 'none', fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.15rem' }}>
          <span style={{ color: 'var(--blue)' }}>Not</span><span style={{ color: 'var(--orange, #ff6a1f)' }}>Cupid</span>
        </a>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--blue)', marginBottom: '1rem' }}>✦ a connection experiment</div>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontSize: 'clamp(2.2rem, 8vw, 3.2rem)', lineHeight: 1.02, margin: '0 0 1rem' }}>
          meet people in <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{m.city}.</span>
        </h1>
        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.98rem', lineHeight: 1.6, color: 'var(--h-text-dim)', margin: '0 0 1.4rem' }}>
          Find someone to do something with in {m.city}. Browse real member invitations, make a small-group plan, or request a two-person date. You choose who to meet.
        </p>

        <div>
          <a href={`/hub?city=${metro}`} className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>explore {m.city} →</a>
          <div style={{ marginTop: '0.9rem', fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-text-faint)' }}>free to join · a 4-minute quiz · you choose who to meet</div>
        </div>

        {plans.length > 0 && (
          <div style={{ marginTop: '3rem', textAlign: 'left' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#d2530f', marginBottom: '0.8rem', textAlign: 'center' }}>🧡 real plans happening in {m.city.toLowerCase()}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {plans.map((p: any) => (
                <a key={p.id} href={`/p/${p.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', background: 'var(--h-surface)', border: '1px solid var(--h-border)', borderRadius: 14, padding: '0.85rem 1rem', textDecoration: 'none', color: 'var(--h-text)', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontFamily: 'Georgia, ui-serif, serif', fontSize: '0.95rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.05em', color: 'var(--h-text-dim)', flexShrink: 0 }}>
                    {p.happens_at ? planWhen(p.happens_at) : p.area || ''}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
