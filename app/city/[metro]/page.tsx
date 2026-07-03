import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { METRO_CENTERS, metroOf } from '@/lib/quiz-data';

export const dynamic = 'force-dynamic';

// Per-metro landing pages — the SEO surface for "meet friends in boston" /
// "dating in providence" searches. Live pool count + real upcoming plans make
// the page feel alive; the only door in is the quiz.

export function generateStaticParams() {
  return Object.keys(METRO_CENTERS).map((metro) => ({ metro }));
}

export async function generateMetadata({ params }: { params: { metro: string } }): Promise<Metadata> {
  const m = METRO_CENTERS[params.metro];
  if (!m) return { title: 'NotCupid — A Connection Experiment' };
  return {
    title: `Meet people in ${m.city} — NotCupid`,
    description: `Dates and real friends in ${m.city}, ${m.state} — no swiping. An algorithm built on actual psychology curates your people; you choose who to meet. Free to join.`,
  };
}

// Live stats with a 3s race so a slow DB can't hang a public landing page.
async function cityStats(metro: string) {
  const fallback = { count: 0, plans: [] as any[] };
  const load = (async () => {
    const [{ data: zips }, { data: acts }] = await Promise.all([
      supabaseAdmin.from('users').select('zip').is('deleted_at', null).not('is_test', 'is', true).limit(4000),
      supabaseAdmin.from('friend_activities')
        .select('id, title, kind, area, happens_at, expires_at, author_id')
        .eq('kind', 'event')
        .gt('expires_at', new Date().toISOString())
        .order('happens_at', { ascending: true })
        .limit(24),
    ]);
    const count = (zips ?? []).filter((u) => metroOf(u.zip) === metro).length;
    // Only real-authored plans, capped at 4 — title/when/area only (public-safe).
    const authorIds = Array.from(new Set((acts ?? []).map((a) => a.author_id)));
    const { data: authors } = authorIds.length
      ? await supabaseAdmin.from('users').select('id, is_test, zip').in('id', authorIds)
      : { data: [] as any[] };
    const authorById = new Map((authors ?? []).map((u: any) => [u.id, u]));
    const plans = (acts ?? [])
      .filter((a) => {
        const au: any = authorById.get(a.author_id);
        return au && au.is_test !== true && metroOf(au.zip) === metro;
      })
      .slice(0, 4)
      .map((a) => ({ id: a.id, title: a.title, area: a.area, happens_at: a.happens_at }));
    return { count, plans };
  })();
  const timeout = new Promise<typeof fallback>((res) => setTimeout(() => res(fallback), 3000));
  return Promise.race([load, timeout]).catch(() => fallback);
}

export default async function CityPage({ params }: { params: { metro: string } }) {
  const m = METRO_CENTERS[params.metro];
  if (!m) redirect('/');
  const { count, plans } = await cityStats(params.metro);

  return (
    <div style={{ minHeight: '100vh', padding: '4.5rem 1.5rem 4rem', background: 'radial-gradient(900px 480px at 15% -5%, rgba(37,99,255,0.09), transparent 55%), radial-gradient(760px 420px at 95% 8%, rgba(255,106,31,0.07), transparent 52%), var(--h-bg)', color: 'var(--h-text)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--blue)', marginBottom: '1rem' }}>✦ a connection experiment</div>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontSize: 'clamp(2.2rem, 8vw, 3.2rem)', lineHeight: 1.02, margin: '0 0 1rem' }}>
          meet people in <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{m.city}.</span>
        </h1>
        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.98rem', lineHeight: 1.6, color: 'var(--h-text-dim)', margin: '0 0 1.4rem' }}>
          dates and real friends — no swiping, no feeds. an algorithm built on actual psychology curates your people in {m.city}; you choose who to meet.
        </p>

        {count > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(37,99,255,0.08)', border: '1px solid rgba(37,99,255,0.25)', borderRadius: 999, padding: '0.5rem 1.1rem', fontFamily: "'DM Mono', monospace", fontSize: '0.66rem', letterSpacing: '0.05em', color: 'var(--blue)', marginBottom: '1.6rem' }}>
            ✦ {count.toLocaleString()} {count === 1 ? 'person is' : 'people are'} already in the {m.city} experiment
          </div>
        )}

        <div>
          <a href="/quiz" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>join the {m.city.toLowerCase()} experiment →</a>
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
                    {p.happens_at ? new Date(p.happens_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : p.area || ''}
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
