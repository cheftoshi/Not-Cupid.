import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import DateVibesClient from './date-vibes-client';

export const dynamic = 'force-dynamic';

// Date vibes: post-acceptance bonding surface. Both users pick interests,
// then independently swipe through a filtered deck of activities/events.
// Mutual yeses become "you both want this" matches pinned at the top.
export default async function DateVibesPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/match/${params.id}/date-vibes`);

  // Verify match membership + that both sides have accepted (otherwise the
  // feature is locked).
  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('id, user_1_id, user_2_id, user_1_accepted, user_2_accepted, status, ended_at')
    .eq('id', params.id)
    .single();

  if (!match) return <LockedScreen reason="That match doesn't exist." />;
  if (match.user_1_id !== user.id && match.user_2_id !== user.id) {
    return <LockedScreen reason="Not your match." />;
  }
  if (!match.user_1_accepted || !match.user_2_accepted) {
    return <LockedScreen reason="Date vibes unlocks once you've both accepted the match." />;
  }
  if (match.ended_at) {
    return <LockedScreen reason="This match has ended." />;
  }

  const otherId = match.user_1_id === user.id ? match.user_2_id : match.user_1_id;
  const { data: other } = await supabaseAdmin
    .from('users')
    .select('id, name')
    .eq('id', otherId)
    .single();

  return (
    <DateVibesClient
      matchId={params.id}
      currentUserId={user.id}
      partnerName={other?.name ?? 'your match'}
    />
  );
}

function LockedScreen({ reason }: { reason: string }) {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--h-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: 480, background: 'var(--h-surface)', padding: '2.5rem', border: '1px solid var(--h-border)', borderRadius: 14 }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#2563ff', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>
          locked
        </div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: 'var(--h-text)', margin: '0 0 16px 0' }}>Not yet.</h1>
        <p style={{ fontFamily: 'system-ui, sans-serif', color: 'var(--h-text-dim)', lineHeight: 1.65 }}>{reason}</p>
        <a href="/dashboard" style={{ display: 'inline-block', marginTop: 18, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#1b46c9', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          ← back to dashboard
        </a>
      </div>
    </main>
  );
}
