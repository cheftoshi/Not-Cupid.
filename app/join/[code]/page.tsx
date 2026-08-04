import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { metroOf, METRO_CENTERS } from '@/lib/quiz-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'You’re invited — NotCupid',
  description: 'A friend wants you on NotCupid — the connection experiment. Meet people, not profiles.',
};

// Warm invite landing: "<first name> wants you here." The CTA carries the ref
// code into the quiz so the signup records who brought them (users.referred_by).
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = String(rawCode || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  if (!code) redirect('/');

  const { data: inviter } = await supabaseAdmin
    .from('users')
    .select('name, photo_url, zip, is_test, deleted_at')
    .eq('invite_code', code)
    .maybeSingle();
  if (!inviter || inviter.deleted_at || inviter.is_test === true) redirect('/');

  const first = (inviter.name || 'A friend').split(' ')[0];
  const m = metroOf(inviter.zip);
  const city = m && METRO_CENTERS[m] ? METRO_CENTERS[m].city : null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem', background: 'radial-gradient(900px 480px at 15% -5%, rgba(37,99,255,0.09), transparent 55%), radial-gradient(760px 420px at 95% 8%, rgba(255,106,31,0.07), transparent 52%), var(--h-bg)', color: 'var(--h-text)' }}>
      <div style={{ maxWidth: 460, width: '100%', textAlign: 'center' }}>
        {inviter.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={inviter.photo_url} alt="" style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 1.1rem', display: 'block', border: '2.5px solid var(--blue)', boxShadow: 'var(--shadow-md)' }} />
        ) : (
          <div style={{ width: 84, height: 84, borderRadius: '50%', margin: '0 auto 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 32% 28%, rgba(37,99,255,0.2), transparent 60%), var(--h-surface-2)', border: '2.5px solid var(--blue)', fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontWeight: 700, fontSize: '2rem', color: 'var(--blue)' }}>{first[0]?.toUpperCase() || '✦'}</div>
        )}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--blue)', marginBottom: '0.9rem' }}>✦ you’re invited</div>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontStyle: 'italic', fontSize: 'clamp(2rem, 7vw, 2.8rem)', lineHeight: 1.05, margin: '0 0 0.9rem' }}>
          {first} wants you <span style={{ color: 'var(--blue)', fontWeight: 700 }}>here.</span>
        </h1>
        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--h-text-dim)', margin: '0 0 1.8rem' }}>
          NotCupid is a connection experiment{city ? ` in ${city}` : ''} — meet people, not profiles. An algorithm built on actual psychology curates your people; you choose who to meet. No swiping. Friends &gt; feeds.
        </p>
        <a href={`/quiz?ref=${code}`} className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
          join {first} on notcupid →
        </a>
        <div style={{ marginTop: '1.1rem', fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--h-text-faint)' }}>
          free to join · you both get a free friend pack
        </div>
      </div>
    </div>
  );
}
