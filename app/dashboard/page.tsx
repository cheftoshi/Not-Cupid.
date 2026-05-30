import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import MatchCard from './match-card';
import ExpandRadiusButton from './expand-radius-button';
import CorpFooter from '@/components/corp-footer';
import { zipDistanceMiles, DEFAULT_MATCH_RADIUS, MAX_MATCH_RADIUS } from '@/lib/quiz-data';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { unlock_session?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/');
  if (!user.archetype) redirect('/quiz');

  // If returning from Stripe checkout, verify the payment inline
  if (searchParams.unlock_session) {
    try {
      const stripeRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${searchParams.unlock_session}`,
        { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }, cache: 'no-store' }
      );
      const session = await stripeRes.json();
      if (
        session.payment_status === 'paid' &&
        session.metadata?.user_id === user.id &&
        session.metadata?.type === 'match_unlock'
      ) {
        await supabaseAdmin.from('match_unlocks').upsert(
          {
            user_id: user.id,
            match_id: session.metadata.match_id,
            unlocked_user_id: session.metadata.unlocked_user_id,
            amount_cents: 299,
            stripe_payment_id: session.payment_intent,
          },
          { onConflict: 'user_id,match_id' }
        );
      }
    } catch (e) {
      console.error('Unlock verification failed:', e);
    }
  }

  // Get current (non-ended) match
  const { data: currentMatch } = await supabaseAdmin
    .from('matches')
    .select('*')
    .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
    .is('ended_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let otherUser = null;
  let isUnlocked = false;

  if (currentMatch) {
    const otherId =
      currentMatch.user_1_id === user.id ? currentMatch.user_2_id : currentMatch.user_1_id;

    const { data } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', otherId)
      .single();
    otherUser = data;

    const { data: unlock } = await supabaseAdmin
      .from('match_unlocks')
      .select('id')
      .eq('user_id', user.id)
      .eq('match_id', currentMatch.id)
      .maybeSingle();
    isUnlocked = !!unlock;
  }


  // History (ended matches)
  const { data: historyMatches } = await supabaseAdmin
    .from('matches')
    .select('*')
    .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false })
    .limit(10);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.nav}>
          <div className={styles.navBrand}>NOTCUPID</div>
          <div className={styles.navLinks}>
            <a href="/profile" className={styles.navLink}>Profile</a>
            <a href="/profile/preview" className={styles.navLink}>Preview</a>
            <a href="/dashboard" className={`${styles.navLink} ${styles.navLinkActive}`}>Matches</a>
            <a href="/quiz?retake=1" className={styles.navLink}>Retake quiz</a>
          </div>
        </nav>

        <h1 className={styles.title}>
          your <span className={styles.titleAccent}>matches.</span>
        </h1>
        <p className={styles.subtitle}>
          one match at a time · the algorithm sets the pace →
        </p>

        {currentMatch && otherUser ? (
          <MatchCard
            match={currentMatch}
            otherUser={otherUser}
            currentUserId={user.id}
            isUnlocked={isUnlocked}
            distanceMi={(() => { const d = zipDistanceMiles(user.zip, otherUser.zip); return d == null ? null : Math.round(d); })()}
            beyondRadius={(() => {
              const d = zipDistanceMiles(user.zip, otherUser.zip);
              return d != null && d > (user.match_radius ?? DEFAULT_MATCH_RADIUS);
            })()}
          />
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>✦</div>
            <h2 className={styles.emptyTitle}>in the queue.</h2>
            <p className={styles.emptyText}>
              the algorithm re-runs every 20 minutes, scanning the pool for your person.
              your next match can land any minute — we&apos;ll email you the moment it does.
            </p>
            <ExpandRadiusButton radius={user.match_radius ?? DEFAULT_MATCH_RADIUS} maxRadius={MAX_MATCH_RADIUS} />
          </div>
        )}

        {historyMatches && historyMatches.length > 0 && (
          <div className={styles.history}>
            <h2 className={styles.historyTitle}>past matches</h2>
            <div className={styles.historyList}>
              {historyMatches.map((m: any) => (
                <div key={m.id} className={styles.historyItem}>
                  <span className={styles.historyDate}>
                    {new Date(m.ended_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className={styles.historyOutcome}>
                    {formatOutcome(m.ended_reason)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <CorpFooter />
    </div>
  );
}

function formatOutcome(reason: string | null): string {
  switch (reason) {
    case 'expired': return 'expired without acceptance';
    case 'one_passed': return 'one of you passed';
    case 'mutual_pass': return 'both passed';
    case 'completed': return 'completed';
    case 'user_deleted': return 'account deleted';
    default: return 'ended';
  }
}
