import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyUnsubToken } from '@/lib/email';
import UnsubClient from './unsub-client';

export const dynamic = 'force-dynamic';

// Two-step unsubscribe so a single accidental click can't take someone out
// of the matching pool. Step 1 (this page): show a confirmation. Step 2:
// the client posts to /api/unsubscribe with the same token to actually
// flip email_notifications + pool_active off.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: { u?: string; t?: string };
}) {
  const userId = searchParams.u || '';
  const token = searchParams.t || '';

  if (!userId || !token || !verifyUnsubToken(userId, token)) {
    return (
      <main style={{ minHeight: '100vh', background: '#f6f6f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ maxWidth: 480, background: '#fff', padding: '2.5rem', border: '1px solid rgba(14,12,26,0.08)', borderRadius: 14 }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#2563ff', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>invalid link</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#0e0c1a', margin: '0 0 16px 0' }}>This link isn't valid.</h1>
          <p style={{ fontFamily: 'system-ui, sans-serif', color: '#7a7590', lineHeight: 1.65 }}>
            It may have expired or been tampered with. If you want to stop emails, log in and toggle "email notifications" off in your profile.
          </p>
        </div>
      </main>
    );
  }

  // Load the user so we can show their email + current status.
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, name, email, email_notifications')
    .eq('id', userId)
    .single();

  if (!user) redirect('/');

  // Already unsubscribed? Show a different state.
  const alreadyOff = user.email_notifications === false;

  return <UnsubClient user={user} token={token} alreadyOff={alreadyOff} />;
}
